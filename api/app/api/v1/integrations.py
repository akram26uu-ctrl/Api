import base64
import hashlib
import hmac
import json
import logging
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import ValidationError
from app.core.config import settings
from app.schemas.order import OrderCreate, OrderItemCreate
from app.services.order_service import OrderService

logger = logging.getLogger("ordium.integrations")
router = APIRouter(prefix="/integrations", tags=["Store integrations"])


def _json_map(raw: str, setting_name: str) -> dict:
    if not raw.strip():
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("%s is not valid JSON", setting_name)
        raise HTTPException(503, "Store integration is not configured correctly") from exc
    if not isinstance(value, dict):
        raise HTTPException(503, "Store integration is not configured correctly")
    return value


def _store_config(mapping: dict, external_store: str) -> tuple[UUID, UUID]:
    config = mapping.get(external_store)
    if not isinstance(config, dict):
        raise HTTPException(403, "External store is not registered with ORDIUM")
    try:
        return UUID(str(config["merchant_id"])), UUID(str(config["store_id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(503, "External store mapping is incomplete") from exc


def _verify_hmac(raw_body: bytes, supplied: str | None, secret: str) -> bool:
    if not supplied or not secret:
        return False
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    candidates = {digest.hex(), base64.b64encode(digest).decode("ascii")}
    normalized = supplied.strip()
    if normalized.lower().startswith("sha256="):
        normalized = normalized.split("=", 1)[1]
    return any(hmac.compare_digest(normalized, candidate) for candidate in candidates)


def _required_text(value, label: str, maximum: int = 255) -> str:
    if value is None:
        raise HTTPException(422, f"Order is missing required field: {label}")
    result = str(value).strip()
    if not result or len(result) > maximum:
        raise HTTPException(422, f"Order has an invalid field: {label}")
    return result


def _money(value, label: str) -> Decimal:
    from app.core.dz_input import parse_amount
    try:
        amount = parse_amount(value)
    except (InvalidOperation, ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(422, f"Order has an invalid amount: {label}") from exc
    if not amount.is_finite():
        raise HTTPException(422, f"Order has an invalid amount: {label}")
    # Platforms derive unit prices as line_total / quantity (e.g. 2500 / 3 = 833.3333 after a
    # discount), so round to cents instead of rejecting the order.
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= 0:
        raise HTTPException(422, f"Order has an invalid amount: {label}")
    return amount


def _quantity(value) -> int:
    try:
        number = Decimal(str(value if value is not None else 1).strip())
    except (InvalidOperation, ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(422, "Order contains an invalid item quantity") from exc
    if not number.is_finite() or number != number.to_integral_value() or number <= 0:
        raise HTTPException(422, "Order contains an invalid item quantity")
    return int(number)


def _is_zero_amount(value) -> bool:
    try:
        return Decimal(str(value)) == 0
    except (InvalidOperation, ValueError, TypeError):
        return False


def _normalize_dz_phone(value):
    """Accept the common store formats of Algerian mobile numbers (e.g. '550 12 34 56')."""
    from app.core.dz_input import normalize_dz_phone
    if value is None:
        return None
    return normalize_dz_phone(value) or value


def _normalize_order(payload: dict, external_order_id: str) -> OrderCreate:
    # Accommodate common native Shopify/YouCan-style fields and WooCommerce's
    # billing/shipping shape. Prefer a real shipping address, falling back to
    # billing only when the store did not provide a usable shipping address.
    billing = next(
        (payload[key] for key in ("billing", "billing_address", "billingAddress") if isinstance(payload.get(key), dict)),
        {},
    )
    customer = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
    customer = customer or billing
    address = (
        payload.get("shipping_address")
        or payload.get("shippingAddress")
        or payload.get("shipping")
        or payload.get("shipping_lines")
        or {}
    )
    if not isinstance(address, dict):
        address = {}
    if not any(address.get(key) for key in ("address1", "address_1", "address", "street", "address_line1", "city", "commune", "town")):
        address = billing or address
    first_name = address.get("first_name") or address.get("firstName") or customer.get("first_name") or customer.get("firstName")
    last_name = address.get("last_name") or address.get("lastName") or customer.get("last_name") or customer.get("lastName")
    if not first_name or not last_name:
        # Some platforms (and many custom checkouts) only send a single full-name field.
        full_name = str(
            address.get("name") or address.get("full_name") or address.get("fullName")
            or customer.get("full_name") or customer.get("fullName") or customer.get("name") or ""
        ).strip()
        parts = full_name.split()
        if parts:
            first_name = first_name or parts[0]
            last_name = last_name or (" ".join(parts[1:]) if len(parts) > 1 else parts[0])
    phone = address.get("phone") or customer.get("phone") or billing.get("phone") or payload.get("phone")
    phone = _normalize_dz_phone(phone)
    city = address.get("city") or address.get("commune") or address.get("town") or customer.get("city")
    province = (
        address.get("province") or address.get("province_code") or address.get("wilaya")
        or address.get("state") or address.get("region") or customer.get("state") or customer.get("region")
    )
    if not province:
        # Shopify and several checkouts have no wilaya field for Algeria. An Algerian postal
        # code starts with the wilaya number (31000 = Oran); otherwise the city is the best
        # available location rather than rejecting an otherwise valid order.
        from app.core.algeria_geo import resolve_wilaya, wilaya_name
        postal = address.get("zip") or address.get("postcode") or address.get("postal_code") or address.get("zipCode")
        postal_code = resolve_wilaya(str(postal)) if postal and str(postal).strip().isdigit() and len(str(postal).strip()) == 5 else None
        province = wilaya_name(postal_code) if postal_code else city
    street = (
        address.get("address1") or address.get("address_1") or address.get("address")
        or address.get("street") or address.get("address_line1")
    )
    address2 = address.get("address2") or address.get("address_2")
    if address2:
        street = f"{street}, {address2}" if street else address2

    currency = str(payload.get("currency") or payload.get("currency_code") or "DZD").strip().upper()
    # Stores configured with a local label instead of the ISO code.
    if currency in {"DA", "DZ", "دج", "د.ج", "DINAR", "DINARS"}:
        currency = "DZD"
    if currency != "DZD":
        raise HTTPException(422, "ORDIUM currently accepts DZD orders only")

    raw_items = payload.get("line_items") or payload.get("items") or []
    if not isinstance(raw_items, list) or len(raw_items) > 100:
        raise HTTPException(422, "Order has an invalid items list")
    items = []
    for item in raw_items:
        if not isinstance(item, dict):
            raise HTTPException(422, "Order contains an invalid item")
        quantity = _quantity(item.get("quantity", 1))
        unit_price = item.get("price") if item.get("price") is not None else item.get("unit_price")
        if _is_zero_amount(unit_price):
            # Free items (gifts, samples) carry no monetary risk; skip them instead of rejecting the order.
            continue
        items.append(OrderItemCreate(
            product_name=_required_text(item.get("title") or item.get("name") or item.get("product_name"), "item name"),
            sku=str(item["sku"])[:100] if item.get("sku") else None,
            quantity=quantity,
            unit_price=_money(unit_price, "item price"),
            product_category=(str(item.get("product_type") or item.get("product_category"))[:100] or None)
            if item.get("product_type") or item.get("product_category") else None,
        ))

    total = payload.get("total_price") or payload.get("total_amount") or payload.get("total")
    return OrderCreate(
        external_order_id=external_order_id,
        first_name=_required_text(first_name, "first name", 100),
        last_name=_required_text(last_name, "last name", 100),
        phone=_required_text(phone, "phone", 32),
        wilaya=_required_text(province, "wilaya/province", 100),
        commune=_required_text(city, "commune/city", 100),
        address=_required_text(street, "shipping address", 500),
        total_amount=_money(total, "total"),
        currency=currency,
        items=items,
        customer_ip=_shopper_ip(payload),
    )


def _shopper_ip(payload: dict) -> str | None:
    """Shopper IP as reported by the store platform (WooCommerce
    customer_ip_address, Shopify browser_ip / client_details.browser_ip).
    Invalid or private values are ignored rather than failing ingestion."""
    from app.schemas.order import normalize_customer_ip
    client_details = payload.get("client_details") if isinstance(payload.get("client_details"), dict) else {}
    for raw in (
        payload.get("customer_ip"),
        payload.get("customer_ip_address"),
        payload.get("browser_ip"),
        client_details.get("browser_ip"),
    ):
        if isinstance(raw, str) and raw.strip():
            try:
                return normalize_customer_ip(raw)
            except ValueError:
                continue
    return None


def _ingest(payload: dict, merchant_id: UUID, store_id: UUID, event_id: str):
    order = payload.get("order") if isinstance(payload.get("order"), dict) else payload
    external_id = order.get("id") or order.get("order_id") or order.get("name")
    external_id = _required_text(external_id, "external order ID")
    try:
        normalized = _normalize_order(order, external_id)
    except ValidationError as exc:
        # Name the failing fields (never the submitted values) so merchants can fix their store setup.
        problems = sorted({
            f"{'.'.join(str(part) for part in error.get('loc', ())) or 'order'}: {error.get('msg', 'invalid')}"
            for error in exc.errors()
        })
        raise HTTPException(422, "Order payload does not match ORDIUM required fields: " + "; ".join(problems)[:500]) from exc
    from app.db.database import SessionLocal
    from app.models.store import Store
    with SessionLocal() as db:
        registered_store = db.query(Store).filter(
            Store.id == store_id,
            Store.merchant_id == merchant_id,
            Store.is_active.is_(True),
        ).first()
        if registered_store is None:
            raise HTTPException(403, "Mapped ORDIUM store is inactive or does not belong to the mapped merchant")
        try:
            result = OrderService(db).create_order(
                merchant_id=merchant_id,
                data=normalized,
                api_key=None,
                store_id=store_id,
                idempotency_key=event_id[:255],
                request_id=None,
                device_fingerprint=None,
                ip_address=normalized.customer_ip,
                user_agent="ORDIUM store integration",
            )
            return {"accepted": True, "order_id": result.response_body.get("order_id"), "replayed": result.replayed}
        except ValueError as exc:
            db.rollback()
            message = str(exc).lower()
            if "already exists" in message or "already used with a different request" in message:
                # The same store order was delivered again (retry, or a resend with refreshed
                # metadata). It is already ingested, so acknowledge it instead of failing.
                return {"accepted": True, "duplicate": True}
            raise HTTPException(422, str(exc)) from exc


@router.post("/shopify/webhook")
async def shopify_webhook(
    request: Request,
    signature: str | None = Header(default=None, alias="X-Shopify-Hmac-Sha256"),
    shop_domain: str | None = Header(default=None, alias="X-Shopify-Shop-Domain"),
    topic: str | None = Header(default=None, alias="X-Shopify-Topic"),
    webhook_id: str | None = Header(default=None, alias="X-Shopify-Webhook-Id"),
):
    raw_body = await request.body()
    if not settings.shopify_webhook_secret or not _verify_hmac(raw_body, signature, settings.shopify_webhook_secret):
        raise HTTPException(401, "Invalid Shopify webhook signature")
    if (topic or "").lower() != "orders/create":
        return {"accepted": True, "ignored": True, "reason": "unsupported_topic"}
    domain = (shop_domain or "").strip().lower()
    if not domain or len(domain) > 255:
        raise HTTPException(400, "Missing Shopify shop domain")
    merchant_id, store_id = _store_config(_json_map(settings.shopify_store_map, "SHOPIFY_STORE_MAP"), domain)
    try:
        payload = json.loads(raw_body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(400, "Invalid Shopify JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid Shopify order payload")
    event_id = f"shopify:{domain}:{webhook_id or payload.get('id') or hashlib.sha256(raw_body).hexdigest()}"
    return await run_in_threadpool(_ingest_acknowledged, payload, merchant_id, store_id, event_id)


@router.post("/omniterra/webhook")
async def omniterra_webhook(
    request: Request,
):
    raw_body = await request.body()
    signature = (
        request.headers.get(settings.omniterra_signature_header)
        or request.headers.get("X-Omniterra-Hmac-Sha256")
        or request.headers.get("X-Shopify-Hmac-Sha256")
        or request.headers.get("X-NDC-Hmac-Sha256")
    )
    event_id_header = (
        request.headers.get(settings.omniterra_event_id_header)
        or request.headers.get("X-Omniterra-Webhook-Id")
        or request.headers.get("X-Shopify-Webhook-Id")
        or request.headers.get("X-NDC-Webhook-Id")
    )
    if not settings.omniterra_webhook_secret or not _verify_hmac(raw_body, signature, settings.omniterra_webhook_secret):
        raise HTTPException(401, "Invalid Omniterra webhook signature")
    try:
        payload = json.loads(raw_body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(400, "Invalid Omniterra JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid Omniterra payload")
    event_type = str(
        payload.get("event") or payload.get("topic") or payload.get("type")
        or request.headers.get("X-Omniterra-Topic")
        or request.headers.get("X-NDC-Topic")
        or request.headers.get("X-Shopify-Topic")
        or ""
    ).lower()
    if not event_type:
        raise HTTPException(400, "Missing Omniterra event topic; configure the provider topic header or include the event name in the payload")
    if event_type not in {"order.created", "orders/create", "order_created"}:
        return {"accepted": True, "ignored": True, "reason": "unsupported_event"}
    order = payload.get("data") if isinstance(payload.get("data"), dict) else payload.get("order")
    if not isinstance(order, dict):
        order = payload
    store = order.get("store") if isinstance(order.get("store"), dict) else {}
    external_store = str(
        order.get("store_id") or order.get("shop_id") or order.get("shop_domain")
        or store.get("id") or store.get("domain")
        or request.headers.get("X-Omniterra-Store-Id")
        or request.headers.get("X-NDC-Store-Id")
        or request.headers.get("X-Shopify-Shop-Domain")
        or ""
    ).strip().lower()
    if not external_store:
        raise HTTPException(422, "Omniterra payload must identify its store")
    merchant_id, store_id = _store_config(_json_map(settings.omniterra_store_map, "OMNITERRA_STORE_MAP"), external_store)
    order_payload = order
    external_id = order_payload.get("id") or order_payload.get("order_id") or order_payload.get("name")
    stable_event_id = event_id_header or payload.get("id") or payload.get("webhook_id") or external_id
    if not stable_event_id:
        stable_event_id = hashlib.sha256(raw_body).hexdigest()
    return await run_in_threadpool(_ingest_acknowledged, order_payload, merchant_id, store_id, f"omniterra:{external_store}:{stable_event_id}")


def _ingest_acknowledged(payload: dict, merchant_id: UUID, store_id: UUID, event_id: str) -> dict:
    """_ingest for authenticated store deliveries: an unprocessable order is
    acknowledged (2xx) so the platform does not disable the webhook after
    repeated failures; transient server errors still raise."""
    try:
        return _ingest(payload, merchant_id, store_id, event_id)
    except HTTPException as exc:
        if exc.status_code >= 500:
            raise
        logger.warning("legacy store webhook rejected event=%s status=%s reason=%s", event_id[:80], exc.status_code, exc.detail)
        return {"accepted": False, "reason": str(exc.detail)}


@router.get("/status")
def integration_status():
    # Never reveal secrets, mapped store IDs, or merchant identifiers publicly.
    return {
        "shopify": {"configured": bool(settings.shopify_webhook_secret and settings.shopify_store_map.strip())},
        "omniterra": {"configured": bool(settings.omniterra_webhook_secret and settings.omniterra_store_map.strip())},
    }
