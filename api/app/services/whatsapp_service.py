"""Automatic WhatsApp order confirmation via the Meta WhatsApp Cloud API.

One Ordium-managed business number sends an approved *utility* template with
two quick-reply buttons. Each button carries an opaque per-message token
(``c:<token>`` confirm, ``x:<token>`` cancel), so a reply can be mapped to its
order without trusting anything else in the inbound payload.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import RiskDecision
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.whatsapp_message import WhatsAppInboundEvent, WhatsAppMessage
from app.services.confirmation_service import ConfirmationConflict, apply_confirmation

logger = logging.getLogger("ordium.whatsapp")

CONFIRM_PREFIX = "c:"
CANCEL_PREFIX = "x:"
# Never move a message "backwards" when Meta delivers status callbacks out of order.
_STATUS_RANK = {"queued": 0, "processing": 1, "sent": 2, "delivered": 3, "read": 4, "replied": 5}
# Meta error codes that will never succeed on retry (invalid recipient, not on WhatsApp,
# template missing/paused, re-engagement required, user opted out of marketing, ...).
_PERMANENT_ERROR_CODES = {131026, 131047, 131051, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 131050, 100}


def to_whatsapp_phone(phone: str | None) -> str | None:
    """Algerian national format (0XXXXXXXXX, already validated) -> 213XXXXXXXXX."""
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) == 10 and digits.startswith("0"):
        return "213" + digits[1:]
    if len(digits) == 12 and digits.startswith("213"):
        return digits
    return None


def allowed_decisions(merchant: Merchant) -> set[str]:
    raw = getattr(merchant, "whatsapp_confirmation_decisions", "") or ""
    return {item.strip().lower() for item in raw.split(",") if item.strip()} & {d.value for d in RiskDecision}


def enqueue_for_order(db: Session, order: Order, merchant: Merchant | None, decision: RiskDecision, phone: str | None) -> WhatsAppMessage | None:
    """Create the outbox row in the order's own transaction (nothing is sent here)."""
    if merchant is None or not getattr(merchant, "whatsapp_confirmation_enabled", False):
        return None
    if decision.value not in allowed_decisions(merchant):
        return None
    to_phone = to_whatsapp_phone(phone)
    if to_phone is None:
        return None
    # Test environment never contacts real customers.
    simulated = order.environment != "live" or not settings.whatsapp_enabled
    message = WhatsAppMessage(
        order_id=order.id,
        merchant_id=order.merchant_id,
        store_id=order.store_id,
        environment=order.environment,
        to_phone=to_phone,
        template_name=settings.whatsapp_template_name,
        template_language=settings.whatsapp_template_language,
        status="simulated" if simulated else "queued",
        reply_token=secrets.token_urlsafe(24),
        attempts=0,
    )
    db.add(message)
    db.flush()
    return message


def _amount(value) -> str:
    try:
        quantized = Decimal(value).quantize(Decimal("1"))
    except Exception:
        return str(value)
    return f"{quantized:,} DZD".replace(",", " ")


def build_template_payload(message: WhatsAppMessage, order: Order, store_name: str) -> dict:
    customer_name = " ".join(part for part in (order.first_name, order.last_name) if part).strip() or "-"
    return {
        "messaging_product": "whatsapp",
        "to": message.to_phone,
        "type": "template",
        "template": {
            "name": message.template_name,
            "language": {"code": message.template_language},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": customer_name[:60]},
                        {"type": "text", "text": order.external_order_id[:60]},
                        {"type": "text", "text": _amount(order.total_amount)},
                        {"type": "text", "text": (store_name or "-")[:60]},
                    ],
                },
                {"type": "button", "sub_type": "quick_reply", "index": "0",
                 "parameters": [{"type": "payload", "payload": CONFIRM_PREFIX + message.reply_token}]},
                {"type": "button", "sub_type": "quick_reply", "index": "1",
                 "parameters": [{"type": "payload", "payload": CANCEL_PREFIX + message.reply_token}]},
            ],
        },
    }


@dataclass
class SendResult:
    ok: bool
    provider_message_id: str | None = None
    error: str | None = None
    permanent: bool = False


def _messages_url() -> str:
    base = settings.whatsapp_api_base_url.rstrip("/")
    return f"{base}/{settings.whatsapp_api_version}/{settings.whatsapp_phone_number_id}/messages"


