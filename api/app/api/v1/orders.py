from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import or_

from app.api.client_ip import get_client_ip
from app.api.dependencies import get_database, require_api_scope
from app.models.api_key import ApiKey
from app.schemas.order import OrderCreate, OrderResponse, OrderListPage, OrderListResponse
from app.services.order_service import OrderService
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.risk_assessment import RiskAssessment
from app.api.store_scope import requested_store_id
from app.models.order_confirmation_attempt import OrderConfirmationAttempt
from app.schemas.order_confirmation import ConfirmationAttemptCreate


router = APIRouter(prefix="/orders", tags=["Orders"])


def _risk_response(order: Order):
    assessment = max(order.risk_assessments, key=lambda item: item.created_at) if order.risk_assessments else None
    if assessment is None:
        raise HTTPException(status_code=409, detail="Risk assessment is unavailable")

    snapshot = assessment.feature_snapshot.features if assessment.feature_snapshot is not None else {}
    identity_graph = snapshot.get("identity_graph") or {}
    business_context = snapshot.get("business_context") or {}
    return {
        "assessment_id": str(assessment.id),
        "score": assessment.score,
        "decision": assessment.decision,
        "model_version": assessment.model_version,
        "rules_version": assessment.rules_version,
        "risk_profile_version": assessment.risk_profile_version,
        "execution_time_ms": assessment.execution_time_ms,
        "explanation": {
            "risk_signal_count": len(assessment.events),
            "identity_cluster_size": int(identity_graph.get("identity_cluster_size") or 0),
            "identity_confidence": order.identity_confidence,
            "identity_match_reasons": order.identity_match_reasons or [],
            "business_context": business_context,
        },
        "events": [
            {"event_type": event.event_type, "score_impact": event.score_impact, "event_data": event.event_data}
            for event in assessment.events
        ],
    }

def _order_list_response(order: Order) -> OrderListResponse:
    return OrderListResponse(
        order_id=str(order.id),
        external_order_id=order.external_order_id,
        status=order.status.value,
        environment=order.environment,
        store_id=str(order.store_id) if order.store_id else None,
        data_origin=order.data_origin,
        total_amount=order.total_amount,
        currency=order.currency,
        first_name=order.first_name,
        last_name=order.last_name,
        phone=order.phone_identifier.phone if order.phone_identifier else None,
        ip_address=order.ip_address,
        user_agent=order.user_agent,
        created_at=order.created_at,
        outcome_status=order.outcome.outcome_status if order.outcome else None,
        risk=_risk_response(order),
        items=[
            {
                "id": str(item.id), "product_name": item.product_name, "sku": item.sku,
                "product_category": item.product_category, "quantity": item.quantity,
                "unit_price": item.unit_price, "line_total": item.line_total,
            } for item in order.items
        ],
    )

@router.get("", response_model=OrderListPage)
def list_orders(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    decision: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=255),
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("orders:read")),
):
    selected_store = requested_store_id(db, api_key, store_id)
    query = db.query(Order).options(
        joinedload(Order.phone_identifier),
        joinedload(Order.outcome),
        selectinload(Order.items),
        selectinload(Order.risk_assessments).selectinload(RiskAssessment.events),
        selectinload(Order.risk_assessments).selectinload(RiskAssessment.feature_snapshot),
    ).filter(Order.merchant_id == api_key.merchant_id, Order.environment == api_key.environment)
    if selected_store is not None:
        query = query.filter(Order.store_id == selected_store)
    if status_filter:
        from app.models.enums import OrderStatus
        normalized_status = status_filter.lower()
        if normalized_status not in {item.value for item in OrderStatus}:
            raise HTTPException(422, "Invalid status filter")
        query = query.filter(Order.status == OrderStatus(normalized_status))
    if decision:
        normalized = decision.lower()
        if normalized not in {"allow", "review", "reject"}:
            raise HTTPException(422, "Invalid decision filter")
        from app.models.enums import RiskDecision
        query = query.filter(Order.risk_assessments.any(RiskAssessment.decision == RiskDecision(normalized)))
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(Order.external_order_id.ilike(pattern), Order.first_name.ilike(pattern), Order.last_name.ilike(pattern), Order.ip_address.ilike(pattern), Order.items.any(OrderItem.product_name.ilike(pattern))))
    total = query.count()
    orders = query.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return OrderListPage(data=[_order_list_response(order) for order in orders], pagination={"total": total, "page": page, "limit": limit, "total_pages": (total + limit - 1) // limit if total else 1})

@router.get("/{order_id}", response_model=OrderListResponse)
def get_order(order_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("orders:read"))):
    from uuid import UUID
    try:
        parsed = UUID(order_id)
    except ValueError as exc:
        raise HTTPException(404, "Order not found") from exc
    selected_store = requested_store_id(db, api_key, store_id)
    order = db.query(Order).options(
        joinedload(Order.phone_identifier), joinedload(Order.outcome), selectinload(Order.items), selectinload(Order.risk_assessments).selectinload(RiskAssessment.events), selectinload(Order.risk_assessments).selectinload(RiskAssessment.feature_snapshot)
    ).filter(Order.id == parsed, Order.merchant_id == api_key.merchant_id, Order.environment == api_key.environment)
    if selected_store is not None:
        order = order.filter(Order.store_id == selected_store)
    order = order.first()
    if order is None:
        raise HTTPException(404, "Order not found")
    return _order_list_response(order)

@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    request: Request,
    data: OrderCreate,
    x_device_fingerprint: str | None = Header(default=None, alias="X-Device-Fingerprint", max_length=255),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", max_length=255),
    x_ordium_store_id: str | None = Header(default=None, alias="X-Ordium-Store-ID", max_length=64),
    store_id: str | None = Query(default=None, max_length=64),
    x_simulation_ip: str | None = Header(default=None, alias="X-Simulation-IP", max_length=64),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("orders:write")),
):
    client_ip = get_client_ip(request)
    if api_key.environment == "test" and x_simulation_ip:
        client_ip = x_simulation_ip.strip()
    user_agent = request.headers.get("User-Agent")
    if user_agent is not None:
        user_agent = user_agent[:1000]

    try:
        # Dashboard requests carry the store in both the selector header and query
        # string. Prefer the explicit header, but accept the query fallback so
        # reverse proxies/gateways that strip custom headers cannot drop the store scope.
        requested_store = x_ordium_store_id or store_id
        selected_store = requested_store_id(db, api_key, requested_store)
        result = OrderService(db).create_order(
            merchant_id=api_key.merchant_id,
            api_key=api_key,
            store_id=selected_store,
            idempotency_key=idempotency_key,
            data=data,
            device_fingerprint=x_device_fingerprint,
            ip_address=client_ip,
            user_agent=user_agent,
            request_id=getattr(request.state, "request_id", None),
        )
    except ValueError as exc:
        status_code = status.HTTP_409_CONFLICT
        if str(exc) in {"Invalid Idempotency-Key", "Idempotency-Key was already used with a different request"}:
            status_code = 422
        elif str(exc) == "usage_quota_exceeded":
            status_code = 429
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    return result.response_body


