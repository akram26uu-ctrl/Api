from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.dependencies import get_database, require_api_scope
from app.models.api_key import ApiKey
from app.models.webhook_endpoint import WebhookEndpoint
from app.models.webhook_delivery import WebhookDelivery
from app.schemas.webhook import WebhookCreate, WebhookCreateResponse, WebhookResponse, WebhookTestResponse
from app.services.webhook_service import WebhookService
from app.api.store_scope import requested_store_id

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("", response_model=WebhookCreateResponse, status_code=201)
def create_webhook(data: WebhookCreate, db: Session = Depends(get_database), current: ApiKey = Depends(require_api_scope("webhooks:manage"))):
    selected_store = current.store_id
    if data.store_id:
        try:
            selected_store = UUID(data.store_id)
        except ValueError as exc:
            raise HTTPException(422, "Invalid store_id") from exc
        if current.store_id is not None and selected_store != current.store_id:
            raise HTTPException(403, "API key is restricted to its store")
    if selected_store is None:
        raise HTTPException(422, "store_id is required")
    try:
        endpoint, secret = WebhookService(db).create_endpoint(current.merchant_id, current.environment, str(data.url), data.events, selected_store)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    db.commit(); db.refresh(endpoint)
    return WebhookCreateResponse(id=str(endpoint.id), environment=endpoint.environment, url=endpoint.url, events=endpoint.events or [], signing_secret=secret, store_id=str(endpoint.store_id) if endpoint.store_id else None)


@router.get("", response_model=list[WebhookResponse])
def list_webhooks(limit: int = Query(default=100, ge=1, le=100), store_id: str | None = Query(default=None), db: Session = Depends(get_database), current: ApiKey = Depends(require_api_scope("webhooks:manage"))):
    selected_store = current.store_id
    if store_id:
        try: selected_store = UUID(store_id)
        except ValueError as exc: raise HTTPException(422, "Invalid store_id") from exc
        if current.store_id is not None and selected_store != current.store_id: raise HTTPException(403, "API key is restricted to its store")
    query = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.merchant_id == current.merchant_id,
        WebhookEndpoint.environment == current.environment,
        *( [WebhookEndpoint.store_id == selected_store] if selected_store is not None else [] ),
    )
    endpoints = query.order_by(WebhookEndpoint.created_at.desc()).limit(limit).all()
    response = []
    for endpoint in endpoints:
        total = db.query(func.count(WebhookDelivery.id)).filter(WebhookDelivery.endpoint_id == endpoint.id).scalar() or 0
        failed = db.query(func.count(WebhookDelivery.id)).filter(WebhookDelivery.endpoint_id == endpoint.id, WebhookDelivery.status == "failed").scalar() or 0
        response.append(WebhookResponse(id=str(endpoint.id), environment=endpoint.environment, url=endpoint.url, events=endpoint.events or [], is_active=endpoint.is_active, created_at=endpoint.created_at, store_id=str(endpoint.store_id) if endpoint.store_id else None, failure_rate=round((failed / total) * 100, 2) if total else 0.0))
    return response


@router.post("/{endpoint_id}/disable", response_model=WebhookResponse)
def disable_webhook(endpoint_id: UUID, store_id: str | None = Query(default=None), db: Session = Depends(get_database), current: ApiKey = Depends(require_api_scope("webhooks:manage"))):
    selected_store = current.store_id
    if store_id:
        try: selected_store = UUID(store_id)
        except ValueError as exc: raise HTTPException(422, "Invalid store_id") from exc
        if current.store_id is not None and selected_store != current.store_id: raise HTTPException(403, "API key is restricted to its store")
    endpoint = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == endpoint_id, WebhookEndpoint.merchant_id == current.merchant_id, *( [WebhookEndpoint.store_id == selected_store] if selected_store is not None else [] )).first()
    if endpoint is None or endpoint.environment != current.environment:
        raise HTTPException(404, "Webhook endpoint not found")
    endpoint.is_active = False
    db.commit(); db.refresh(endpoint)
    return WebhookResponse(id=str(endpoint.id), environment=endpoint.environment, url=endpoint.url, events=endpoint.events or [], is_active=endpoint.is_active, created_at=endpoint.created_at, store_id=str(endpoint.store_id) if endpoint.store_id else None)


@router.post("/{endpoint_id}/test", response_model=WebhookTestResponse)
def test_webhook(
    endpoint_id: UUID,
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("webhooks:manage")),
):
    selected_store = current.store_id
    if store_id:
        try: selected_store = UUID(store_id)
        except ValueError as exc: raise HTTPException(422, "Invalid store_id") from exc
        if current.store_id is not None and selected_store != current.store_id:
            raise HTTPException(403, "API key is restricted to its store")
    endpoint = db.query(WebhookEndpoint).filter(
        WebhookEndpoint.id == endpoint_id,
        WebhookEndpoint.merchant_id == current.merchant_id,
        WebhookEndpoint.environment == current.environment,
        *( [WebhookEndpoint.store_id == selected_store] if selected_store is not None else [] ),
        WebhookEndpoint.is_active.is_(True),
    ).first()
    if endpoint is None:
        raise HTTPException(404, "Webhook endpoint not found")
    payload = {
        "event": "webhook.test",
        "test": True,
        "environment": current.environment,
        "message": "ORDIUM test webhook delivery",
    }
    # Reuse the production delivery path so test pings receive the same
    # signing headers, redirect policy, and destination validation.
    delivery = WebhookDelivery(
        endpoint_id=endpoint.id, environment=current.environment, event_id=uuid4(),
        event_type="webhook.test", payload=payload, status="pending", attempts=0,
    )
    db.add(delivery); db.commit(); db.refresh(delivery)
    try:
        from scripts.dispatch_webhooks import dispatch_delivery
        success, error, status_code, duration_ms = dispatch_delivery(db, delivery.id)
    except Exception as exc:
        delivery.status = "failed"; delivery.last_error = type(exc).__name__; db.commit()
        raise HTTPException(502, "Webhook test delivery failed") from exc
    return WebhookTestResponse(delivery_id=str(delivery.id), status_code=status_code, success=success, duration_ms=duration_ms, error=error)