def post_message(payload: dict) -> SendResult:
    try:
        response = httpx.post(
            _messages_url(),
            json=payload,
            headers={"Authorization": f"Bearer {settings.whatsapp_access_token}", "Content-Type": "application/json"},
            timeout=settings.whatsapp_timeout_seconds,
            follow_redirects=False,
        )
    except httpx.HTTPError as exc:
        return SendResult(ok=False, error=type(exc).__name__)
    try:
        data = response.json()
    except ValueError:
        data = {}
    if 200 <= response.status_code < 300:
        messages = data.get("messages") if isinstance(data, dict) else None
        message_id = messages[0].get("id") if messages and isinstance(messages[0], dict) else None
        if not message_id:
            return SendResult(ok=False, error="missing_message_id")
        return SendResult(ok=True, provider_message_id=str(message_id))
    error = data.get("error") if isinstance(data, dict) else None
    code = error.get("code") if isinstance(error, dict) else None
    permanent = (code in _PERMANENT_ERROR_CODES) or response.status_code in {400, 401, 403, 404}
    return SendResult(ok=False, error=f"HTTP {response.status_code} code={code}", permanent=permanent)


def send_text(to_phone: str, text: str) -> SendResult:
    """Free-form text; only valid inside the 24h customer-service window."""
    return post_message({"messaging_product": "whatsapp", "to": to_phone, "type": "text", "text": {"body": text[:1000]}})


def verify_signature(raw_body: bytes, header: str | None) -> bool:
    secret = settings.whatsapp_app_secret
    if not secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[len("sha256="):])


# ---------------------------------------------------------------------------
# Inbound webhook handling
# ---------------------------------------------------------------------------

_THANKS = {
    "confirmed": "شكراً لك، تم تأكيد طلبك ✅\nMerci, votre commande est confirmée.",
    "cancelled": "تم إلغاء طلبك بناءً على طلبك.\nVotre commande a été annulée.",
}


def _apply_status(db: Session, status: dict) -> None:
    wamid = status.get("id")
    new_status = status.get("status")
    if not wamid or new_status not in {"sent", "delivered", "read", "failed"}:
        return
    message = db.scalar(select(WhatsAppMessage).where(WhatsAppMessage.provider_message_id == str(wamid)))
    if message is None:
        return
    now = datetime.now(timezone.utc)
    if new_status == "failed":
        if message.status not in {"replied"}:
            message.status = "failed"
            errors = status.get("errors") or []
            code = errors[0].get("code") if errors and isinstance(errors[0], dict) else None
            message.last_error = f"delivery_failed code={code}"[:255]
        return
    if _STATUS_RANK.get(new_status, 0) > _STATUS_RANK.get(message.status, -1):
        message.status = new_status
    if new_status == "delivered" and message.delivered_at is None:
        message.delivered_at = now
    if new_status == "read" and message.read_at is None:
        message.read_at = now


def _record_inbound(db: Session, wamid: str, kind: str, body: str | None, message: WhatsAppMessage | None) -> bool:
    """Returns False if this inbound wamid was already processed."""
    try:
        with db.begin_nested():
            db.add(WhatsAppInboundEvent(
                provider_message_id=wamid, kind=kind, body=(body or None) and body[:2000],
                whatsapp_message_id=message.id if message else None,
            ))
            db.flush()
    except IntegrityError:
        return False
    return True


def _find_message_for_reply(db: Session, inbound: dict) -> tuple[WhatsAppMessage | None, str | None]:
    """Return (message, outcome) for a button reply, or (message, None) for free text."""
    payload = None
    if inbound.get("type") == "button":
        payload = (inbound.get("button") or {}).get("payload")
    elif inbound.get("type") == "interactive":
        reply = (inbound.get("interactive") or {}).get("button_reply") or {}
        payload = reply.get("id")
    if isinstance(payload, str) and payload[:2] in {CONFIRM_PREFIX, CANCEL_PREFIX}:
        token = payload[2:]
        message = db.scalar(select(WhatsAppMessage).where(WhatsAppMessage.reply_token == token))
        if message is None:
            return None, None
        # The reply must come from the number we wrote to.
        if str(inbound.get("from") or "") != message.to_phone:
            return None, None
        return message, "confirmed" if payload.startswith(CONFIRM_PREFIX) else "cancelled"
    # Free text: match by the replied-to message (context.id) or the latest open message to this number.
    context_id = (inbound.get("context") or {}).get("id")
    message = None
    if context_id:
        message = db.scalar(select(WhatsAppMessage).where(WhatsAppMessage.provider_message_id == str(context_id)))
    if message is None:
        message = db.scalar(
            select(WhatsAppMessage)
            .where(
                WhatsAppMessage.to_phone == str(inbound.get("from") or ""),
                WhatsAppMessage.status.in_(("sent", "delivered", "read")),
            )
            .order_by(WhatsAppMessage.created_at.desc())
            .limit(1)
        )
    if message is not None and str(inbound.get("from") or "") != message.to_phone:
        message = None
    return message, None


