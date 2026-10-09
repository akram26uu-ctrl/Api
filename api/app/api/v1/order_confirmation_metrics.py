"""Merchant/store-scoped order-confirmation metrics derived from the audit log."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.api.store_scope import requested_store_id
from app.models.api_key import ApiKey
from app.models.enums import OrderStatus
from app.models.order import Order
from app.models.order_confirmation_attempt import OrderConfirmationAttempt

router = APIRouter(prefix="/order-confirmations", tags=["Order Confirmations"])


@router.get("/metrics")
def get_order_confirmation_metrics(
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("orders:read")),
):
    """Return counters for the active merchant, API environment and optional store.

    The conversion denominator is unique orders with at least one recorded
    confirmation event, not all incoming orders. This avoids counting orders
    nobody has attempted to confirm as failed confirmations. `unstarted_pending`
    is shown separately so the team can see untouched work.
    """
    selected_store = requested_store_id(db, api_key, store_id)
    orders = db.query(Order).filter(
        Order.merchant_id == api_key.merchant_id,
        Order.environment == api_key.environment,
    )
    attempts = db.query(OrderConfirmationAttempt).filter(
        OrderConfirmationAttempt.merchant_id == api_key.merchant_id,
        OrderConfirmationAttempt.environment == api_key.environment,
    )
    if selected_store is not None:
        orders = orders.filter(Order.store_id == selected_store)
        attempts = attempts.filter(OrderConfirmationAttempt.store_id == selected_store)

    attempted_order_ids = attempts.with_entities(OrderConfirmationAttempt.order_id).distinct().statement
    touched = orders.filter(Order.id.in_(attempted_order_ids))
    attempted_orders = touched.count()
    confirmed = touched.filter(Order.status == OrderStatus.CONFIRMED).count()
    cancelled = touched.filter(Order.status == OrderStatus.CANCELLED).count()
    in_progress = touched.filter(Order.status == OrderStatus.PENDING).count()
    untouched_pending = orders.filter(
        Order.status == OrderStatus.PENDING,
        ~Order.id.in_(attempted_order_ids),
    ).count()
    total_attempts = attempts.count()
    rate = round((confirmed / attempted_orders) * 100, 1) if attempted_orders else 0.0

    return {
        "attempted_orders": attempted_orders,
        "confirmed_orders": confirmed,
        "cancelled_orders": cancelled,
        "in_progress_orders": in_progress,
        "unstarted_pending_orders": untouched_pending,
        "total_attempts": total_attempts,
        "confirmation_rate": rate,
        "average_attempts_per_order": round(total_attempts / attempted_orders, 2) if attempted_orders else 0.0,
        "rate_denominator": "unique_orders_with_confirmation_activity",
    }
