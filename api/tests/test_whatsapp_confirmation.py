"""Automatic WhatsApp order confirmation (Meta Cloud API)."""
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus, OrderStatus, RiskDecision
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.order_confirmation_attempt import OrderConfirmationAttempt
from app.models.whatsapp_message import WhatsAppMessage
from app.services import whatsapp_service
from app.services.api_key_service import ApiKeyService
from scripts import dispatch_whatsapp

client = TestClient(app)
APP_SECRET = "test-app-secret"
VERIFY_TOKEN = "verify-token-123456"


@pytest.fixture(autouse=True)
def _whatsapp_settings(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_enabled", True)
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", "PNID")
    monkeypatch.setattr(settings, "whatsapp_access_token", "token")
    monkeypatch.setattr(settings, "whatsapp_app_secret", APP_SECRET)
    monkeypatch.setattr(settings, "whatsapp_verify_token", VERIFY_TOKEN)


class _Resp:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}

    def json(self):
        return self._payload


def _merchant_key(db, *, enabled=True, environment="live", decisions="allow,review", auto=True):
    merchant = Merchant(
        name="WA Store", email=f"wa-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
        is_shadow_mode_enabled=False, whatsapp_confirmation_enabled=enabled,
        whatsapp_confirmation_decisions=decisions, whatsapp_auto_update_status=auto,
    )
    db.add(merchant)
    db.flush()
    _, raw_key = ApiKeyService(db).create_key(merchant=merchant, name="wa", environment=environment,
                                               scopes=["orders:read", "orders:write"])
    db.commit()
    return merchant, {"Authorization": f"Bearer {raw_key}"}


