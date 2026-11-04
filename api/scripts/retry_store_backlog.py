"""Retry store orders that were acknowledged but held back (monthly quota).

Run periodically (the compose webhook-worker loop calls it)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select

from app.db.database import SessionLocal
from app.models.store_order_backlog import StoreOrderBacklog
from app.services.store_delivery_service import RETRYABLE_REASONS, handle_unprocessable_delivery, resolve_backlog

logger = logging.getLogger("ordium.store_backlog")
BATCH_SIZE = 50
RETRY_EVERY = timedelta(minutes=30)
GIVE_UP_AFTER = timedelta(days=35)


def run_once() -> int:
    from app.api.v1.integrations import _ingest

    processed = 0
    with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        due = db.scalars(
            select(StoreOrderBacklog)
            .where(StoreOrderBacklog.resolved_at.is_(None), StoreOrderBacklog.next_attempt_at <= now)
            .order_by(StoreOrderBacklog.next_attempt_at)
            .limit(BATCH_SIZE)
            .with_for_update(skip_locked=True)
        ).all()
        for item in due:
            processed += 1
            item.attempts += 1
            created = item.created_at if item.created_at.tzinfo else item.created_at.replace(tzinfo=timezone.utc)
            try:
                _ingest(item.payload or {}, item.merchant_id, item.store_id, item.event_id)
                resolve_backlog(item, "ingested")
            except HTTPException as exc:
                reason = str(exc.detail)
                if exc.status_code >= 500 or reason in RETRYABLE_REASONS:
                    if now - created > GIVE_UP_AFTER:
                        resolve_backlog(item, "expired")
                    else:
                        item.next_attempt_at = now + RETRY_EVERY
                else:
                    handle_unprocessable_delivery(
                        db, merchant_id=item.merchant_id, store_id=item.store_id, platform=item.platform,
                        source_name=item.platform, external_order_id=item.external_order_id,
                        event_id=item.event_id, reason=reason, payload=None,
                    )
                    resolve_backlog(item, "rejected")
            except Exception:  # transient: database, provider
                logger.exception("store backlog retry failed id=%s", item.id)
                item.next_attempt_at = now + timedelta(minutes=5)
            db.commit()
    return processed


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    count = run_once()
    if count:
        logger.info("store backlog: processed %s", count)
