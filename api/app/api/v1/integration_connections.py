import base64
import hashlib
import hmac
import json
import logging
import re
import secrets
from collections.abc import Mapping
from datetime import datetime, timezone
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.core.config import settings
from app.models.api_key import ApiKey
from app.models.store import Store
from app.models.notification import Notification
from app.models.store_integration import StoreIntegration
from app.services.audit_service import AuditService

logger = logging.getLogger("ordium.integrations")
router = APIRouter(prefix="/integrations", tags=["Store integrations"])
SUPPORTED_PLATFORMS = {"omniterra", "shopify", "woocommerce", "youcan", "custom"}
# Platforms whose webhooks are signed with a secret the platform issues (shown to the merchant
# in the platform admin) rather than one ORDIUM generates and the merchant pastes into the store.
PROVIDER_SIGNED_PLATFORMS = {"shopify", "youcan"}
# Placeholder stored until the merchant pastes the platform-issued secret. It is never revealed,
# so no delivery can verify against it: the connection stays closed until configured.
UNSET_SECRET_PREFIX = "ordium-unset:"
SHOPIFY_DOMAIN = re.compile(r"^[a-z0-9][a-z0-9-]*\.myshopify\.com$")


def public_base_url(request: Request) -> str:
    """Public origin for webhook URLs; falls back to the request origin (tests, local dev)."""
    configured = settings.public_api_base_url.strip().rstrip("/")
    return configured or str(request.base_url).rstrip("/")


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


def _shopify_domain_matches(registered_domain: str, supplied_domain: str | None) -> bool:
    registered = registered_domain.strip().lower().rstrip(".")
    supplied = (supplied_domain or "").strip().lower().rstrip(".")
    return bool(registered and supplied) and hmac.compare_digest(registered, supplied)


def _ensure_store_scope(current: ApiKey, requested_store_id: UUID) -> None:
    """Reject attempts to manage a store outside a store-scoped API key."""
    if current.store_id is not None and requested_store_id != current.store_id:
        raise HTTPException(403, "API key is restricted to its store")


def _stable_event_id(
    platform: str,
    headers: Mapping[str, str],
    payload: dict,
    external_order_id: str,
) -> str:
    # Order-created events are deduplicated by the store's own order ID. Platform delivery IDs are
    # not reliable for this: WooCommerce derives X-WC-Webhook-Delivery-ID from the webhook ID and
    # the current second, so two orders delivered in the same batch shared one key and the second
    # order was rejected. Retries of one order still map to the same key.
    return f"{platform}:order:{external_order_id}"


