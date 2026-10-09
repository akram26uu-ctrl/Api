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


def test_manual_confirmation_history_updates_order_status_and_is_readable():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Confirmation Merchant",
            email=f"confirmation-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )
        db.add(merchant)
        db.flush()
        _, raw_key = ApiKeyService(db).create_key(
            merchant, "Confirmation Dashboard", "test", ["orders:read", "orders:write"]
        )
        db.commit()
        headers = {"Authorization": f"Bearer {raw_key}"}
        payload = {
            "external_order_id": f"confirmation-{uuid4()}",
            "first_name": "Test", "last_name": "Buyer", "phone": "0555000011",
            "wilaya": "Algiers", "commune": "Algiers", "address": "Test street",
            "total_amount": "4500.00", "currency": "DZD",
            "items": [{"product_name": "Test product", "quantity": 1, "unit_price": "4500.00"}],
        }
        created = client.post("/api/v1/orders", json=payload, headers=headers)
        assert created.status_code == 201, created.text
        order_id = created.json()["order_id"]

        recorded = client.post(
            f"/api/v1/orders/{order_id}/confirmation-attempts",
            json={"channel": "manual_call", "outcome": "confirmed", "notes": "Buyer confirmed"},
            headers=headers,
        )
        assert recorded.status_code == 201, recorded.text
        history = client.get(f"/api/v1/orders/{order_id}/confirmation-attempts", headers=headers)
        assert history.status_code == 200, history.text
        assert history.json()["status"] == "confirmed"
        assert history.json()["data"][0]["outcome"] == "confirmed"
        order = client.get(f"/api/v1/orders/{order_id}", headers=headers)
        assert order.status_code == 200
        assert order.json()["status"] == "confirmed"
        assert order.json()["items"][0]["product_name"] == "Test product"
    finally:
        db.rollback()
        db.close()


def test_order_confirmation_metrics_use_worked_orders_as_denominator():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Confirmation Metrics Merchant",
            email=f"confirmation-metrics-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )
        db.add(merchant)
        db.flush()
        _, raw_key = ApiKeyService(db).create_key(
            merchant, "Confirmation Metrics", "test", ["orders:read", "orders:write"]
        )
        db.commit()
        headers = {"Authorization": f"Bearer {raw_key}"}

        def create_order(label: str) -> str:
            response = client.post("/api/v1/orders", json={
                "external_order_id": f"metrics-{label}-{uuid4()}",
                "first_name": "Test", "last_name": "Buyer", "phone": "0555000022",
                "wilaya": "Algiers", "commune": "Algiers", "address": "Test street",
                "total_amount": "2000.00", "currency": "DZD",
            }, headers=headers)
            assert response.status_code == 201, response.text
            return response.json()["order_id"]

        confirmed_id = create_order("confirmed")
        in_progress_id = create_order("progress")
        create_order("unstarted")
        for order_id, outcome in ((confirmed_id, "contact_started"), (confirmed_id, "confirmed"), (in_progress_id, "no_answer")):
            response = client.post(
                f"/api/v1/orders/{order_id}/confirmation-attempts",
                json={"channel": "manual_call", "outcome": outcome}, headers=headers,
            )
            assert response.status_code == 201, response.text

        response = client.get("/api/v1/order-confirmations/metrics", headers=headers)
        assert response.status_code == 200, response.text
        metrics = response.json()
        assert metrics["attempted_orders"] == 2
        assert metrics["confirmed_orders"] == 1
        assert metrics["in_progress_orders"] == 1
        assert metrics["unstarted_pending_orders"] == 1
        assert metrics["total_attempts"] == 3
        assert metrics["confirmation_rate"] == 50.0
    finally:
        db.rollback()
        db.close()
