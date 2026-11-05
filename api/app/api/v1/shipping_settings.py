from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.api.store_scope import requested_store_id
from app.models.api_key import ApiKey
from app.models.carrier_account import CarrierAccount
from app.models.shipping_settings import ShippingRoute
from app.schemas.shipping import (
    ShippingRouteResponse, ShippingRouteWrite, ShippingSettingsResponse, ShippingSettingsUpdate,
)
from app.services.audit_service import AuditService
from app.services.shipping_settings_service import ShippingSettingsService

router = APIRouter(prefix="/shipping", tags=["Shipping"])


def _store(db: Session, api_key: ApiKey, store_id: str | None) -> UUID:
    selected = requested_store_id(db, api_key, store_id)
    if selected is None:
        raise HTTPException(422, "store_id_required")
    return selected


def _audit(db: Session, api_key: ApiKey, action: str, resource_type: str, resource_id, **meta) -> None:
    AuditService(db).record(
        action=action, resource_type=resource_type, resource_id=resource_id,
        merchant_id=api_key.merchant_id, api_key_id=api_key.id, environment=api_key.environment, metadata=meta,
    )


@router.get("/settings", response_model=ShippingSettingsResponse)
def get_settings(store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                 api_key: ApiKey = Depends(require_api_scope("shipping:read"))):
    selected = _store(db, api_key, store_id)
    settings = ShippingSettingsService(db).get_or_default(selected)
    db.commit()
    return settings


@router.put("/settings", response_model=ShippingSettingsResponse)
def update_settings(data: ShippingSettingsUpdate, store_id: str | None = Query(default=None),
                    db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    selected = _store(db, api_key, store_id)
    changes = data.model_dump(exclude_unset=True)
    settings = ShippingSettingsService(db).update(selected, changes)
    _audit(db, api_key, "shipping_settings.updated", "shipping_settings", settings.id, store_id=str(selected),
           fields=sorted(changes))
    db.commit()
    db.refresh(settings)
    return settings


def _validate_route(db: Session, api_key: ApiKey, store: UUID, data: ShippingRouteWrite) -> None:
    ids = {data.carrier_account_id}
    if data.fallback_carrier_account_id:
        if data.fallback_carrier_account_id == data.carrier_account_id:
            raise HTTPException(422, "fallback_same_as_primary")
        ids.add(data.fallback_carrier_account_id)
    found = db.query(CarrierAccount.id).filter(
        CarrierAccount.id.in_(ids), CarrierAccount.store_id == store,
        CarrierAccount.merchant_id == api_key.merchant_id, CarrierAccount.environment == api_key.environment).count()
    if found != len(ids):
        raise HTTPException(422, "carrier_account_invalid")


def _get_route(db: Session, api_key: ApiKey, route_id: str, store: UUID) -> ShippingRoute:
    try:
        parsed = UUID(route_id)
    except ValueError as exc:
        raise HTTPException(404, "Route not found") from exc
    route = db.query(ShippingRoute).filter(
        ShippingRoute.id == parsed, ShippingRoute.store_id == store,
        ShippingRoute.merchant_id == api_key.merchant_id).first()
    if route is None:
        raise HTTPException(404, "Route not found")
    return route


@router.get("/routes", response_model=list[ShippingRouteResponse])
def list_routes(store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                api_key: ApiKey = Depends(require_api_scope("shipping:read"))):
    selected = _store(db, api_key, store_id)
    return db.query(ShippingRoute).join(
        CarrierAccount, CarrierAccount.id == ShippingRoute.carrier_account_id,
    ).filter(
        ShippingRoute.store_id == selected, ShippingRoute.merchant_id == api_key.merchant_id,
        CarrierAccount.environment == api_key.environment,
    ).order_by(ShippingRoute.priority.asc(), ShippingRoute.id.asc()).all()


@router.post("/routes", response_model=ShippingRouteResponse, status_code=status.HTTP_201_CREATED)
def create_route(data: ShippingRouteWrite, store_id: str | None = Query(default=None),
                 db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    selected = _store(db, api_key, store_id)
    _validate_route(db, api_key, selected, data)
    route = ShippingRoute(merchant_id=api_key.merchant_id, store_id=selected, **data.model_dump())
    db.add(route)
    db.flush()
    _audit(db, api_key, "shipping_route.created", "shipping_route", route.id, store_id=str(selected),
           wilaya_codes=route.wilaya_codes)
    db.commit()
    db.refresh(route)
    return route


@router.put("/routes/{route_id}", response_model=ShippingRouteResponse)
def update_route(route_id: str, data: ShippingRouteWrite, store_id: str | None = Query(default=None),
                 db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    selected = _store(db, api_key, store_id)
    route = _get_route(db, api_key, route_id, selected)
    _validate_route(db, api_key, selected, data)
    for key, value in data.model_dump().items():
        setattr(route, key, value)
    _audit(db, api_key, "shipping_route.updated", "shipping_route", route.id, store_id=str(selected))
    db.commit()
    db.refresh(route)
    return route


@router.delete("/routes/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(route_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                 api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    selected = _store(db, api_key, store_id)
    route = _get_route(db, api_key, route_id, selected)
    _audit(db, api_key, "shipping_route.deleted", "shipping_route", route.id, store_id=str(selected))
    db.delete(route)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
