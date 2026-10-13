import base64
import hashlib
import hmac
import json
import logging
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_database
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


def _verify_hmac(raw_body: bytes, supplied: str | None, secret: str, *, base64_digest: bool = False) -> bool:
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
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise HTTPException(422, f"Order has an invalid amount: {label}") from exc
    if not amount.is_finite() or amount <= 0:
        raise HTTPException(422, f"Order has an invalid amount: {label}")
    return amount


def _normalize_order(payload: dict, external_order_id: str) -> OrderCreate:
    customer = payload.get("customer") or {}
    address = payload.get("shipping_address") or payload.get("shippingAddress") or payload.get("shipping") or {}
    if not address and isinstance(payload.get("shipping_lines"), dict):
        address = payload["shipping_lines"]
    if not isinstance(address, dict):
        address = {}
    first_name = address.get("first_name") or address.get("firstName") or customer.get("first_name") or customer.get("firstName")
    last_name = address.get("last_name") or address.get("lastName") or customer.get("last_name") or customer.get("lastName")
    phone = address.get("phone") or customer.get("phone") or payload.get("phone")
    city = address.get("city") or address.get("commune") or address.get("town")
    province = address.get("province") or address.get("province_code") or address.get("wilaya") or address.get("state")
    street = address.get("address1") or address.get("address") or address.get("street") or address.get("address_line1")
    if address.get("address2"):
        street = f"{street}, {address['address2']}" if street else address["address2"]

    currency = str(payload.get("currency") or payload.get("currency_code") or "DZD").upper()
    if currency != "DZD":
        raise HTTPException(422, "ORDIUM currently accepts DZD orders only")

    raw_items = payload.get("line_items") or payload.get("items") or []
    if not isinstance(raw_items, list) or len(raw_items) > 100:
        raise HTTPException(422, "Order has an invalid items list")
    items = []
    for item in raw_items:
        if not isinstance(item, dict):
            raise HTTPException(422, "Order contains an invalid item")
        quantity = item.get("quantity", 1)
        try:
            quantity = int(quantity)
        except (ValueError, TypeError) as exc:
            raise HTTPException(422, "Order contains an invalid item quantity") from exc
        unit_price = item.get("price") or item.get("unit_price")
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
        phone=_required_text(phone, "phone", 20),
        wilaya=_required_text(province, "wilaya/province", 100),
        commune=_required_text(city, "commune/city", 100),
        address=_required_text(street, "shipping address", 500),
        total_amount=_money(total, "total"),
        currency=currency,
        items=items,
    )


def _ingest(payload: dict, merchant_id: UUID, store_id: UUID, event_id: str):
    order = payload.get("order") if isinstance(payload.get("order"), dict) else payload
    external_id = order.get("id") or order.get("order_id") or order.get("name")
    external_id = _required_text(external_id, "external order ID")
    normalized = _normalize_order(order, external_id)
    from app.db.database import SessionLocal
    with SessionLocal() as db:
        try:
            result = OrderService(db).create_order(
                merchant_id=merchant_id,
                data=normalized,
                api_key=None,
                store_id=store_id,
                idempotency_key=event_id[:255],
                request_id=None,
                device_fingerprint=None,
                ip_address=None,
                user_agent="ORDIUM store integration",
            )
            return {"accepted": True, "order_id": result.response_body.get("order_id"), "replayed": result.replayed}
        except ValueError as exc:
            db.rollback()
            if "already exists" in str(exc).lower():
                # A different delivery ID may describe an order already ingested.
                return {"accepted": True, "duplicate": True}
            raise HTTPException(422, str(exc)) from exc


@router.post("/shopify/webhook")
async def shopify_webhook(
    request: Request,
    db: Session = Depends(get_database),
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
    return _ingest(payload, merchant_id, store_id, event_id)


@router.post("/omniterra/webhook")
async def omniterra_webhook(
    request: Request,
    signature: str | None = Header(default=None, alias="X-Omniterra-Hmac-Sha256"),
    event_id_header: str | None = Header(default=None, alias="X-Omniterra-Webhook-Id"),
):
    raw_body = await request.body()
    if not settings.omniterra_webhook_secret or not _verify_hmac(raw_body, signature, settings.omniterra_webhook_secret):
        raise HTTPException(401, "Invalid Omniterra webhook signature")
    try:
        payload = json.loads(raw_body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(400, "Invalid Omniterra JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(400, "Invalid Omniterra payload")
    event_type = str(payload.get("event") or payload.get("topic") or payload.get("type") or "").lower()
    if event_type and event_type not in {"order.created", "orders/create", "order_created"}:
        return {"accepted": True, "ignored": True, "reason": "unsupported_event"}
    order = payload.get("data") if isinstance(payload.get("data"), dict) else payload.get("order")
    if not isinstance(order, dict):
        order = payload
    store = order.get("store") if isinstance(order.get("store"), dict) else {}
    external_store = str(order.get("store_id") or order.get("shop_id") or order.get("shop_domain") or store.get("id") or store.get("domain") or "").strip().lower()
    if not external_store:
        raise HTTPException(422, "Omniterra payload must identify its store")
    merchant_id, store_id = _store_config(_json_map(settings.omniterra_store_map, "OMNITERRA_STORE_MAP"), external_store)
    order_payload = order
    external_id = order_payload.get("id") or order_payload.get("order_id") or order_payload.get("name")
    stable_event_id = event_id_header or payload.get("id") or payload.get("webhook_id") or external_id
    if not stable_event_id:
        stable_event_id = hashlib.sha256(raw_body).hexdigest()
    return _ingest(order_payload, merchant_id, store_id, f"omniterra:{external_store}:{stable_event_id}")


@router.get("/status")
def integration_status():
    # Never reveal secrets, mapped store IDs, or merchant identifiers publicly.
    return {
        "shopify": {"configured": bool(settings.shopify_webhook_secret and settings.shopify_store_map.strip())},
        "omniterra": {"configured": bool(settings.omniterra_webhook_secret and settings.omniterra_store_map.strip())},
    }