@router.get("/{order_id}/confirmation-attempts")
def list_confirmation_attempts(
    order_id: str,
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("orders:read")),
):
    from uuid import UUID
    try:
        parsed_order_id = UUID(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Order not found") from exc
    selected_store = requested_store_id(db, api_key, store_id)
    order_query = db.query(Order).filter(
        Order.id == parsed_order_id,
        Order.merchant_id == api_key.merchant_id,
        Order.environment == api_key.environment,
    )
    if selected_store is not None:
        order_query = order_query.filter(Order.store_id == selected_store)
    order = order_query.first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    attempts = db.query(OrderConfirmationAttempt).filter(
        OrderConfirmationAttempt.order_id == order.id,
        OrderConfirmationAttempt.merchant_id == api_key.merchant_id,
        OrderConfirmationAttempt.environment == api_key.environment,
    ).order_by(OrderConfirmationAttempt.created_at.desc()).limit(50).all()
    latest = order.status.value if order.status.value in {"confirmed", "cancelled"} else (attempts[0].outcome if attempts else "pending")
    return {"status": latest, "data": [{
        "id": str(item.id), "order_id": str(item.order_id), "channel": item.channel,
        "outcome": item.outcome, "notes": item.notes, "created_at": item.created_at,
    } for item in attempts]}


@router.post("/{order_id}/confirmation-attempts", status_code=status.HTTP_201_CREATED)
def create_confirmation_attempt(
    order_id: str,
    data: ConfirmationAttemptCreate,
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("orders:write")),
):
    from uuid import UUID
    from app.models.enums import OrderStatus
    try:
        parsed_order_id = UUID(order_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Order not found") from exc
    selected_store = requested_store_id(db, api_key, store_id)
    order_query = db.query(Order).filter(
        Order.id == parsed_order_id,
        Order.merchant_id == api_key.merchant_id,
        Order.environment == api_key.environment,
    ).with_for_update()
    if selected_store is not None:
        order_query = order_query.filter(Order.store_id == selected_store)
    order = order_query.first()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if data.outcome == "confirmed":
        if order.status not in {OrderStatus.PENDING, OrderStatus.CONFIRMED}:
            raise HTTPException(status_code=409, detail="This order can no longer be confirmed")
        order.status = OrderStatus.CONFIRMED
    elif data.outcome == "cancelled":
        if order.status not in {OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED}:
            raise HTTPException(status_code=409, detail="A fulfilled order cannot be cancelled through confirmation")
        order.status = OrderStatus.CANCELLED

    attempt = OrderConfirmationAttempt(
        order_id=order.id,
        merchant_id=api_key.merchant_id,
        store_id=order.store_id,
        api_key_id=api_key.id,
        environment=api_key.environment,
        channel=data.channel,
        outcome=data.outcome,
        notes=data.notes.strip() if data.notes else None,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return {
        "id": str(attempt.id), "order_id": str(attempt.order_id),
        "channel": attempt.channel, "outcome": attempt.outcome,
        "notes": attempt.notes, "created_at": attempt.created_at,
    }
