from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.api_key import ApiKey
from app.models.store import Store


def ensure_store(db: Session, merchant_id: UUID, store_id: UUID | None) -> Store:
    if store_id is not None:
        store = db.query(Store).filter(Store.id == store_id, Store.merchant_id == merchant_id, Store.is_active.is_(True)).first()
        if store is None:
            raise HTTPException(404, "Store not found")
        return store
    store = db.query(Store).filter(Store.merchant_id == merchant_id, Store.is_active.is_(True)).order_by(Store.created_at.asc()).first()
    if store is None:
        raise HTTPException(409, "No active store is configured")
    return store


def requested_store_id(db: Session, api_key: ApiKey, raw_store_id: str | None) -> UUID | None:
    if api_key.store_id is not None:
        if raw_store_id and raw_store_id != str(api_key.store_id):
            raise HTTPException(403, "API key is restricted to its store")
        return api_key.store_id
    if raw_store_id:
        try:
            store_id = UUID(raw_store_id)
        except ValueError as exc:
            raise HTTPException(422, "Invalid store_id") from exc
        ensure_store(db, api_key.merchant_id, store_id)
        return store_id
    return None