def _create_order(headers, phone=None):
    phone = phone or f"0661{uuid4().int % 10**6:06d}"
    body = {
        "external_order_id": f"WA-{uuid4()}", "first_name": "Amina", "last_name": "Benali",
        "phone": phone, "wilaya": "Oran", "commune": "Bir El Djir", "address": "12 Rue Test",
        "total_amount": "4500.00", "currency": "DZD",
    }
    response = client.post("/api/v1/orders", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return UUID(response.json()["order_id"]), phone


def _message_for(db, order_id):
    db.expire_all()
    return db.query(WhatsAppMessage).filter(WhatsAppMessage.order_id == order_id).one_or_none()


def _isolate_queue(db, keep_id):
    """The test DB is shared; park other queued rows so the dispatcher claims ours."""
    db.query(WhatsAppMessage).filter(WhatsAppMessage.id != keep_id, WhatsAppMessage.status == "queued").update(
        {"status": "failed"}, synchronize_session=False)
    db.commit()


def _signed_post(payload):
    raw = json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return client.post("/api/v1/whatsapp/webhook", content=raw,
                       headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"})


def _webhook(messages=None, statuses=None):
    value = {"metadata": {"phone_number_id": "PNID"}}
    if messages is not None:
        value["messages"] = messages
    if statuses is not None:
        value["statuses"] = statuses
    return {"object": "whatsapp_business_account", "entry": [{"changes": [{"field": "messages", "value": value}]}]}


def _button(message, prefix, wamid=None, sender=None):
    return {"from": sender or message.to_phone, "id": wamid or f"wamid.in.{uuid4().hex}", "type": "button",
            "button": {"payload": prefix + message.reply_token, "text": "x"}}


def _sent_message(db, monkeypatch, **merchant_kwargs):
    _, headers = _merchant_key(db, **merchant_kwargs)
    order_id, _ = _create_order(headers)
    message = _message_for(db, order_id)
    message.status = "sent"
    message.provider_message_id = f"wamid.out.{uuid4().hex}"
    message.sent_at = datetime.now(timezone.utc)
    db.commit()
    monkeypatch.setattr(whatsapp_service.httpx, "post", lambda *a, **k: _Resp(200, {"messages": [{"id": "wamid.thanks"}]}))
    return order_id, message


# --------------------------------------------------------------------------- enqueue

def test_phone_conversion():
    assert whatsapp_service.to_whatsapp_phone("0661234567") == "213661234567"
    assert whatsapp_service.to_whatsapp_phone("213661234567") == "213661234567"
    assert whatsapp_service.to_whatsapp_phone("12345") is None
    assert whatsapp_service.to_whatsapp_phone(None) is None


def test_live_order_enqueues_confirmation():
    db = SessionLocal()
    try:
        _, headers = _merchant_key(db)
        order_id, phone = _create_order(headers)
        message = _message_for(db, order_id)
        assert message is not None and message.status == "queued"
        assert message.to_phone == "213" + phone[1:]
        assert len(message.reply_token) >= 24
    finally:
        db.close()


def test_disabled_merchant_gets_no_message():
    db = SessionLocal()
    try:
        _, headers = _merchant_key(db, enabled=False)
        order_id, _ = _create_order(headers)
        assert _message_for(db, order_id) is None
    finally:
        db.close()


def test_test_environment_is_simulated_never_sent():
    db = SessionLocal()
    try:
        _, headers = _merchant_key(db, environment="test")
        order_id, _ = _create_order(headers)
        assert _message_for(db, order_id).status == "simulated"
    finally:
        db.close()


def test_decision_filter():
    db = SessionLocal()
    try:
        merchant, headers = _merchant_key(db, decisions="allow,review")
        order_id, phone = _create_order(headers, phone="0770000001")
        db.query(WhatsAppMessage).filter(WhatsAppMessage.order_id == order_id).delete()
        order = db.get(Order, order_id)
        assert whatsapp_service.enqueue_for_order(db, order, merchant, RiskDecision.REJECT, phone) is None
        assert whatsapp_service.enqueue_for_order(db, order, merchant, RiskDecision.REVIEW, phone) is not None
        db.rollback()
    finally:
        db.close()


# --------------------------------------------------------------------------- dispatcher

def test_dispatcher_sends_template_with_button_tokens(monkeypatch):
    db = SessionLocal()
    try:
        _, headers = _merchant_key(db)
        order_id, _ = _create_order(headers)
        message = _message_for(db, order_id)
        _isolate_queue(db, message.id)
        captured = {}

        def fake_post(url, json=None, headers=None, **kwargs):
            captured.update(url=url, json=json, headers=headers, kwargs=kwargs)
            return _Resp(200, {"messages": [{"id": "wamid.sent.1" + uuid4().hex}]})

        monkeypatch.setattr(whatsapp_service.httpx, "post", fake_post)
        assert dispatch_whatsapp.dispatch_once() is True
        message = _message_for(db, order_id)
        assert message.status == "sent" and message.provider_message_id.startswith("wamid.sent.1")
        assert captured["url"].endswith("/PNID/messages")
        assert captured["headers"]["Authorization"] == "Bearer token"
        assert captured["kwargs"]["follow_redirects"] is False
        components = captured["json"]["template"]["components"]
        payloads = [c["parameters"][0]["payload"] for c in components if c["type"] == "button"]
        assert payloads == ["c:" + message.reply_token, "x:" + message.reply_token]
    finally:
        db.close()


def test_dispatcher_retries_transient_and_stops_on_permanent(monkeypatch):
    db = SessionLocal()
    try:
        _, headers = _merchant_key(db)
        order_id, _ = _create_order(headers)
        message = _message_for(db, order_id)
        _isolate_queue(db, message.id)

        monkeypatch.setattr(whatsapp_service.httpx, "post", lambda *a, **k: _Resp(503, {"error": {"code": 2}}))
        dispatch_whatsapp.dispatch_once()
        message = _message_for(db, order_id)
        assert message.status == "queued" and message.next_attempt_at is not None and message.attempts == 1

        message.next_attempt_at = None
        db.commit()

        def timeout(*a, **k):
            raise httpx.ConnectTimeout("t")

        monkeypatch.setattr(whatsapp_service.httpx, "post", timeout)
        dispatch_whatsapp.dispatch_once()
        assert _message_for(db, order_id).status == "queued"

        message = _message_for(db, order_id)
        message.next_attempt_at = None
        db.commit()
        monkeypatch.setattr(whatsapp_service.httpx, "post", lambda *a, **k: _Resp(400, {"error": {"code": 131026}}))
        dispatch_whatsapp.dispatch_once()
        message = _message_for(db, order_id)
        assert message.status == "failed" and "131026" in message.last_error
    finally:
        db.close()


# --------------------------------------------------------------------------- webhook

def test_webhook_verification_handshake():
    ok = client.get("/api/v1/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "42"})
    assert ok.status_code == 200 and ok.text == "42"
    bad = client.get("/api/v1/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42"})
    assert bad.status_code == 403


def test_webhook_rejects_bad_signature():
    response = client.post("/api/v1/whatsapp/webhook", content=b"{}", headers={"X-Hub-Signature-256": "sha256=deadbeef"})
    assert response.status_code == 401
    assert client.post("/api/v1/whatsapp/webhook", content=b"{}").status_code == 401


def test_confirm_button_confirms_order_once(monkeypatch):
    db = SessionLocal()
    try:
        order_id, message = _sent_message(db, monkeypatch)
        reply = _button(message, "c:", wamid="wamid.in.dup" + uuid4().hex)
        assert _signed_post(_webhook(messages=[reply])).status_code == 200
        assert _signed_post(_webhook(messages=[reply])).status_code == 200  # Meta retry
        db.expire_all()
        assert db.get(Order, order_id).status is OrderStatus.CONFIRMED
        message = _message_for(db, order_id)
        assert message.status == "replied" and message.reply_outcome == "confirmed"
        attempts = db.query(OrderConfirmationAttempt).filter(OrderConfirmationAttempt.order_id == order_id).all()
        assert [a.outcome for a in attempts] == ["confirmed"]
        assert attempts[0].channel == "whatsapp"
    finally:
        db.close()


def test_cancel_button_cancels_order(monkeypatch):
    db = SessionLocal()
    try:
        order_id, message = _sent_message(db, monkeypatch)
        assert _signed_post(_webhook(messages=[_button(message, "x:")])).status_code == 200
        db.expire_all()
        assert db.get(Order, order_id).status is OrderStatus.CANCELLED
    finally:
        db.close()


def test_reply_from_other_number_is_ignored(monkeypatch):
    db = SessionLocal()
    try:
        order_id, message = _sent_message(db, monkeypatch)
        _signed_post(_webhook(messages=[_button(message, "c:", sender="213999999999")]))
        db.expire_all()
        assert db.get(Order, order_id).status is OrderStatus.PENDING
    finally:
        db.close()


def test_free_text_reply_needs_review_without_status_change(monkeypatch):
    db = SessionLocal()
    try:
        order_id, message = _sent_message(db, monkeypatch)
        text = {"from": message.to_phone, "id": f"wamid.in.{uuid4().hex}", "type": "text",
                "text": {"body": "شكون نتوما؟"}, "context": {"id": message.provider_message_id}}
        _signed_post(_webhook(messages=[text]))
        db.expire_all()
        assert db.get(Order, order_id).status is OrderStatus.PENDING
        outcomes = [a.outcome for a in db.query(OrderConfirmationAttempt).filter(OrderConfirmationAttempt.order_id == order_id)]
        assert outcomes == ["needs_review"]
    finally:
        db.close()


def test_auto_update_off_records_without_changing_status(monkeypatch):
    db = SessionLocal()
    try:
        order_id, message = _sent_message(db, monkeypatch, auto=False)
        _signed_post(_webhook(messages=[_button(message, "c:")]))
        db.expire_all()
        assert db.get(Order, order_id).status is OrderStatus.PENDING
        outcomes = [a.outcome for a in db.query(OrderConfirmationAttempt).filter(OrderConfirmationAttempt.order_id == order_id)]
        assert outcomes == ["confirmed"]
    finally:
        db.close()


def test_status_callbacks_never_go_backwards(monkeypatch):
    db = SessionLocal()
    try:
        order_id, message = _sent_message(db, monkeypatch)
        wamid = message.provider_message_id
        _signed_post(_webhook(statuses=[{"id": wamid, "status": "read"}]))
        _signed_post(_webhook(statuses=[{"id": wamid, "status": "delivered"}]))
        message = _message_for(db, order_id)
        assert message.status == "read" and message.read_at is not None and message.delivered_at is not None
    finally:
        db.close()


def test_unanswered_message_expires_as_no_answer(monkeypatch):
    db = SessionLocal()
    try:
        order_id, message = _sent_message(db, monkeypatch)
        message.sent_at = datetime.now(timezone.utc) - timedelta(hours=25)
        db.commit()
        whatsapp_service.expire_unanswered(db)
        db.commit()
        message = _message_for(db, order_id)
        assert message.status == "expired" and message.reply_outcome == "no_answer"
        outcomes = [a.outcome for a in db.query(OrderConfirmationAttempt).filter(OrderConfirmationAttempt.order_id == order_id)]
        assert outcomes == ["no_answer"]
        assert db.get(Order, order_id).status is OrderStatus.PENDING
    finally:
        db.close()


# --------------------------------------------------------------------------- settings

def test_confirmation_settings_roundtrip():
    db = SessionLocal()
    try:
        _, headers = _merchant_key(db, enabled=False)
        current = client.get("/api/v1/confirmation-settings", headers=headers)
        assert current.status_code == 200
        assert current.json()["whatsapp_enabled"] is False
        assert current.json()["decisions"] == ["allow", "review"]
        updated = client.put("/api/v1/confirmation-settings", headers=headers,
                             json={"whatsapp_enabled": True, "decisions": ["review"], "auto_update_status": False})
        assert updated.status_code == 200, updated.text
        assert updated.json() == {"whatsapp_enabled": True, "decisions": ["review"], "auto_update_status": False,
                                  "provider_configured": True}
        bad = client.put("/api/v1/confirmation-settings", headers=headers,
                         json={"whatsapp_enabled": True, "decisions": ["maybe"], "auto_update_status": True})
        assert bad.status_code == 422
    finally:
        db.close()


def test_confirmation_history_exposes_automatic_status(monkeypatch):
    db = SessionLocal()
    try:
        _, headers = _merchant_key(db)
        order_id, _ = _create_order(headers)
        body = client.get(f"/api/v1/orders/{order_id}/confirmation-attempts", headers=headers).json()
        assert body["automatic"]["channel"] == "whatsapp"
        assert body["automatic"]["status"] == "queued"
    finally:
        db.close()


def test_thank_you_is_sent_after_commit_once(monkeypatch):
    db = SessionLocal()
    try:
        order_id, message = _sent_message(db, monkeypatch)
        sent = []

        def capture(url, json=None, **kwargs):
            sent.append(json)
            return _Resp(200, {"messages": [{"id": f"wamid.t.{uuid4().hex}"}]})

        monkeypatch.setattr(whatsapp_service.httpx, "post", capture)
        reply = _button(message, "c:")
        _signed_post(_webhook(messages=[reply]))
        _signed_post(_webhook(messages=[reply]))
        texts = [p for p in sent if p.get("type") == "text"]
        assert len(texts) == 1 and texts[0]["to"] == message.to_phone
    finally:
        db.close()