def _apply_inbound(db: Session, inbound: dict, outbox: list[tuple[str, str]]) -> None:
    wamid = inbound.get("id")
    if not wamid:
        return
    message, outcome = _find_message_for_reply(db, inbound)
    text = None
    if inbound.get("type") == "text":
        text = (inbound.get("text") or {}).get("body")
    if not _record_inbound(db, str(wamid), "button" if outcome else (inbound.get("type") or "unknown"), text or outcome, message):
        return  # duplicate delivery from Meta
    if message is None:
        return

    order = db.scalar(select(Order).where(Order.id == message.order_id).with_for_update())
    if order is None:
        return
    merchant = db.get(Merchant, order.merchant_id)
    now = datetime.now(timezone.utc)

    if outcome is None:
        # Free-text reply: never guess intent; ask the merchant to look.
        apply_confirmation(db, order, channel="whatsapp", outcome="needs_review",
                           notes=f"Customer replied: {text}" if text else "Customer replied", update_status=False, notify=True)
        return

    if message.reply_outcome is not None:
        return  # first button press wins
    update_status = bool(getattr(merchant, "whatsapp_auto_update_status", True))
    try:
        apply_confirmation(db, order, channel="whatsapp", outcome=outcome,
                           notes="Customer reply via WhatsApp", update_status=update_status, notify=True)
    except ConfirmationConflict:
        # e.g. already shipped: record it for the merchant, do not change status.
        apply_confirmation(db, order, channel="whatsapp", outcome="needs_review",
                           notes=f"Customer pressed {outcome} but order is {order.status.value}",
                           update_status=False, notify=True)
        outcome = "needs_review"
    message.status = "replied"
    message.reply_outcome = outcome
    message.replied_at = now
    db.flush()
    if outcome in _THANKS and order.environment == "live" and settings.whatsapp_enabled:
        outbox.append((message.to_phone, _THANKS[outcome]))


def handle_webhook(db: Session, payload: dict) -> list[tuple[str, str]]:
    """Apply a webhook payload. Returns thank-you texts to send *after* commit,
    so no HTTP call runs while the order row is locked and a failed commit
    (followed by a Meta retry) cannot send a duplicate."""
    outbox: list[tuple[str, str]] = []
    if not isinstance(payload, dict) or payload.get("object") != "whatsapp_business_account":
        return outbox
    for entry in payload.get("entry") or []:
        for change in (entry or {}).get("changes") or []:
            value = (change or {}).get("value") or {}
            metadata = value.get("metadata") or {}
            # Ignore events for any other number attached to the same app.
            if settings.whatsapp_phone_number_id and str(metadata.get("phone_number_id") or "") not in {"", settings.whatsapp_phone_number_id}:
                continue
            for status in value.get("statuses") or []:
                if isinstance(status, dict):
                    _apply_status(db, status)
            for inbound in value.get("messages") or []:
                if isinstance(inbound, dict):
                    _apply_inbound(db, inbound, outbox)
    return outbox


def send_followups(outbox: list[tuple[str, str]]) -> None:
    for to_phone, text in outbox:
        result = send_text(to_phone, text)
        if not result.ok:
            logger.warning("WhatsApp follow-up failed error=%s", result.error)


def expire_unanswered(db: Session, now: datetime | None = None) -> int:
    """Messages with no reply inside the window become no_answer attempts."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=settings.whatsapp_reply_window_hours)
    stale = db.scalars(
        select(WhatsAppMessage)
        .where(WhatsAppMessage.status.in_(("sent", "delivered", "read")), WhatsAppMessage.sent_at <= cutoff)
        .limit(200)
    ).all()
    for message in stale:
        order = db.get(Order, message.order_id)
        message.status = "expired"
        message.reply_outcome = "no_answer"
        if order is not None:
            apply_confirmation(db, order, channel="whatsapp", outcome="no_answer",
                               notes="No reply to WhatsApp confirmation", update_status=False, notify=False)
    db.flush()
    return len(stale)
