from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.internal.dependencies import require_internal_service
from app.api.dependencies import get_database
from app.core.business_context import normalize_category, normalize_categories
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.models.api_key import ApiKey
from app.models.store import Store
from app.schemas.api_key import AVAILABLE_API_KEY_SCOPES
from app.schemas.merchant_internal import MerchantApiKeyRequest, MerchantApiKeyResponse, MerchantProvisionRequest, MerchantProvisionResponse, MerchantStoreResponse
from app.services.api_key_service import ApiKeyService

router = APIRouter(prefix="/merchants", tags=["Internal"], include_in_schema=False)


@router.post("/provision", response_model=MerchantProvisionResponse)
def provision_merchant(data: MerchantProvisionRequest, db: Session = Depends(get_database), _=Depends(require_internal_service)):
    email = data.email.strip().lower()
    existing = db.scalar(select(Merchant).where(Merchant.email == email))
    if existing is not None:
        # Provisioning is intentionally self-healing: older merchants created before
        # Store became mandatory must also receive a default active Store.
        store = (
            db.query(Store)
            .filter(Store.merchant_id == existing.id, Store.is_active.is_(True))
            .order_by(Store.created_at.asc())
            .first()
        )
        if store is None:
            db.add(Store(
                merchant_id=existing.id,
                name=f"{existing.name} Store",
                slug=f"seed-{str(existing.id).replace('-', '')[:12]}",
                is_active=True,
            ))
            db.commit()
        return MerchantProvisionResponse(merchant_id=str(existing.id), status=existing.status.value)
    merchant = Merchant(
        name=data.name.strip(),
        email=email,
        primary_business_category=normalize_category(data.business_type),
        secondary_business_categories=normalize_categories(data.secondary_business_categories),
    )
    db.add(merchant)
    db.flush()
    # Store provisioning is part of merchant provisioning, not a later UI concern.
    # Keeping this in the same transaction guarantees a newly created merchant is
    # immediately usable by the dashboard/simulator.
    store = Store(
        merchant_id=merchant.id,
        name=f"{merchant.name} Store",
        slug=f"seed-{str(merchant.id).replace('-', '')[:12]}",
        is_active=True,
    )
    db.add(store)
    db.commit()
    db.refresh(merchant)
    return MerchantProvisionResponse(merchant_id=str(merchant.id), status=merchant.status.value)


@router.post("/{merchant_id}/activate", response_model=MerchantProvisionResponse)
def activate_merchant(merchant_id: UUID, db: Session = Depends(get_database), _=Depends(require_internal_service)):
    merchant = db.scalar(select(Merchant).where(Merchant.id == merchant_id))
    if merchant is None:
        raise HTTPException(status_code=404, detail="Merchant not found")
    merchant.status = MerchantStatus.ACTIVE
    db.commit()
    db.refresh(merchant)
    return MerchantProvisionResponse(merchant_id=str(merchant.id), status=merchant.status.value)


@router.post("/{merchant_id}/api-keys", response_model=MerchantApiKeyResponse)
def create_initial_api_key(merchant_id: UUID, data: MerchantApiKeyRequest, db: Session = Depends(get_database), _=Depends(require_internal_service)):
    merchant = db.scalar(select(Merchant).where(Merchant.id == merchant_id))
    if merchant is None:
        raise HTTPException(status_code=404, detail="Merchant not found")
    if not set(data.scopes).issubset(AVAILABLE_API_KEY_SCOPES):
        raise HTTPException(status_code=422, detail="Invalid API key scopes")
    key, raw = ApiKeyService(db).create_key(merchant, data.name.strip(), data.environment, data.scopes, key_kind="system")
    db.commit()
    return MerchantApiKeyResponse(merchant_id=str(merchant.id), api_key_id=str(key.id), api_key=raw, environment=key.environment, scopes=key.scopes or [])


@router.post("/{merchant_id}/api-keys/{api_key_id}/revoke")
def revoke_internal_api_key(merchant_id: UUID, api_key_id: UUID, db: Session = Depends(get_database), _=Depends(require_internal_service)):
    key = db.scalar(select(ApiKey).where(ApiKey.id == api_key_id, ApiKey.merchant_id == merchant_id))
    if key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    db.commit()
    return {"status": "revoked"}


@router.post("/{merchant_id}/stores", response_model=MerchantStoreResponse)
def ensure_internal_store(merchant_id: UUID, db: Session = Depends(get_database), _=Depends(require_internal_service)):
    merchant = db.scalar(select(Merchant).where(Merchant.id == merchant_id))
    if merchant is None:
        raise HTTPException(status_code=404, detail="Merchant not found")
    store = (
        db.query(Store)
        .filter(Store.merchant_id == merchant_id, Store.is_active.is_(True))
        .order_by(Store.created_at.asc())
        .first()
    )
    if store is None:
        store = Store(merchant_id=merchant_id, name=f"{merchant.name} Store", slug=f"seed-{str(merchant_id).replace('-', '')[:12]}", is_active=True)
        db.add(store)
        db.flush()
    db.commit()
    db.refresh(store)
    return MerchantStoreResponse(merchant_id=str(merchant_id), store_id=str(store.id), name=store.name, slug=store.slug)
