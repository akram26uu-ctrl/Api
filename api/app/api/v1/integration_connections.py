import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.core.config import settings
from app.models.api_key import ApiKey
from app.models.store import Store
from app.models.store_integration import StoreIntegration
from app.services.audit_service import AuditService

router = APIRouter(prefix="/integrations", tags=["Store integrations"])
SUPPORTED_PLATFORMS = {"omniterra", "shopify", "woocommerce", "youcan"}


def _cipher() -> Fernet:
    # Dedicated key derivation prevents storing integration secrets as plaintext.
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


def _verify_signature(body: bytes, supplied: str | None, secret: str) -> bool:
    if not supplied or not secret:
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    candidates = {digest.hex(), base64.b64encode(digest).decode("ascii")}
    normalized = supplied.strip()
    if normalized.lower().startswith("sha256="):
        normalized = normalized.split("=", 1)[1]
    return any(hmac.compare_digest(normalized, candidate) for candidate in candidates)


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


def _response(item: StoreIntegration, base_url: str = "") -> IntegrationResponse:
    webhook_url = f"{base_url.rstrip('/')}/api/v1/integrations/webhooks/{item.platform}/{item.id}"
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
    request: Request,
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    items = (
        db.query(StoreIntegration)
        .filter(StoreIntegration.merchant_id == current.merchant_id)
        .order_by(StoreIntegration.created_at.desc())
        .all()
    )
    return [_response(item, str(request.base_url)) for item in items]


@router.post("/connections", status_code=201)
def create_connection(
    data: IntegrationCreate,
    request: Request,
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    if data.platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(422, "Unsupported platform. Supported platforms: omniterra, shopify, woocommerce, youcan")
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
        **_response(item, str(request.base_url)).model_dump(mode="json"),
        "webhook_secret": secret if data.platform != "shopify" else None,
        "webhook_secret_note": (
            "Shopify app webhooks use the app-level SHOPIFY_WEBHOOK_SECRET configured by ORDIUM."
            if data.platform == "shopify"
            else "Copy the webhook_secret now. It is never returned again."
        ),
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
    return _response(item, str(request.base_url))


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
    return Response(status_code=204)


@router.post("/webhooks/{platform}/{integration_id}")
async def receive_store_webhook(
    platform: str,
    integration_id: UUID,
    request: Request,
    db: Session = Depends(get_database),
):
    """Shared receiver; each integration has an isolated signing secret and tenant mapping."""
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(404, "Unsupported integration platform")
    integration = db.query(StoreIntegration).filter(
        StoreIntegration.id == integration_id,
        StoreIntegration.platform == platform,
        StoreIntegration.is_active.is_(True),
    ).first()
    if integration is None:
        raise HTTPException(404, "Active integration not found")

    raw_body = await request.body()
    if len(raw_body) > settings.max_request_body_bytes:
        raise HTTPException(413, "Webhook body too large")

    # Shopify signs app webhooks with the app-level secret, not a per-shop webhook secret.
    if platform == "shopify":
        secret = settings.shopify_webhook_secret
        if not secret:
            raise HTTPException(503, "Shopify app webhook signing is not configured in ORDIUM")
    else:
        secret = decrypt_webhook_secret(integration.webhook_secret_encrypted)
    signature_headers = {
        "omniterra": ("X-Omniterra-Hmac-Sha256", "X-NDC-Hmac-Sha256", "X-Shopify-Hmac-Sha256"),
        "shopify": ("X-Shopify-Hmac-Sha256",),
        "woocommerce": ("X-WC-Webhook-Signature",),
        "youcan": ("X-YouCan-Hmac-Sha256", "X-YouCan-Signature"),
    }[platform]
    signature = next((request.headers.get(name) for name in signature_headers if request.headers.get(name)), None)
    if not _verify_signature(raw_body, signature, secret):
        raise HTTPException(401, "Invalid store webhook signature")

    try:
        payload = json.loads(raw_body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(400, "Invalid webhook JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid webhook payload")

    topic = (
        payload.get("event") or payload.get("topic") or payload.get("type")
        or request.headers.get("X-Omniterra-Topic")
        or request.headers.get("X-NDC-Topic")
        or request.headers.get("X-Shopify-Topic")
        or request.headers.get("X-WC-Webhook-Topic")
        or ""
    ).strip().lower()
    allowed_topics = {
        "omniterra": {"order.created", "orders/create", "order_created"},
        "shopify": {"orders/create", "order.created", "order_created"},
        "woocommerce": {"order.created", "order.created", "woocommerce_order_created"},
        "youcan": {"order.created", "orders/create", "order_created"},
    }[platform]
    if topic not in allowed_topics:
        raise HTTPException(400, "Unsupported or missing order-created event topic")

    order = payload.get("data") if isinstance(payload.get("data"), dict) else payload.get("order")
    if not isinstance(order, dict):
        order = payload
    external_order_id = order.get("id") or order.get("order_id") or order.get("name")
    if external_order_id is None:
        raise HTTPException(422, "Webhook payload is missing the external order ID")

    from app.api.v1.integrations import _ingest
    stable_event_id = (
        request.headers.get("X-Omniterra-Webhook-Id")
        or request.headers.get("X-NDC-Webhook-Id")
        or request.headers.get("X-Shopify-Webhook-Id")
        or request.headers.get("X-WC-Webhook-ID")
        or payload.get("webhook_id")
        or f"{platform}:{external_order_id}"
    )
    # _ingest owns a separate DB session for order creation; this session only tracks connection metadata.
    result = _ingest(
        order,
        integration.merchant_id,
        integration.store_id,
        f"{platform}:{integration.id}:{stable_event_id}",
    )
    integration.last_event_at = datetime.now(timezone.utc)
    db.commit()
    return result
