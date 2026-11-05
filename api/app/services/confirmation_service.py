"""Single place that applies an order-confirmation result.

Used by the manual dashboard flow (POST /orders/{id}/confirmation-attempts)
and by the automatic WhatsApp reply webhook, so both follow the same status
transition rules and produce the same notification / merchant webhook.
"""
import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.enums import OrderStatus
from app.models.notification import Notification
from app.models.order import Order
from app.models.order_confirmation_attempt import OrderConfirmationAttempt
from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)


class ConfirmationConflict(ValueError):
    """The order's current status does not allow this confirmation result."""


def apply_confirmation(
    db: Session,
    order: Order,
    *,
    channel: str,
    outcome: str,
    notes: str | None = None,
    api_key_id: UUID | None = None,
    update_status: bool = True,
    notify: bool = False,
) -> OrderConfirmationAttempt:
    if update_status and outcome == "confirmed":
        if order.status not in {OrderStatus.PENDING, OrderStatus.CONFIRMED}:
            raise ConfirmationConflict("This order can no longer be confirmed")
        order.status = OrderStatus.CONFIRMED
    elif update_status and outcome == "cancelled":
        if order.status not in {OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED}:
            raise ConfirmationConflict("A fulfilled order cannot be cancelled through confirmation")
        order.status = OrderStatus.CANCELLED

    attempt = OrderConfirmationAttempt(
        order_id=order.id,
        merchant_id=order.merchant_id,
        store_id=order.store_id,
        api_key_id=api_key_id,
        environment=order.environment,
        channel=channel,
        outcome=outcome,
        notes=notes.strip()[:1000] if notes else None,
    )
    db.add(attempt)

    if notify:
        severity = {"confirmed": "info", "cancelled": "warning"}.get(outcome, "warning")
        db.add(Notification(
            merchant_id=order.merchant_id,
            store_id=order.store_id,
            environment=order.environment,
            notification_type=f"order.confirmation.{outcome}",
            severity=severity,
            title=_TITLES.get(outcome, "Order confirmation update"),
            message=f"Order {order.external_order_id}: customer confirmation result is {outcome.upper()} ({channel}).",
            resource_type="order",
            resource_id=str(order.id),
            metadata_json={"order_id": str(order.id), "external_order_id": order.external_order_id,
                           "channel": channel, "outcome": outcome},
        ))

    WebhookService(db).enqueue(
        order.merchant_id, order.environment, "order.confirmation.updated",
        {"order_id": str(order.id), "external_order_id": order.external_order_id,
         "environment": order.environment, "channel": channel, "outcome": outcome,
         "order_status": order.status.value},
        store_id=order.store_id,
    )
    db.flush()
    if outcome in ("confirmed", "cancelled"):
        # Shipping must never break the confirmation itself.
        try:
            from app.services.shipping_service import ShippingService
            with db.begin_nested():
                service = ShippingService(db)
                if outcome == "confirmed":
                    service.on_confirmed(order)
                else:
                    service.on_cancelled(order)
        except Exception:
            logger.exception("shipping hook failed for order %s", order.id)
    return attempt


_TITLES = {
    "confirmed": "Customer confirmed the order",
    "cancelled": "Customer cancelled the order",
    "no_answer": "Customer did not answer",
    "needs_review": "Customer replied — review needed",
}