class IntegrationCreate(BaseModel):
    store_id: UUID
    platform: str = Field(min_length=2, max_length=40, pattern=r"^[a-z][a-z0-9_-]*$")
    external_store_id: str = Field(min_length=1, max_length=255)
    display_name: str = Field(min_length=2, max_length=150)
    # Signing secret issued by the store platform (Shopify admin webhooks, YouCan).
    webhook_secret: str | None = Field(default=None, min_length=16, max_length=255)

    @field_validator("external_store_id", "display_name")
    @classmethod
    def strip_strings(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("webhook_secret")
    @classmethod
    def strip_secret(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class IntegrationSecretUpdate(BaseModel):
    webhook_secret: str = Field(min_length=16, max_length=255)

    @field_validator("webhook_secret")
    @classmethod
    def strip_secret(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 16:
            raise ValueError("signing secret is too short")
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
    signing_secret_configured: bool = True


def _secret_configured(item: StoreIntegration) -> bool:
    try:
        return not decrypt_webhook_secret(item.webhook_secret_encrypted).startswith(UNSET_SECRET_PREFIX)
    except HTTPException:
        return False


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
        signing_secret_configured=_secret_configured(item),
    )


@router.get("/connections", response_model=list[IntegrationResponse])
def list_connections(
    request: Request,
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    items = (
        db.query(StoreIntegration)
        .filter(
            StoreIntegration.merchant_id == current.merchant_id,
            *(
                [StoreIntegration.store_id == current.store_id]
                if current.store_id is not None
                else []
            ),
        )
        .order_by(StoreIntegration.created_at.desc())
        .all()
    )
    return [_response(item, public_base_url(request)) for item in items]


@router.post("/connections", status_code=201)
def create_connection(
    data: IntegrationCreate,
    request: Request,
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    if data.platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(422, "Unsupported platform. Supported platforms: omniterra, shopify, woocommerce, youcan, custom")
    _ensure_store_scope(current, data.store_id)
    external_store_id = data.external_store_id
    if data.platform == "shopify":
        # Shopify identifies the shop by its permanent *.myshopify.com domain (X-Shopify-Shop-Domain),
        # never by a custom storefront domain.
        external_store_id = external_store_id.lower().removeprefix("https://").removeprefix("http://").strip("/")
        if not SHOPIFY_DOMAIN.fullmatch(external_store_id):
            raise HTTPException(422, "Enter the store's permanent Shopify domain, e.g. your-store.myshopify.com")
    elif data.platform not in PROVIDER_SIGNED_PLATFORMS and data.webhook_secret:
        raise HTTPException(422, "This platform uses a signing secret generated by ORDIUM; do not send one")
    store = db.query(Store).filter(
        Store.id == data.store_id,
        Store.merchant_id == current.merchant_id,
        Store.is_active.is_(True),
    ).first()
    if store is None:
        raise HTTPException(404, "Active store not found for this merchant")

    existing = db.query(StoreIntegration).filter(
        StoreIntegration.platform == data.platform,
        StoreIntegration.external_store_id == external_store_id,
    ).first()
    if existing is not None:
        raise HTTPException(409, "This external store is already connected")

    provider_secret = data.webhook_secret if data.platform in PROVIDER_SIGNED_PLATFORMS else None
    if provider_secret:
        secret = provider_secret
    elif data.platform == "shopify":
        # Shopify issues the signing secret only after its webhook exists; the merchant adds it next.
        secret = UNSET_SECRET_PREFIX + secrets.token_urlsafe(32)
    else:
        secret = secrets.token_urlsafe(32)
    item = StoreIntegration(
        merchant_id=current.merchant_id,
        store_id=store.id,
        platform=data.platform,
        external_store_id=external_store_id,
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
        **_response(item, public_base_url(request)).model_dump(mode="json"),
        # Never echo a secret the merchant supplied; only return one ORDIUM generated for them.
        "webhook_secret": None if provider_secret or data.platform == "shopify" else secret,
        "webhook_secret_note": (
            "ORDIUM verifies deliveries with the signing secret issued by the store platform."
            if provider_secret or data.platform == "shopify"
            else "Copy the webhook_secret now. It is never returned again."
        ),
    }


@router.patch("/connections/{integration_id}", response_model=IntegrationResponse)
def set_connection_active(
    integration_id: UUID,
    request: Request,
    active: bool | None = None,
    secret_update: IntegrationSecretUpdate | None = Body(default=None),
    db: Session = Depends(get_database),
    current: ApiKey = Depends(require_api_scope("keys:manage")),
):
    if active is None and secret_update is None:
        raise HTTPException(422, "Nothing to update")
    item = db.query(StoreIntegration).filter(
        StoreIntegration.id == integration_id,
        StoreIntegration.merchant_id == current.merchant_id,
        *(
            [StoreIntegration.store_id == current.store_id]
            if current.store_id is not None
            else []
        ),
    ).first()
    if item is None:
        raise HTTPException(404, "Integration not found")
    if secret_update is not None:
        if item.platform not in PROVIDER_SIGNED_PLATFORMS:
            raise HTTPException(422, "This platform uses the signing secret generated by ORDIUM")
        item.webhook_secret_encrypted = encrypt_webhook_secret(secret_update.webhook_secret)
    if active is not None:
        item.is_active = active
    AuditService(db).record(
        action="store_integration.secret_updated" if secret_update is not None else "store_integration.updated",
        resource_type="store_integration",
        resource_id=item.id,
        merchant_id=current.merchant_id,
        api_key_id=current.id,
        environment=current.environment,
        request_id=getattr(request.state, "request_id", None),
    )
    db.commit()
    db.refresh(item)
    return _response(item, public_base_url(request))


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
        *(
            [StoreIntegration.store_id == current.store_id]
            if current.store_id is not None
            else []
        ),
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

    # WooCommerce validates a new webhook with a form-encoded "webhook_id=<n>" ping.
    # Acknowledge it without side effects so WooCommerce does not count a failed delivery.
    if platform == "woocommerce" and raw_body.startswith(b"webhook_id="):
        return {"accepted": True, "ping": True}

    # Each connection stores its own secret: generated by ORDIUM, or issued by the platform
    # (Shopify admin webhooks, YouCan). Shopify app webhooks may also use the app-level secret.
    stored_secret = decrypt_webhook_secret(integration.webhook_secret_encrypted)
    secrets_to_try = [] if stored_secret.startswith(UNSET_SECRET_PREFIX) else [stored_secret]
    if platform == "shopify" and settings.shopify_webhook_secret:
        secrets_to_try.append(settings.shopify_webhook_secret)
    signature_headers = {
        "omniterra": ("X-Omniterra-Hmac-Sha256", "X-NDC-Hmac-Sha256", "X-Shopify-Hmac-Sha256"),
        "shopify": ("X-Shopify-Hmac-Sha256",),
        "woocommerce": ("X-WC-Webhook-Signature",),
        "youcan": ("X-YouCan-Hmac-Sha256", "X-YouCan-Signature"),
        # Generic/custom stores use the raw-body HMAC contract documented in README.
        "custom": ("X-ORDIUM-Signature",),
    }[platform]
    signature = next((request.headers.get(name) for name in signature_headers if request.headers.get(name)), None)
    if not secrets_to_try:
        raise HTTPException(401, "This store connection has no signing secret yet; add it in the ORDIUM dashboard")
    if not any(_verify_signature(raw_body, signature, candidate) for candidate in secrets_to_try):
        raise HTTPException(401, "Invalid store webhook signature")

    # Shopify app webhooks use an app-level secret, shared across shops.
    # Bind the signed delivery to the shop registered on this connection.
    if platform == "shopify":
        if not _shopify_domain_matches(
            integration.external_store_id,
            request.headers.get("X-Shopify-Shop-Domain"),
        ):
            raise HTTPException(403, "Shopify webhook domain does not match this integration")

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
        or request.headers.get("X-YouCan-Topic")
        or request.headers.get("X-YouCan-Event")
        or request.headers.get("X-ORDIUM-Topic")
        or ""
    ).strip().lower()
    allowed_topics = {
        "omniterra": {"order.created", "orders/create", "order_created"},
        "shopify": {"orders/create", "order.created", "order_created"},
        # WooCommerce natively emits "order.created" (X-WC-Webhook-Topic) and
        # "order_created" (legacy action payloads); the duplicate "order.created"
        # entry previously masked the missing "order_created" topic.
        "woocommerce": {"order.created", "order_created", "woocommerce_order_created"},
        "youcan": {"order.created", "order.create", "orders.create", "orders/create", "order_created"},
        "custom": {"order.created", "orders/create", "order_created"},
    }[platform]
    # From here the delivery is authenticated. Answer 2xx even when it cannot
    # become an order: WooCommerce disables a webhook after 5 failed
    # deliveries and Shopify removes it after repeated failures, which would
    # silently cut off every later order. Rejections are shown to the
    # merchant as alerts instead. Only transient server errors stay 5xx.
    integration.last_event_at = datetime.now(timezone.utc)
    if topic not in allowed_topics:
        db.commit()
        return {"accepted": True, "ignored": True, "reason": "unsupported_topic"}

    order = payload.get("data") if isinstance(payload.get("data"), dict) else payload.get("order")
    if not isinstance(order, dict):
        order = payload
    external_order_id = order.get("id") or order.get("order_id") or order.get("name")
    if external_order_id is None:
        return _reject_delivery(db, integration, platform, None, "Webhook payload is missing the external order ID")

    from app.api.v1.integrations import _ingest
    stable_event_id = _stable_event_id(platform, request.headers, payload, str(external_order_id))
    # _ingest owns a separate DB session for order creation; this session only tracks connection metadata.
    try:
        # _ingest is blocking (database + network-intelligence lookups); run it off the event loop
        # so one store delivery cannot stall every other API request.
        result = await run_in_threadpool(
            _ingest,
            order,
            integration.merchant_id,
            integration.store_id,
            f"{platform}:{integration.id}:{stable_event_id}",
        )
    except HTTPException as exc:
        # Record why a signed delivery was rejected; details name fields only, never customer data.
        logger.warning(
            "store webhook rejected platform=%s integration=%s status=%s reason=%s",
            platform, integration.id, exc.status_code, exc.detail,
        )
        if exc.status_code >= 500:
            raise
        return _reject_delivery(db, integration, platform, str(external_order_id), str(exc.detail))
    db.commit()
    return result


_REJECTION_REASONS_AR = {
    "usage_quota_exceeded": "تم بلوغ حد الطلبات الشهري لحسابك",
}


def _reject_delivery(db: Session, integration, platform: str, external_order_id: str | None, reason: str) -> dict:
    """Acknowledge a signed delivery that cannot become an order, and tell the
    merchant once per store order (the store may retry the same delivery)."""
    resource_id = f"{platform}:{integration.id}:{external_order_id or 'unknown'}"[:255]
    already = db.query(Notification.id).filter(
        Notification.store_id == integration.store_id,
        Notification.notification_type == "integration.order_rejected",
        Notification.resource_id == resource_id,
    ).first()
    if already is None:
        shown = _REJECTION_REASONS_AR.get(reason, reason)
        db.add(Notification(
            merchant_id=integration.merchant_id,
            store_id=integration.store_id,
            environment="live",
            notification_type="integration.order_rejected",
            severity="warning",
            title="A store order could not be processed",
            message=f"Order {external_order_id or '?'} from {integration.display_name} ({platform}) was not processed: {shown}"[:2000],
            resource_type="store_integration",
            resource_id=resource_id,
            metadata_json={"platform": platform, "external_order_id": external_order_id, "reason": reason[:500]},
        ))
    db.commit()
    return {"accepted": False, "reason": reason}
