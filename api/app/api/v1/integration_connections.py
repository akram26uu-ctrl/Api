import base64
import hashlib
import secrets
from datetime import datetime
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.core.config import settings
from app.models.api_key import ApiKey
from app.models.store import Store
from app.models.store_integration import StoreIntegration
from app.services.audit_service import AuditService

router = APIRouter(prefix="/integrations", tags=["Store integrations"])

# Derive a dedicated encryption key; do not reuse SECRET_KEY directly as a Fernet key.
def _cipher() -> Fernet:
    key = base64.urlsafe_b64encode(
        hashlib.sha256((settings.secret_key + ":store-integrations:v1").encode()).digest()
    )
    return Fernet(key)


def encrypt_webhook_secret(value: str) -> str:
    return _cipher().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_webhook_secret(value: str) -> str:
    try:
        return _cipher().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(503, "Integration secret cannot be decrypted; verify the ORDIUM encryption key") from exc


class IntegrationCreate(BaseModel):
    store_id: UUID
    platform: str = Field(min_length=2, max_length=40, pattern=r"^[a-z][a-z0-9_-]*$")
    external_store_id: str = Field(min_length=1, max_length=255)
    display_name: str = Field(min_length=2, max_length=150)

    @field_validator("external_store_id", "display_name")
    @classmethod
    def strip_strings(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class IntegrationResponse(BaseModel):
    id: UUID
    store_id: UUID
    platform: str
    external_store_id: str
    display_name: str
    is_active: bool
    webhook_url: str
    created_at: datetime
    last_event_at: datetime | None = None


def _response(item: StoreIntegration) -> IntegrationResponse:
    # The endpoint URL is stable and shared by every tenant; tenant resolution is data-driven.
    webhook_url = f"/api/v1/integrations/webhooks/{item.platform}"
    return IntegrationResponse(
        id=item.id,
        store_id=item.store_id,
        platform=item.platform,
        external_store_id=item.external_store_id,
        display_name=item.display_name,
        is_active=item.is_active,
        webhook_url=webhook_url,
        created_at=item.created_at,
        last_event_at=item.last_event_at,
    )


@router.get("/connections", response_model=list[IntegrationResponse])
def list_connections(
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    items = (
        db.query(StoreIntegration)
        .filter(StoreIntegration.merchant_id == current.merchant_id)
        .order_by(StoreIntegration.created_at.desc())
        .all()
    )
    return [_response(item) for item in items]


@router.post("/connections", status_code=201)
def create_connection(
    data: IntegrationCreate,
    request: Request,
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    store = db.query(Store).filter(
        Store.id == data.store_id,
        Store.merchant_id == current.merchant_id,
        Store.is_active.is_(True),
    ).first()
    if store is None:
        raise HTTPException(404, "Active store not found for this merchant")

    existing = db.query(StoreIntegration).filter(
        StoreIntegration.platform == data.platform,
        StoreIntegration.external_store_id == data.external_store_id,
    ).first()
    if existing is not None:
        # Do not disclose which merchant owns an external store identifier.
        raise HTTPException(409, "This external store is already connected")

    secret = secrets.token_urlsafe(32)
    item = StoreIntegration(
        merchant_id=current.merchant_id,
        store_id=store.id,
        platform=data.platform,
        external_store_id=data.external_store_id,
        display_name=data.display_name,
        webhook_secret_encrypted=encrypt_webhook_secret(secret),
        is_active=True,
    )
    db.add(item)
    db.flush()
    AuditService(db).record(
        action="store_integration.created",
        resource_type="store_integration",
        resource_id=item.id,
        merchant_id=current.merchant_id,
        api_key_id=current.id,
        environment=current.environment,
        request_id=getattr(request.state, "request_id", None),
    )
    db.commit()
    db.refresh(item)
    return {
        **_response(item).model_dump(mode="json"),
        # Return only at creation time. The database stores the encrypted value.
        "webhook_secret": secret,
        "webhook_url": f"{settings.allowed_hosts.split(',')[0].strip() if settings.allowed_hosts.strip() else ''}/api/v1/integrations/webhooks/{item.platform}",
        "warning": "Copy the webhook_secret now; it is never returned again.",
    }


@router.patch("/connections/{integration_id}", response_model=IntegrationResponse)
def set_connection_active(
    integration_id: UUID,
    request: Request,
    active: bool,
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    item = db.query(StoreIntegration).filter(
        StoreIntegration.id == integration_id,
        StoreIntegration.merchant_id == current.merchant_id,
    ).first()
    if item is None:
        raise HTTPException(404, "Integration not found")
    item.is_active = active
    AuditService(db).record(
        action="store_integration.updated",
        resource_type="store_integration",
        resource_id=item.id,
        merchant_id=current.merchant_id,
        api_key_id=current.id,
        environment=current.environment,
        request_id=getattr(request.state, "request_id", None),
    )
    db.commit()
    db.refresh(item)
    return _response(item)


@router.delete("/connections/{integration_id}", status_code=204)
def delete_connection(
    integration_id: UUID,
    request: Request,
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    item = db.query(StoreIntegration).filter(
        StoreIntegration.id == integration_id,
        StoreIntegration.merchant_id == current.merchant_id,
    ).first()
    if item is None:
        raise HTTPException(404, "Integration not found")
    AuditService(db).record(
        action="store_integration.deleted",
        resource_type="store_integration",
        resource_id=item.id,
        merchant_id=current.merchant_id,
        api_key_id=current.id,
        environment=current.environment,
        request_id=getattr(request.state, "request_id", None),
    )
    db.delete(item)
    db.commit()
    return None
