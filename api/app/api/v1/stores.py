import re
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.models.api_key import ApiKey
from app.models.order import Order
from app.models.store import Store
from app.schemas.store import StoreCreate, StoreResponse, StoreUpdate
from app.services.audit_service import AuditService

router = APIRouter(prefix="/stores", tags=["Stores"])


def _slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:100] or "store"


def _resolve_slug(db: Session, merchant_id: UUID, value: str) -> str:
    base = _slug(value)
    candidate = base
    n = 2
    while db.query(Store).filter(Store.merchant_id == merchant_id, Store.slug == candidate).first() is not None:
        candidate = f"{base[:95]}-{n}"
        n += 1
    return candidate


def _serialize(store: Store, db: Session) -> StoreResponse:
    count = db.query(func.count(Order.id)).filter(Order.merchant_id == store.merchant_id, Order.store_id == store.id).scalar() or 0
    return StoreResponse(id=str(store.id), name=store.name, slug=store.slug, is_active=store.is_active, created_at=store.created_at, order_count=int(count))


@router.get("", response_model=list[StoreResponse])
def list_stores(db: Session = Depends(get_database), current: ApiKey = Depends(require_api_scope("keys:manage"))):
    stores = db.query(Store).filter(Store.merchant_id == current.merchant_id).order_by(Store.created_at.asc()).all()
    return [_serialize(item, db) for item in stores]


@router.post("", response_model=StoreResponse, status_code=201)
def create_store(request: Request, data: StoreCreate, db: Session = Depends(get_database), current: ApiKey = Depends(require_api_scope("keys:manage"))):
    name = data.name.strip()
    slug = _resolve_slug(db, current.merchant_id, data.slug.strip() if data.slug else name)
    store = Store(merchant_id=current.merchant_id, name=name, slug=slug, is_active=True)
    db.add(store); db.flush()
    AuditService(db).record(action="store.created", resource_type="store", resource_id=store.id, merchant_id=current.merchant_id, api_key_id=current.id, environment="live", request_id=getattr(request.state, "request_id", None))
    db.commit(); db.refresh(store)
    return _serialize(store, db)


@router.patch("/{store_id}", response_model=StoreResponse)
def update_store(store_id: UUID, request: Request, data: StoreUpdate, db: Session = Depends(get_database), current: ApiKey = Depends(require_api_scope("keys:manage"))):
    store = db.query(Store).filter(Store.id == store_id, Store.merchant_id == current.merchant_id).first()
    if store is None:
        raise HTTPException(404, "Store not found")
    store.name = data.name.strip(); store.is_active = data.is_active
    AuditService(db).record(action="store.updated", resource_type="store", resource_id=store.id, merchant_id=current.merchant_id, api_key_id=current.id, environment="live", request_id=getattr(request.state, "request_id", None))
    db.commit(); db.refresh(store)
    return _serialize(store, db)
