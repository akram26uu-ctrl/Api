from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.models.api_key import ApiKey
from app.models.store import Store
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyResponse
from app.services.api_key_service import ApiKeyService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api-keys", tags=["API Keys"])


@router.post("", response_model=ApiKeyCreateResponse, status_code=201)
def create_api_key(
    request: Request,
    data: ApiKeyCreate,
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    if data.environment != "live" or current.environment != "live":
        raise HTTPException(403, "Customer API keys can only be created for live traffic")
    if not set(data.scopes).issubset(set(current.scopes or [])):
        raise HTTPException(403, "Requested scopes exceed the permissions of the current API key")
    try:
        store_id = UUID(data.store_id) if data.store_id else current.store_id
    except ValueError as exc:
        raise HTTPException(422, "Invalid store_id") from exc
    if current.store_id is not None and store_id != current.store_id:
        raise HTTPException(403, "API key is restricted to its store")
    if store_id is None:
        raise HTTPException(422, "store_id is required")
    key, raw = ApiKeyService(db).create_key(current.merchant, data.name, data.environment, data.scopes, store_id=store_id)
    if data.expires_at is not None:
        key.expires_at = data.expires_at
    AuditService(db).record(
        action="api_key.created", resource_type="api_key", resource_id=key.id,
        merchant_id=current.merchant_id, api_key_id=current.id,
        environment=key.environment, request_id=getattr(request.state, "request_id", None),
        metadata={"created_environment": key.environment},
    )
    db.commit(); db.refresh(key)
    return ApiKeyCreateResponse(id=str(key.id), name=key.name, environment=key.environment, scopes=key.scopes, api_key=raw, expires_at=key.expires_at, store_id=str(key.store_id) if key.store_id else None)


@router.get("", response_model=list[ApiKeyResponse])
def list_api_keys(
    limit: int = Query(default=100, ge=1, le=100),
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    selected_store = current.store_id
    if store_id:
        try: selected_store = UUID(store_id)
        except ValueError as exc: raise HTTPException(422, "Invalid store_id") from exc
        if current.store_id is not None and selected_store != current.store_id: raise HTTPException(403, "API key is restricted to its store")
    query = db.query(ApiKey).filter(ApiKey.merchant_id == current.merchant_id, ApiKey.environment == current.environment)
    if selected_store is not None:
        query = query.filter(ApiKey.store_id == selected_store)
    keys = query.filter(ApiKey.key_kind == "customer").order_by(ApiKey.created_at.desc()).limit(limit).all()
    return [ApiKeyResponse(id=str(k.id), name=k.name, environment=k.environment, scopes=k.scopes or [], is_active=k.is_active, created_at=k.created_at, last_used_at=k.last_used_at, expires_at=k.expires_at, store_id=str(k.store_id) if k.store_id else None) for k in keys]


@router.post("/{api_key_id}/revoke", response_model=ApiKeyResponse)
def revoke_api_key(
    api_key_id: UUID,
    request: Request,
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    selected_store = current.store_id
    if store_id:
        try: selected_store = UUID(store_id)
        except ValueError as exc: raise HTTPException(422, "Invalid store_id") from exc
        if current.store_id is not None and selected_store != current.store_id: raise HTTPException(403, "API key is restricted to its store")
    key = db.query(ApiKey).filter(ApiKey.id == api_key_id, ApiKey.merchant_id == current.merchant_id).first()
    if key is None:
        raise HTTPException(404, "API key not found")
    if key.environment != current.environment:
        raise HTTPException(404, "API key not found")
    if selected_store is not None and key.store_id != selected_store:
        raise HTTPException(404, "API key not found")
    if key.key_kind != "customer":
        raise HTTPException(404, "API key not found")
    if key.id == current.id:
        raise HTTPException(400, "The currently authenticated key cannot revoke itself")
    key.is_active = False
    AuditService(db).record(action="api_key.revoked", resource_type="api_key", resource_id=key.id, merchant_id=current.merchant_id, api_key_id=current.id, environment=key.environment, request_id=getattr(request.state, "request_id", None))
    db.commit(); db.refresh(key)
    return ApiKeyResponse(id=str(key.id), name=key.name, environment=key.environment, scopes=key.scopes or [], is_active=key.is_active, created_at=key.created_at, last_used_at=key.last_used_at, expires_at=key.expires_at, store_id=str(key.store_id) if key.store_id else None)


@router.post("/{api_key_id}/rotate", response_model=ApiKeyCreateResponse)
def rotate_api_key(
    api_key_id: UUID,
    request: Request,
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    selected_store = current.store_id
    if store_id:
        try: selected_store = UUID(store_id)
        except ValueError as exc: raise HTTPException(422, "Invalid store_id") from exc
        if current.store_id is not None and selected_store != current.store_id: raise HTTPException(403, "API key is restricted to its store")
    key = db.query(ApiKey).filter(ApiKey.id == api_key_id, ApiKey.merchant_id == current.merchant_id).first()
    if key is None:
        raise HTTPException(404, "API key not found")
    if key.environment != current.environment:
        raise HTTPException(404, "API key not found")
    if selected_store is not None and key.store_id != selected_store:
        raise HTTPException(404, "API key not found")
    if not set(key.scopes or []).issubset(set(current.scopes or [])):
        raise HTTPException(403, "The target API key has scopes beyond the permissions of the current API key")
    service = ApiKeyService(db)
    new_key, raw = service.create_key(current.merchant, key.name, key.environment, key.scopes or [], key_kind="customer", store_id=key.store_id)
    new_key.expires_at = key.expires_at
    key.is_active = False
    AuditService(db).record(action="api_key.rotated", resource_type="api_key", resource_id=new_key.id, merchant_id=current.merchant_id, api_key_id=current.id, environment=new_key.environment, request_id=getattr(request.state, "request_id", None), metadata={"replaced_key_id": str(key.id)})
    db.commit(); db.refresh(new_key)
    return ApiKeyCreateResponse(id=str(new_key.id), name=new_key.name, environment=new_key.environment, scopes=new_key.scopes or [], api_key=raw, expires_at=new_key.expires_at, store_id=str(new_key.store_id) if new_key.store_id else None)
