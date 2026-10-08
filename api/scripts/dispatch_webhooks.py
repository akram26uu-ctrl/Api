"""Secure webhook dispatcher.

Run periodically from a worker/scheduler. It never follows redirects and
revalidates the destination immediately before delivery.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, HTTPRedirectHandler

from sqlalchemy import or_, select

from app.db.database import SessionLocal
from app.models.webhook_delivery import WebhookDelivery
from app.services.webhook_service import WebhookService

logger = logging.getLogger("ordium.webhooks")
MAX_ATTEMPTS = 8
PROCESSING_LEASE_SECONDS = 300
BACKOFF_BASE_SECONDS = 15
BACKOFF_MAX_SECONDS = 3600


class _NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Webhook redirects are not allowed")


def _backoff(attempts: int) -> int:
    return min(BACKOFF_MAX_SECONDS, BACKOFF_BASE_SECONDS * (2 ** max(0, attempts - 1)))


def _claim_one(db):
    now = datetime.now(timezone.utc)
    stale = now - timedelta(seconds=PROCESSING_LEASE_SECONDS)
    stmt = select(WebhookDelivery).where(
        or_(
            (WebhookDelivery.status == "pending") &
            (or_(WebhookDelivery.next_attempt_at.is_(None), WebhookDelivery.next_attempt_at <= now)),
            (WebhookDelivery.status == "processing") &
            (WebhookDelivery.processing_started_at <= stale),
        )
    ).order_by(WebhookDelivery.created_at.asc()).limit(1)
    if db.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update(skip_locked=True)
    delivery = db.scalar(stmt)
    if delivery is None:
        return None
    delivery.status = "processing"
    delivery.processing_started_at = now
    db.commit()
    db.refresh(delivery)
    return delivery


def _deliver(delivery: WebhookDelivery) -> tuple[bool, str | None]:
    endpoint = delivery.endpoint
    # Re-resolve and validate immediately before opening the connection.
    WebhookService(None).validate_delivery_target(endpoint.url)
    timestamp = int(time.time())
    signature = WebhookService(None).sign(endpoint, delivery.payload, timestamp)
    body = json.dumps(delivery.payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    req = Request(
        endpoint.url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "ORDIUM-Webhook/1.0",
            "X-ORDIUM-Event": delivery.event_type,
            "X-ORDIUM-Event-ID": str(delivery.event_id),
            "X-ORDIUM-Delivery-ID": str(delivery.id),
            "X-ORDIUM-Signature": signature,
        },
    )
    opener = build_opener(_NoRedirectHandler())
    try:
        with opener.open(req, timeout=10) as response:
            code = response.getcode()
            if 200 <= code < 300:
                return True, None
            return False, f"HTTP {code}"
    except HTTPError as exc:
        return False, f"HTTP {exc.code}"
    except (URLError, TimeoutError, OSError, RuntimeError, ValueError) as exc:
        return False, type(exc).__name__



def dispatch_delivery(db, delivery_id) -> tuple[bool, str | None, int | None, float | None]:
    """Deliver one already-created webhook delivery and persist its result."""
    from uuid import UUID
    started = time.perf_counter()
    delivery = db.scalar(select(WebhookDelivery).where(WebhookDelivery.id == UUID(str(delivery_id))))
    if delivery is None:
        return False, "not_found", None, None
    delivery.status = "processing"
    delivery.processing_started_at = datetime.now(timezone.utc)
    delivery.attempts += 1
    db.flush()
    try:
        success, error = _deliver(delivery)
    except Exception as exc:
        success, error = False, type(exc).__name__
    duration_ms = round((time.perf_counter() - started) * 1000, 3)
    now = datetime.now(timezone.utc)
    if success:
        delivery.status = "delivered"
        delivery.delivered_at = now
        delivery.processing_started_at = None
        delivery.last_error = None
    else:
        delivery.status = "failed"
        delivery.processing_started_at = None
        delivery.last_error = error
    db.commit()
    return success, error, 200 if success else None, duration_ms


def dispatch_once() -> bool:
    db = SessionLocal()
    try:
        delivery = _claim_one(db)
        if delivery is None:
            return False
        delivery.attempts += 1
        # Required outbound security headers: X-ORDIUM-Event-ID, X-ORDIUM-Delivery-ID.
        # The claim phase sets status = "processing" before this delivery attempt.
        try:
            success, error = _deliver(delivery)
        except Exception as exc:
            logger.warning("Webhook delivery failed id=%s error_type=%s", delivery.id, type(exc).__name__)
            success, error = False, type(exc).__name__
        now = datetime.now(timezone.utc)
        if success:
            delivery.status = "delivered"
            delivery.delivered_at = now
            delivery.processing_started_at = None
            delivery.last_error = None
        elif delivery.attempts >= MAX_ATTEMPTS:
            delivery.status = "failed"
            delivery.processing_started_at = None
            delivery.last_error = error
        else:
            delivery.status = "pending"
            delivery.processing_started_at = None
            delivery.next_attempt_at = now + timedelta(seconds=_backoff(delivery.attempts))
            delivery.last_error = error
        db.commit()
        return True
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    while dispatch_once():
        pass
