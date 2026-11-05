"""Single place that records an order outcome (endpoint, merchant reject, ...)."""
import logging
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.enums import OrderStatus
from app.models.order import Order
from app.models.order_outcome import OrderOutcome
from app.repositories.order_outcome_repository import OrderOutcomeRepository
from app.repositories.risk_assessment_repository import RiskAssessmentRepository
from app.services.risk_evaluation_service import RiskEvaluationService
from app.services.webhook_service import WebhookService

STATUS_MAP = {
    "delivered": OrderStatus.DELIVERED,
    "cancelled": OrderStatus.CANCELLED,
    "returned": OrderStatus.RETURNED,
}


logger = logging.getLogger(__name__)


class OutcomeExists(Exception):
    """The order already has an outcome."""


def cancel_order_shipment(db: Session, order: Order) -> None:
    """A cancelled order must not ship: cancel its active shipment (and release stock).
    Runs in a savepoint; a shipping failure never breaks recording the outcome."""
    from app.services.shipping_service import ShippingService
    try:
        with db.begin_nested():
            ShippingService(db).on_cancelled(order)
    except Exception:
        logger.exception("shipping cancel hook failed for order %s", order.id)


def enqueue_outcome_updated(db: Session, order: Order, outcome: OrderOutcome) -> None:
    WebhookService(db).enqueue(
        order.merchant_id, order.environment, "order.outcome.updated",
        {"order_id": str(order.id), "outcome_status": outcome.outcome_status, "reason": outcome.reason,
         "environment": order.environment},
        store_id=order.store_id,
    )


def record_outcome(
    db: Session,
    order: Order,
    outcome_status: str,
    *,
    source: str,
    reason: str | None = None,
    note: str | None = None,
    occurred_at: datetime | None = None,
) -> OrderOutcome:
    if outcome_status not in STATUS_MAP:
        raise ValueError(f"Unknown outcome status: {outcome_status}")
    repository = OrderOutcomeRepository(db)
    if repository.get_by_order_id(order.id) is not None:
        raise OutcomeExists("Order outcome already exists")

    occurred_at = occurred_at or datetime.now(timezone.utc)
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)
    order_created_at = order.created_at
    if order_created_at.tzinfo is None:
        order_created_at = order_created_at.replace(tzinfo=timezone.utc)
    if occurred_at < order_created_at:
        raise ValueError("occurred_at cannot be earlier than order creation time")

    outcome = OrderOutcome(
        order_id=order.id, outcome_status=outcome_status, source=source,
        note=note, reason=reason, occurred_at=occurred_at,
    )
    try:
        with db.begin_nested():
            repository.create(outcome)
    except IntegrityError as exc:
        raise OutcomeExists("Order outcome already exists") from exc

    order.status = STATUS_MAP[outcome_status]
    assessment = RiskAssessmentRepository(db).get_latest_for_order(order.id)
    RiskEvaluationService(db).record_from_outcome(order=order, assessment=assessment, outcome=outcome)
    enqueue_outcome_updated(db, order, outcome)
    if outcome_status == "cancelled":
        db.flush()
        cancel_order_shipment(db, order)
    return outcome
