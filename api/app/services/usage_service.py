from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.merchant import Merchant
from app.models.order import Order
from app.core.config import settings


def current_cycle_start(now: datetime | None = None) -> datetime:
    value = now or datetime.now(timezone.utc)
    return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def next_cycle_start(start: datetime) -> datetime:
    if start.month == 12:
        return start.replace(year=start.year + 1, month=1)
    return start.replace(month=start.month + 1)


def get_live_usage(db: Session, merchant: Merchant) -> dict:
    now = datetime.now(timezone.utc)
    cycle_start = current_cycle_start(now)
    if merchant.quota_period_start.tzinfo is None:
        merchant.quota_period_start = merchant.quota_period_start.replace(tzinfo=timezone.utc)

    if merchant.quota_period_start < cycle_start:
        merchant.quota_period_start = cycle_start
        db.flush()

    query = db.query(func.count(Order.id)).filter(
        Order.merchant_id == merchant.id,
        Order.environment == "live",
        Order.created_at >= merchant.quota_period_start,
    )
    used = int(query.scalar() or 0)
    limit = max(0, int(merchant.monthly_order_limit))
    remaining = max(0, limit - used)
    percent = round((used / limit) * 100, 1) if limit else 100.0
    return {
        "rate_limit_per_min": settings.live_requests_per_minute,
        "plan_code": merchant.plan_code,
        "plan_name": "Free",
        "beta_access": bool(merchant.beta_access),
        "period_start": merchant.quota_period_start,
        "period_end": next_cycle_start(merchant.quota_period_start),
        "evaluations_used": used,
        "evaluations_limit": limit,
        "evaluations_remaining": remaining,
        "percent_used": min(100.0, percent),
    }


def enforce_live_quota(db: Session, merchant_id) -> dict:
    merchant = (
        db.query(Merchant)
        .filter(Merchant.id == merchant_id)
        .with_for_update()
        .one()
    )
    usage = get_live_usage(db, merchant)
    # The quota used to be advisory only (a warning flag was set but order
    # creation continued), so monthly_order_limit was never enforced. Raise so
    # OrderService surfaces HTTP 429 to the caller.
    if usage["evaluations_limit"] and usage["evaluations_used"] >= usage["evaluations_limit"]:
        usage["quota_exceeded_warning"] = True
        raise ValueError("usage_quota_exceeded")
    return usage
