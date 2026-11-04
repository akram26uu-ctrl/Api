"""WhatsApp confirmation dispatcher.

Run periodically (the compose webhook-worker loop calls it). Sends queued
confirmation templates with claim/lease/backoff, and turns unanswered
messages into ``no_answer`` attempts after the reply window.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.order import Order
from app.models.store import Store
from app.models.whatsapp_message import WhatsAppMessage
from app.services import whatsapp_service

logger = logging.getLogger("ordium.whatsapp")
MAX_ATTEMPTS = 6
PROCESSING_LEASE_SECONDS = 300
BACKOFF_BASE_SECONDS = 30
BACKOFF_MAX_SECONDS = 3600
BATCH_SIZE = 50


def _backoff(attempts: int) -> int:
    return min(BACKOFF_MAX_SECONDS, BACKOFF_BASE_SECONDS * (2 ** max(0, attempts - 1)))


def _claim_one(db):
    now = datetime.now(timezone.utc)
    stale = now - timedelta(seconds=PROCESSING_LEASE_SECONDS)
    stmt = select(WhatsAppMessage).where(
        or_(
            (WhatsAppMessage.status == "queued")
            & or_(WhatsAppMessage.next_attempt_at.is_(None), WhatsAppMessage.next_attempt_at <= now),
            (WhatsAppMessage.status == "processing") & (WhatsAppMessage.processing_started_at <= stale),
        )
    ).order_by(WhatsAppMessage.created_at.asc()).limit(1)
    if db.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update(skip_locked=True)
    message = db.scalar(stmt)
    if message is None:
        return None
    message.status = "processing"
    message.processing_started_at = now
    message.attempts += 1
    db.commit()
    db.refresh(message)
    return message


def dispatch_once() -> bool:
    db = SessionLocal()
    try:
        message = _claim_one(db)
        if message is None:
            return False
        order = db.get(Order, message.order_id)
        store = db.get(Store, message.store_id) if message.store_id else None
        if order is None:
            message.status = "failed"
            message.last_error = "order_missing"
            db.commit()
            return True
        try:
            result = whatsapp_service.post_message(
                whatsapp_service.build_template_payload(message, order, store.name if store else "")
            )
        except Exception as exc:  # never let one message kill the worker
            result = whatsapp_service.SendResult(ok=False, error=type(exc).__name__)
        now = datetime.now(timezone.utc)
        message.processing_started_at = None
        if result.ok:
            message.status = "sent"
            message.provider_message_id = result.provider_message_id
            message.sent_at = now
            message.last_error = None
        elif result.permanent or message.attempts >= MAX_ATTEMPTS:
            message.status = "failed"
            message.last_error = (result.error or "unknown")[:255]
            logger.warning("WhatsApp send failed permanently id=%s error=%s", message.id, result.error)
        else:
            message.status = "queued"
            message.next_attempt_at = now + timedelta(seconds=_backoff(message.attempts))
            message.last_error = (result.error or "unknown")[:255]
        db.commit()
        return True
    finally:
        db.close()


def run_batch() -> int:
    if not settings.whatsapp_enabled:
        return 0
    sent = 0
    for _ in range(BATCH_SIZE):
        if not dispatch_once():
            break
        sent += 1
    db = SessionLocal()
    try:
        whatsapp_service.expire_unanswered(db)
        db.commit()
    finally:
        db.close()
    return sent


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    count = run_batch()
    if count:
        logger.info("WhatsApp dispatcher processed %s message(s)", count)
