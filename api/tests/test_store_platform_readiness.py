"""Readiness of store connections for Shopify, YouCan, WooCommerce and custom stores."""
import base64
import hashlib
import hmac
import json
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.api.v1.integrations import _normalize_order, _normalize_dz_phone
from app.core.config import settings
from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.models.store import Store
from app.services.api_key_service import ApiKeyService

client = TestClient(app)


def _merchant_with_key():
    db = SessionLocal()
    try:
        merchant = Merchant(name="Platform Merchant", email=f"platform-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()
        store = Store(merchant_id=merchant.id, name="Shop", slug=f"shop-{uuid4().hex[:12]}", is_active=True)
        db.add(store)
        db.flush()
        _, raw_key = ApiKeyService(db).create_key(merchant, "Integrations", environment="live", scopes=["keys:manage"], key_kind="system")
        ids = (str(merchant.id), str(store.id))
        db.commit()
        return ids, raw_key
    finally:
        db.close()


def _create(raw_key, store_id, **payload):
    return client.post(
        "/api/v1/integrations/connections",
        json={"store_id": store_id, "display_name": "Main store", **payload},
        headers={"Authorization": f"Bearer {raw_key}"},
    )


def _capture_ingest(monkeypatch):
    captured = {}

    def fake_ingest(order, merchant_id, store_id, event_id):
        captured.update(order=order, event_id=event_id)
        return {"accepted": True, "order_id": "test-order", "replayed": False}

    monkeypatch.setattr("app.api.v1.integrations._ingest", fake_ingest)
    return captured


def test_webhook_url_uses_public_api_origin(monkeypatch):
    monkeypatch.setattr(settings, "public_api_base_url", "https://api.ordium.dev/")
    (_, store_id), raw_key = _merchant_with_key()
    response = _create(raw_key, store_id, platform="woocommerce", external_store_id=f"shop-{uuid4().hex}.example.dz")
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["webhook_url"] == f"https://api.ordium.dev/api/v1/integrations/webhooks/woocommerce/{body['id']}"
    listed = client.get("/api/v1/integrations/connections", headers={"Authorization": f"Bearer {raw_key}"}).json()
    assert all(item["webhook_url"].startswith("https://api.ordium.dev/") for item in listed)


def test_shopify_connection_flow_with_secret_added_after_creation(monkeypatch):
    monkeypatch.setattr(settings, "shopify_webhook_secret", "")
    (_, store_id), raw_key = _merchant_with_key()
    auth = {"Authorization": f"Bearer {raw_key}"}
    shop = f"atlas-{uuid4().hex[:8]}.myshopify.com"

    custom_domain = _create(raw_key, store_id, platform="shopify", external_store_id="www.atlas.dz")
    assert custom_domain.status_code == 422

    # Step 1: connect without a secret (Shopify only issues it after its webhook exists).
    created = _create(raw_key, store_id, platform="shopify", external_store_id=f"https://{shop.upper()}/")
    assert created.status_code == 201, created.text
    connection = created.json()
    assert connection["external_store_id"] == shop
    assert connection["webhook_secret"] is None
    assert connection["signing_secret_configured"] is False

    captured = _capture_ingest(monkeypatch)
    raw = json.dumps({"id": 820982911946154508, "total_price": "4200.00", "currency": "DZD"}).encode()
    signing_secret = "shpss_" + uuid4().hex
    signature = base64.b64encode(hmac.new(signing_secret.encode(), raw, hashlib.sha256).digest()).decode()
    headers = {"X-Shopify-Hmac-Sha256": signature, "X-Shopify-Topic": "orders/create", "X-Shopify-Shop-Domain": shop, "X-Shopify-Webhook-Id": "wh-1"}
    path = connection["webhook_url"].split("testserver", 1)[-1]
    assert client.post(path, content=raw, headers=headers).status_code == 401  # closed until configured

    # Step 2: paste the secret Shopify shows under Settings > Notifications > Webhooks.
    conn_path = f"/api/v1/integrations/connections/{connection['id']}"
    assert client.patch(conn_path, json={"webhook_secret": "short"}, headers=auth).status_code == 422
    updated = client.patch(conn_path, json={"webhook_secret": signing_secret}, headers=auth)
    assert updated.status_code == 200, updated.text
    assert updated.json()["signing_secret_configured"] is True
    assert updated.json()["is_active"] is True

    assert client.post(path, content=raw, headers={**headers, "X-Shopify-Shop-Domain": "other.myshopify.com"}).status_code == 403
    assert client.post(path, content=raw, headers={**headers, "X-Shopify-Hmac-Sha256": "bad"}).status_code == 401
    accepted = client.post(path, content=raw, headers=headers)
    assert accepted.status_code == 200, accepted.text
    assert captured["event_id"].endswith("shopify:order:820982911946154508")

    # Toggling via the existing query-parameter contract keeps working.
    paused = client.patch(f"{conn_path}?active=false", headers=auth)
    assert paused.status_code == 200 and paused.json()["is_active"] is False


def test_secret_update_is_rejected_for_ordium_signed_platforms():
    (_, store_id), raw_key = _merchant_with_key()
    connection = _create(raw_key, store_id, platform="woocommerce", external_store_id=f"wc-{uuid4().hex}").json()
    response = client.patch(
        f"/api/v1/integrations/connections/{connection['id']}",
        json={"webhook_secret": "x" * 32},
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert response.status_code == 422


def test_youcan_connection_accepts_platform_secret_and_event_names(monkeypatch):
    (_, store_id), raw_key = _merchant_with_key()
    secret = "youcan-" + uuid4().hex
    created = _create(raw_key, store_id, platform="youcan", external_store_id=f"shop-{uuid4().hex[:8]}", webhook_secret=secret)
    assert created.status_code == 201, created.text
    connection = created.json()
    captured = _capture_ingest(monkeypatch)
    raw = json.dumps({"event": "order.create", "data": {"id": "YC-1"}}).encode()
    signature = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    path = connection["webhook_url"].split("testserver", 1)[-1]
    response = client.post(path, content=raw, headers={"X-YouCan-Hmac-SHA256": signature})
    assert response.status_code == 200, response.text
    assert captured["order"]["id"] == "YC-1"


def test_generated_secret_platforms_reject_supplied_secret():
    (_, store_id), raw_key = _merchant_with_key()
    response = _create(raw_key, store_id, platform="custom", external_store_id=f"c-{uuid4().hex}", webhook_secret="x" * 32)
    assert response.status_code == 422


def test_woocommerce_ping_is_acknowledged_without_ingesting(monkeypatch):
    (_, store_id), raw_key = _merchant_with_key()
    connection = _create(raw_key, store_id, platform="woocommerce", external_store_id=f"wc-{uuid4().hex}").json()
    captured = _capture_ingest(monkeypatch)
    path = connection["webhook_url"].split("testserver", 1)[-1]
    response = client.post(path, content=b"webhook_id=17", headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert response.status_code == 200
    assert response.json() == {"accepted": True, "ping": True}
    assert captured == {}


def test_phone_formats_from_stores_are_normalized():
    assert _normalize_dz_phone("550 12 34 56") == "0550123456"
    assert _normalize_dz_phone("+213 550-12-34-56") == "0550123456"
    assert _normalize_dz_phone("213550123456") == "0550123456"
    assert _normalize_dz_phone("0661234567") == "0661234567"


def test_shopify_style_order_without_wilaya_full_name_and_free_item_is_accepted():
    order = _normalize_order(
        {
            "total_price": "5000.00",
            "currency": "DZD",
            "billing_address": {"name": "Amina Kaci", "phone": "770123456", "city": "Oran", "address1": "5 Rue Larbi Ben Mhidi"},
            "line_items": [
                {"title": "Robe", "quantity": 1, "price": "5000.00"},
                {"title": "Cadeau", "quantity": 1, "price": "0.00"},
            ],
        },
        "SH-1",
    )
    assert (order.first_name, order.last_name) == ("Amina", "Kaci")
    assert order.phone == "0770123456"
    assert order.wilaya == "Oran" and order.commune == "Oran"
    assert [item.product_name for item in order.items] == ["Robe"]
    assert order.total_amount == Decimal("5000.00")


def test_rejected_order_names_the_failing_field():
    (_, store_id), raw_key = _merchant_with_key()
    connection = _create(raw_key, store_id, platform="woocommerce", external_store_id=f"wc-{uuid4().hex}").json()
    payload = {
        "id": 501, "currency": "DZD", "total": "2500.00",
        "billing": {"first_name": "Ali", "last_name": "Bena", "phone": "12345", "city": "Oran", "address_1": "5 Rue X", "state": "DZ-31"},
        "line_items": [{"name": "Robe", "quantity": 1, "price": 2500}],
    }
    raw = json.dumps(payload).encode()
    signature = base64.b64encode(hmac.new(connection["webhook_secret"].encode(), raw, hashlib.sha256).digest()).decode()
    path = connection["webhook_url"].split("testserver", 1)[-1]
    response = client.post(path, content=raw, headers={"X-WC-Webhook-Signature": signature, "X-WC-Webhook-Topic": "order.created"})
    # A signed delivery is acknowledged (stores disable webhooks after
    # repeated failures); the rejection is reported to the merchant instead.
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is False
    assert "phone" in body["reason"]
    assert "12345" not in body["reason"]
    db = SessionLocal()
    try:
        from app.models.notification import Notification
        alerts = db.query(Notification).filter(
            Notification.store_id == UUID(store_id),
            Notification.notification_type == "integration.order_rejected",
        ).all()
        assert len(alerts) == 1
        assert "501" in alerts[0].message and "phone" in alerts[0].message
        assert "12345" not in alerts[0].message
        # The store retries the same delivery: no second alert.
        assert client.post(path, content=raw, headers={"X-WC-Webhook-Signature": signature, "X-WC-Webhook-Topic": "order.created"}).status_code == 200
        db.expire_all()
        assert db.query(Notification).filter(
            Notification.store_id == UUID(store_id),
            Notification.notification_type == "integration.order_rejected",
        ).count() == 1
    finally:
        db.close()


def test_other_store_events_are_acknowledged_not_failed():
    """Merchants often subscribe to "order updated" too; a 400 there would
    make WooCommerce disable the webhook after 5 deliveries."""
    (_, store_id), raw_key = _merchant_with_key()
    connection = _create(raw_key, store_id, platform="woocommerce", external_store_id=f"wc-{uuid4().hex}").json()
    raw = json.dumps({"id": 502, "status": "processing"}).encode()
    signature = base64.b64encode(hmac.new(connection["webhook_secret"].encode(), raw, hashlib.sha256).digest()).decode()
    path = connection["webhook_url"].split("testserver", 1)[-1]
    response = client.post(path, content=raw, headers={"X-WC-Webhook-Signature": signature, "X-WC-Webhook-Topic": "order.updated"})
    assert response.status_code == 200
    assert response.json() == {"accepted": True, "ignored": True, "reason": "unsupported_topic"}


def test_unsigned_delivery_is_still_rejected():
    (_, store_id), raw_key = _merchant_with_key()
    connection = _create(raw_key, store_id, platform="woocommerce", external_store_id=f"wc-{uuid4().hex}").json()
    path = connection["webhook_url"].split("testserver", 1)[-1]
    response = client.post(path, content=b'{"id": 1}', headers={"X-WC-Webhook-Signature": "bad", "X-WC-Webhook-Topic": "order.created"})
    assert response.status_code == 401


def _wc_send(connection, payload, delivery_id="same-second-hash"):
    raw = json.dumps(payload).encode()
    signature = base64.b64encode(hmac.new(connection["webhook_secret"].encode(), raw, hashlib.sha256).digest()).decode()
    path = connection["webhook_url"].split("testserver", 1)[-1]
    return client.post(path, content=raw, headers={
        "X-WC-Webhook-Signature": signature,
        "X-WC-Webhook-Topic": "order.created",
        "X-WC-Webhook-Delivery-ID": delivery_id,
    })


def _wc_order(order_id, quantity=1, unit_price=2500, total="2500.00", phone="0550123456"):
    return {
        "id": order_id, "currency": "DZD", "total": total,
        "billing": {"first_name": "Ali", "last_name": "Bena", "phone": phone, "city": "Oran", "address_1": "5 Rue X", "state": "DZ-31"},
        "line_items": [{"name": "Robe", "quantity": quantity, "price": unit_price}],
    }


def test_woocommerce_multi_quantity_and_same_second_orders_are_all_ingested():
    (_, store_id), raw_key = _merchant_with_key()
    connection = _create(raw_key, store_id, platform="woocommerce", external_store_id=f"wc-{uuid4().hex}").json()
    base = uuid4().int % 10_000_000

    single = _wc_send(connection, _wc_order(base + 1))
    assert single.status_code == 200, single.text
    # Same delivery ID (same second), quantity 5.
    five = _wc_send(connection, _wc_order(base + 2, quantity=5, unit_price=2500, total="12500.00"))
    assert five.status_code == 200, five.text
    assert five.json().get("duplicate") is not True
    # Quantity 3 after a discount: WooCommerce sends a fractional unit price.
    three = _wc_send(connection, _wc_order(base + 3, quantity=3, unit_price=833.3333333, total="2500.00"))
    assert three.status_code == 200, three.text
    assert three.json().get("duplicate") is not True
    assert len({single.json()["order_id"], five.json()["order_id"], three.json()["order_id"]}) == 3

    # A resend of the same order with refreshed data is acknowledged, not rejected.
    resend = _wc_send(connection, _wc_order(base + 2, quantity=5, unit_price=2500, total="12500.00", phone="0661234567"), delivery_id="other")
    assert resend.status_code == 200, resend.text
    assert resend.json().get("duplicate") is True or resend.json().get("replayed") is True
