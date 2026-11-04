"""F1: the risk IP must be the shopper's IP, never the merchant server's peer IP."""
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus, RiskEventType
from app.models.merchant import Merchant
from app.models.order import Order
from app.schemas.order import normalize_customer_ip
from app.services.api_key_service import ApiKeyService

client = TestClient(app)


def _merchant_key(db, environment="live"):
    merchant = Merchant(name="IP Merchant", email=f"ip-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
    db.add(merchant)
    db.flush()
    _, raw_key = ApiKeyService(db).create_key(merchant=merchant, name="ip", environment=environment)
    db.commit()
    return merchant, raw_key


def _payload(i: int, **extra):
    body = {
        "external_order_id": f"ip-{uuid4()}",
        "first_name": f"Shopper{chr(65 + i)}",
        "last_name": "Distinct",
        "phone": f"05550{i:05d}",
        "wilaya": "Algiers",
        "commune": "Bab Ezzouar",
        "address": f"{i} Different Street",
        "total_amount": "5000.00",
        "currency": "DZD",
    }
    body.update(extra)
    return body


def test_normalize_customer_ip():
    assert normalize_customer_ip(None) is None
    assert normalize_customer_ip(" ") is None
    assert normalize_customer_ip("41.100.200.50") == "41.100.200.50"
    assert normalize_customer_ip("::ffff:41.100.200.50") == "41.100.200.50"
    assert normalize_customer_ip("10.0.0.1") is None  # private
    assert normalize_customer_ip("127.0.0.1") is None  # loopback
    with pytest.raises(ValueError):
        normalize_customer_ip("not-an-ip")


def test_live_orders_ignore_transport_ip_for_risk():
    """Many distinct shoppers sent from the same merchant server must not be
    linked by the server's IP."""
    db = SessionLocal()
    try:
        _, raw_key = _merchant_key(db)
        headers = {"Authorization": f"Bearer {raw_key}"}
        last = None
        for i in range(6):
            last = client.post("/api/v1/orders", json=_payload(i), headers=headers)
            assert last.status_code == 201, last.text
        events = {e["event_type"] for e in last.json()["risk"]["events"]}
        assert RiskEventType.MULTIPLE_CUSTOMERS_SAME_IP.value not in events
        assert RiskEventType.HIGH_IP_FREQUENCY.value not in events
        order = db.get(Order, UUID(last.json()["order_id"]))
        assert order.ip_address is None
    finally:
        db.close()


def test_live_customer_ip_from_body_and_header_is_used():
    db = SessionLocal()
    try:
        _, raw_key = _merchant_key(db)
        headers = {"Authorization": f"Bearer {raw_key}"}
        r1 = client.post("/api/v1/orders", json=_payload(1, customer_ip="41.100.200.50"), headers=headers)
        r2 = client.post("/api/v1/orders", json=_payload(2), headers={**headers, "X-Customer-IP": "41.100.200.51"})
        assert r1.status_code == 201 and r2.status_code == 201
        assert db.get(Order, UUID(r1.json()["order_id"])).ip_address == "41.100.200.50"
        assert db.get(Order, UUID(r2.json()["order_id"])).ip_address == "41.100.200.51"
    finally:
        db.close()


def test_shared_shopper_ip_still_detected():
    db = SessionLocal()
    try:
        _, raw_key = _merchant_key(db)
        headers = {"Authorization": f"Bearer {raw_key}"}
        last = None
        for i in range(3):
            last = client.post("/api/v1/orders", json=_payload(i, customer_ip="41.100.200.77"), headers=headers)
            assert last.status_code == 201
        events = {e["event_type"] for e in last.json()["risk"]["events"]}
        assert RiskEventType.MULTIPLE_CUSTOMERS_SAME_IP.value in events
    finally:
        db.close()


def test_invalid_customer_ip_rejected():
    db = SessionLocal()
    try:
        _, raw_key = _merchant_key(db)
        headers = {"Authorization": f"Bearer {raw_key}"}
        r = client.post("/api/v1/orders", json=_payload(1, customer_ip="bogus"), headers=headers)
        assert r.status_code == 422
        r = client.post("/api/v1/orders", json=_payload(2), headers={**headers, "X-Customer-IP": "bogus"})
        assert r.status_code == 422
    finally:
        db.close()


def test_integration_payload_shopper_ip_extraction():
    from app.api.v1.integrations import _shopper_ip
    assert _shopper_ip({"customer_ip_address": "41.100.200.50"}) == "41.100.200.50"
    assert _shopper_ip({"browser_ip": "41.100.200.51"}) == "41.100.200.51"
    assert _shopper_ip({"client_details": {"browser_ip": "41.100.200.52"}}) == "41.100.200.52"
    assert _shopper_ip({"customer_ip_address": "garbage", "browser_ip": "41.100.200.53"}) == "41.100.200.53"
    assert _shopper_ip({"customer_ip_address": "192.168.1.5"}) is None
    assert _shopper_ip({}) is None


def test_idempotent_retry_with_or_without_customer_ip_header_replays():
    db = SessionLocal()
    try:
        _, raw_key = _merchant_key(db)
        key = str(uuid4())
        body = _payload(3)
        base = {"Authorization": f"Bearer {raw_key}", "Idempotency-Key": key}
        first = client.post("/api/v1/orders", json=body, headers={**base, "X-Customer-IP": "41.100.200.60"})
        retry = client.post("/api/v1/orders", json=body, headers=base)
        assert first.status_code == 201 and retry.status_code == 201, retry.text
        assert retry.json()["order_id"] == first.json()["order_id"]
    finally:
        db.close()
