"""What happens to an authenticated store delivery that cannot become an
order right now.

Stores stop redelivering once Ordium answers 2xx, and they disable webhooks
after repeated failures, so every signed delivery is acknowledged and the
merchant is told. A temporary refusal (monthly quota) is kept in a backlog
and retried by scripts.retry_store_backlog; a permanent one (bad data) is
reported so the merchant can fix the store or enter the order manually.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.store_order_backlog import StoreOrderBacklog

RETRYABLE_REASONS = frozenset({"usage_quota_exceeded"})


def _alert_once(db: Session, *, merchant_id: UUID, store_id: UUID, kind: str, resource_id: str,
                title: str, message: str, metadata: dict) -> None:
    exists = db.query(Notification.id).filter(
        Notification.store_id == store_id,
        Notification.notification_type == kind,
        Notification.resource_id == resource_id,
    ).first()
    if exists is None:
        db.add(Notification(
            merchant_id=merchant_id, store_id=store_id, environment="live",
            notification_type=kind, severity="warning", title=title, message=message[:2000],
            resource_type="store_order", resource_id=resource_id, metadata_json=metadata,
        ))


def handle_unprocessable_delivery(
    db: Session,
    *,
    merchant_id: UUID,
    store_id: UUID,
    platform: str,
    source_name: str,
    external_order_id: str | None,
    event_id: str,
    reason: str,
    payload: dict | None,
) -> dict:
    """Record the outcome for the merchant and return the 2xx response body."""
    order_ref = external_order_id or "?"
    metadata = {"platform": platform, "external_order_id": external_order_id, "reason": reason[:500]}

    if reason in RETRYABLE_REASONS and external_order_id and payload is not None:
        existing = db.query(StoreOrderBacklog).filter(
            StoreOrderBacklog.store_id == store_id,
            StoreOrderBacklog.platform == platform,
            StoreOrderBacklog.external_order_id == external_order_id[:255],
        ).first()
        if existing is None:
            db.add(StoreOrderBacklog(
                merchant_id=merchant_id, store_id=store_id, platform=platform,
                external_order_id=external_order_id[:255], event_id=event_id[:255],
                payload=payload, reason=reason,
            ))
        _alert_once(
            db, merchant_id=merchant_id, store_id=store_id, kind="integration.order_queued",
            resource_id=f"{platform}:{store_id}:{external_order_id}"[:255],
            title="A store order is waiting for quota",
            message=f"Order {order_ref} from {source_name} ({platform}) will be processed automatically once your monthly quota allows.",
            metadata=metadata,
        )
        db.commit()
        return {"accepted": True, "queued": True, "reason": reason}

    # One alert per store order and reason; a delivery without an order ID is
    # keyed by its delivery so different broken orders are each reported.
    subject = external_order_id or f"delivery-{hashlib.sha256(event_id.encode()).hexdigest()[:16]}"
    reason_key = hashlib.sha256(reason.encode()).hexdigest()[:8]
    _alert_once(
        db, merchant_id=merchant_id, store_id=store_id, kind="integration.order_rejected",
        resource_id=f"{platform}:{store_id}:{subject}:{reason_key}"[:255],
        title="A store order could not be processed",
        message=f"Order {order_ref} from {source_name} ({platform}) was not processed: {reason}",
        metadata=metadata,
    )
    db.commit()
    return {"accepted": False, "reason": reason}


def resolve_backlog(item: StoreOrderBacklog, resolution: str) -> None:
    item.resolved_at = datetime.now(timezone.utc)
    item.resolution = resolution
    item.payload = None  # the order (or its rejection) now lives elsewhere
