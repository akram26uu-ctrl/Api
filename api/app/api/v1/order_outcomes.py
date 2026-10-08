from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_

from app.api.dependencies import (
    get_database,
    require_api_scope,
)
from app.api.store_scope import requested_store_id
from app.models.enums import OrderStatus
from app.models.api_key import ApiKey
from app.models.order import Order
from app.models.order_outcome import OrderOutcome
from app.repositories.order_outcome_repository import (
    OrderOutcomeRepository,
)
from app.repositories.risk_assessment_repository import RiskAssessmentRepository
from app.services.risk_evaluation_service import RiskEvaluationService
from app.services.audit_service import AuditService
from app.services.webhook_service import WebhookService
from app.schemas.order_outcome import (
    OrderOutcomeCreate,
    OrderOutcomeResponse,
    OrderOutcomeUpdate,
)


router = APIRouter(
    prefix="/orders",
    tags=["Order Outcomes"],
)


def outcome_to_response(
    outcome: OrderOutcome,
) -> OrderOutcomeResponse:
    return OrderOutcomeResponse(
        id=str(outcome.id),
        order_id=str(outcome.order_id),
        outcome_status=outcome.outcome_status,
        source=outcome.source,
        note=outcome.note,
        occurred_at=outcome.occurred_at,
        created_at=outcome.created_at,
    )


@router.post(
    "/{order_id}/outcome",
    response_model=OrderOutcomeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order_outcome(
    order_id: str,
    data: OrderOutcomeCreate,
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("outcomes:write")),
):
    selected_store = requested_store_id(db, api_key, store_id)
    try:
        parsed_order_id = UUID(order_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        ) from exc

    order = (
        db.query(Order)
        .filter(
            Order.id == parsed_order_id,
            Order.merchant_id == api_key.merchant_id,
            Order.environment == api_key.environment,
            *( [Order.store_id == selected_store] if selected_store is not None else [] ),
        )
        .with_for_update()
        .first()
    )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    repository = OrderOutcomeRepository(db)

    existing = repository.get_by_order_id(order.id)

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order outcome already exists",
        )

    occurred_at = data.occurred_at or datetime.now(timezone.utc)
    order_created_at = order.created_at
    if order_created_at.tzinfo is None:
        order_created_at = order_created_at.replace(tzinfo=timezone.utc)
    if occurred_at < order_created_at:
        raise HTTPException(422, "occurred_at cannot be earlier than order creation time")

    outcome = OrderOutcome(
        order_id=order.id,
        outcome_status=data.outcome_status,
        source=data.source,
        note=data.note,
        occurred_at=occurred_at,
    )

    try:
        repository.create(outcome)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order outcome already exists",
        ) from exc

    status_map = {
        "delivered": OrderStatus.DELIVERED,
        "cancelled": OrderStatus.CANCELLED,
        "returned": OrderStatus.RETURNED,
    }

    order.status = status_map[data.outcome_status]

    assessment = RiskAssessmentRepository(db).get_latest_for_order(order.id)
    RiskEvaluationService(db).record_from_outcome(
        order=order,
        assessment=assessment,
        outcome=outcome,
    )

    AuditService(db).record(
        action="order.outcome.updated", resource_type="order", resource_id=order.id,
        merchant_id=api_key.merchant_id, api_key_id=api_key.id, environment=order.environment,
        metadata={"outcome_status": outcome.outcome_status},
    )
    WebhookService(db).enqueue(
        api_key.merchant_id, order.environment, "order.outcome.updated",
        {"order_id": str(order.id), "outcome_status": outcome.outcome_status, "environment": order.environment},
        store_id=order.store_id,
    )
    db.commit()
    db.refresh(outcome)

    return outcome_to_response(outcome)

@router.put(
    "/{order_id}/outcome",
    response_model=OrderOutcomeResponse,
    status_code=status.HTTP_200_OK,
)
def update_order_outcome(
    order_id: str,
    data: OrderOutcomeUpdate,
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("outcomes:write")),
):
    selected_store = requested_store_id(db, api_key, store_id)
    try:
        parsed_order_id = UUID(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Order not found") from exc

    order = (
        db.query(Order)
        .filter(
            Order.id == parsed_order_id,
            Order.merchant_id == api_key.merchant_id,
            Order.environment == api_key.environment,
            *( [Order.store_id == selected_store] if selected_store is not None else [] ),
        )
        .with_for_update()
        .first()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    outcome = OrderOutcomeRepository(db).get_by_order_id(order.id)
    if outcome is None:
        raise HTTPException(status_code=404, detail="Order outcome not found")

    occurred_at = data.occurred_at or outcome.occurred_at
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)
    order_created_at = order.created_at
    if order_created_at.tzinfo is None:
        order_created_at = order_created_at.replace(tzinfo=timezone.utc)
    if occurred_at < order_created_at:
        raise HTTPException(422, "occurred_at cannot be earlier than order creation time")

    old_status = outcome.outcome_status
    outcome.outcome_status = data.outcome_status
    if data.source is not None:
        outcome.source = data.source
    outcome.note = data.note
    outcome.occurred_at = occurred_at

    status_map = {
        "delivered": OrderStatus.DELIVERED,
        "cancelled": OrderStatus.CANCELLED,
        "returned": OrderStatus.RETURNED,
    }
    order.status = status_map[data.outcome_status]

    assessment = RiskAssessmentRepository(db).get_latest_for_order(order.id)
    RiskEvaluationService(db).record_from_outcome(
        order=order, assessment=assessment, outcome=outcome
    )

    AuditService(db).record(
        action="order.outcome.corrected", resource_type="order", resource_id=order.id,
        merchant_id=api_key.merchant_id, api_key_id=api_key.id, environment=order.environment,
        metadata={"previous_outcome_status": old_status, "outcome_status": outcome.outcome_status},
    )
    WebhookService(db).enqueue(
        api_key.merchant_id, order.environment, "order.outcome.updated",
        {"order_id": str(order.id), "outcome_status": outcome.outcome_status, "environment": order.environment},
        store_id=order.store_id,
    )
    db.commit()
    db.refresh(outcome)
    return outcome_to_response(outcome)
