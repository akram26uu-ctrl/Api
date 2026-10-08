from uuid import uuid4

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.services.api_key_service import ApiKeyService

client = TestClient(app)


def test_dashboard_can_list_and_read_orders_with_read_scope():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Dashboard Merchant",
            email=f"dashboard-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )
        db.add(merchant)
        db.flush()
        _, raw_key = ApiKeyService(db).create_key(
            merchant, "Dashboard", "test", ["orders:read", "orders:write"]
        )
        db.commit()

        payload = {
            "external_order_id": f"dash-{uuid4()}",
            "first_name": "Test",
            "last_name": "Customer",
            "phone": "0555000001",
            "wilaya": "Algiers",
            "commune": "Bab Ezzouar",
            "address": "1 Test Street",
            "total_amount": "5000.00",
            "currency": "DZD",
        }
        headers = {"Authorization": f"Bearer {raw_key}"}
        created = client.post("/api/v1/orders", json=payload, headers=headers)
        assert created.status_code == 201
        order_id = created.json()["order_id"]

        listed = client.get("/api/v1/orders?limit=10", headers=headers)
        assert listed.status_code == 200
        body = listed.json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["order_id"] == order_id
        assert body["data"][0]["external_order_id"] == payload["external_order_id"]

        detail = client.get(f"/api/v1/orders/{order_id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["order_id"] == order_id
    finally:
        db.rollback()
        db.close()


def test_dashboard_summary_requires_orders_read_scope():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Summary Merchant",
            email=f"summary-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )
        db.add(merchant)
        db.flush()
        _, raw_key = ApiKeyService(db).create_key(merchant, "Summary", "test", ["orders:write"])
        db.commit()
        response = client.get("/api/v1/metrics/summary", headers={"Authorization": f"Bearer {raw_key}"})
        assert response.status_code == 403
    finally:
        db.rollback()
        db.close()


def test_create_order_accepts_store_id_query_parameter():
    from pathlib import Path
    source = Path("app/api/v1/orders.py").read_text(encoding="utf-8")
    assert 'store_id: str | None = Query(default=None, max_length=64)' in source
    assert 'requested_store = x_ordium_store_id or store_id' in source


def test_create_order_uses_query_store_for_merchant_scoped_key():
    from app.models.store import Store

    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Query Store Merchant",
            email=f"query-store-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )
        db.add(merchant)
        db.flush()
        store = Store(merchant_id=merchant.id, name="Default Store", slug=f"default-{uuid4().hex[:8]}")
        db.add(store)
        db.flush()
        _, raw_key = ApiKeyService(db).create_key(
            merchant, "Merchant Scoped", "test", ["orders:write"]
        )
        db.commit()

        payload = {
            "external_order_id": f"store-query-{uuid4()}",
            "first_name": "Test",
            "last_name": "Customer",
            "phone": "0555000002",
            "wilaya": "Algiers",
            "commune": "Bab Ezzouar",
            "address": "1 Test Street",
            "total_amount": "5000.00",
            "currency": "DZD",
        }
        response = client.post(
            f"/api/v1/orders?store_id={store.id}",
            json=payload,
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert response.status_code == 201, response.text
        from app.models.order import Order
        created_order = db.query(Order).filter(Order.external_order_id == payload["external_order_id"]).one()
        assert created_order.store_id == store.id
    finally:
        db.rollback()
        db.close()
