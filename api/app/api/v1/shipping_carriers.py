from dataclasses import asdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.api.store_scope import requested_store_id
from app.models.api_key import ApiKey
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.schemas.shipping import (
    CarrierAccountCreate, CarrierAccountResponse, CarrierListResponse, CarrierWarehouseResponse,
)
from app.services.audit_service import AuditService
from app.services.carrier_account_service import CarrierAccountService, CarrierAlreadyLinked, CarrierInUse
from app.services.carriers.base import CarrierAuthError, CarrierError
from app.services.carriers.registry import CarrierNotAvailable, available_carriers

router = APIRouter(prefix="/shipping/carriers", tags=["Shipping"])


def _get_account(db: Session, api_key: ApiKey, account_id: str, store_id: str | None) -> CarrierAccount:
    try:
        parsed = UUID(account_id)
    except ValueError as exc:
        raise HTTPException(404, "Carrier account not found") from exc
    selected = requested_store_id(db, api_key, store_id)
    query = db.query(CarrierAccount).filter(
        CarrierAccount.id == parsed, CarrierAccount.merchant_id == api_key.merchant_id,
        CarrierAccount.environment == api_key.environment,
    )
    if selected is not None:
        query = query.filter(CarrierAccount.store_id == selected)
    account = query.first()
    if account is None:
        raise HTTPException(404, "Carrier account not found")
    return account


def _audit(db: Session, api_key: ApiKey, action: str, account: CarrierAccount, **meta) -> None:
    AuditService(db).record(
        action=action, resource_type="carrier_account", resource_id=account.id,
        merchant_id=api_key.merchant_id, api_key_id=api_key.id, environment=api_key.environment,
        metadata={"carrier_code": account.carrier_code, **meta},
    )


@router.get("", response_model=CarrierListResponse)
def list_carriers(store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                  api_key: ApiKey = Depends(require_api_scope("shipping:read"))):
    selected = requested_store_id(db, api_key, store_id)
    query = db.query(CarrierAccount).filter(
        CarrierAccount.merchant_id == api_key.merchant_id, CarrierAccount.environment == api_key.environment)
    if selected is not None:
        query = query.filter(CarrierAccount.store_id == selected)
    accounts = query.order_by(CarrierAccount.created_at.asc()).all()
    available = [{**item, "capabilities": asdict(item["capabilities"])} for item in available_carriers(api_key.environment)]
    return {"accounts": accounts, "available": available}


@router.post("", response_model=CarrierAccountResponse, status_code=status.HTTP_201_CREATED)
def link_carrier(data: CarrierAccountCreate, store_id: str | None = Query(default=None),
                 db: Session = Depends(get_database), api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    selected = requested_store_id(db, api_key, store_id)
    if selected is None:
        raise HTTPException(422, "store_id_required")
    try:
        account = CarrierAccountService(db).link(
            api_key.merchant_id, selected, api_key.environment, data.carrier_code, data.display_name, data.credentials)
    except CarrierAlreadyLinked as exc:
        raise HTTPException(409, "carrier_already_linked") from exc
    except CarrierNotAvailable as exc:
        raise HTTPException(409, "carrier_not_available") from exc
    except CarrierAuthError as exc:
        raise HTTPException(422, "carrier_auth_failed") from exc
    except CarrierError as exc:
        raise HTTPException(422, "carrier_link_failed") from exc
    _audit(db, api_key, "carrier_account.linked", account, store_id=str(selected))
    db.commit()
    db.refresh(account)
    return account


@router.post("/{account_id}/test", response_model=CarrierAccountResponse)
def test_carrier(account_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                 api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    account = _get_account(db, api_key, account_id, store_id)
    try:
        CarrierAccountService(db).test(account)
    except CarrierNotAvailable as exc:
        db.commit()
        raise HTTPException(409, "carrier_not_available") from exc
    except CarrierAuthError as exc:
        db.commit()
        raise HTTPException(422, "carrier_auth_failed") from exc
    except CarrierError as exc:
        db.commit()
        raise HTTPException(502, "carrier_unreachable") from exc
    _audit(db, api_key, "carrier_account.tested", account)
    db.commit()
    db.refresh(account)
    return account


@router.post("/{account_id}/disable", response_model=CarrierAccountResponse)
def disable_carrier(account_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                    api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    account = _get_account(db, api_key, account_id, store_id)
    CarrierAccountService(db).disable(account)
    _audit(db, api_key, "carrier_account.disabled", account)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_carrier(account_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                   api_key: ApiKey = Depends(require_api_scope("shipping:write"))):
    account = _get_account(db, api_key, account_id, store_id)
    try:
        CarrierAccountService(db).delete(account)
    except CarrierInUse as exc:
        raise HTTPException(409, "carrier_in_use") from exc
    _audit(db, api_key, "carrier_account.deleted", account)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{account_id}/warehouses", response_model=list[CarrierWarehouseResponse])
def list_warehouses(account_id: str, store_id: str | None = Query(default=None), db: Session = Depends(get_database),
                    api_key: ApiKey = Depends(require_api_scope("shipping:read"))):
    account = _get_account(db, api_key, account_id, store_id)
    return db.query(CarrierWarehouse).filter(CarrierWarehouse.carrier_account_id == account.id).order_by(CarrierWarehouse.name).all()
