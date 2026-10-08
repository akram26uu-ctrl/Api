from uuid import uuid4

from app.models.merchant import Merchant
from app.models.enums import MerchantStatus
from app.models.store import Store
from app.services.api_key_service import ApiKeyService
from app.db.database import SessionLocal
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _merchant_with_system_key():
    db = SessionLocal()
    merchant = Merchant(name="Store Isolation", email=f"stores-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
    db.add(merchant); db.flush()
    db.add(Store(merchant_id=merchant.id, name="Store One", slug="store-one", is_active=True)); db.flush()
    key, raw = ApiKeyService(db).create_key(merchant, "dashboard", "live", ["keys:manage", "orders:read", "orders:write", "metrics:read"], key_kind="system")
    db.commit(); db.close()
    return raw


def _order_payload(order_id: str, phone: str = "0555000001"):
    return {
        "external_order_id": order_id,
        "first_name": "Store",
        "last_name": "Customer",
        "phone": phone,
        "wilaya": "Algiers",
        "commune": "Bab Ezzouar",
        "address": "1 Store Street",
        "total_amount": "5000.00",
        "currency": "DZD",
    }


def test_store_creation_and_order_isolation():
    raw_system = _merchant_with_system_key()
    headers = {"Authorization": f"Bearer {raw_system}"}
    stores = client.get("/api/v1/stores", headers=headers)
    assert stores.status_code == 200
    first = stores.json()[0]

    created = client.post("/api/v1/stores", json={"name": "Second Store"}, headers=headers)
    assert created.status_code == 201, created.text
    second = created.json()
    assert second["id"] != first["id"]

    key_one = client.post("/api/v1/api-keys", json={"name": "Store One Key", "environment": "live", "store_id": first["id"], "scopes": ["orders:write", "orders:read"]}, headers=headers)
    key_two = client.post("/api/v1/api-keys", json={"name": "Store Two Key", "environment": "live", "store_id": second["id"], "scopes": ["orders:write", "orders:read"]}, headers=headers)
    assert key_one.status_code == 201, key_one.text
    assert key_two.status_code == 201, key_two.text

    response_one = client.post("/api/v1/orders", json=_order_payload("STORE-ONE-1", "0555000001"), headers={"Authorization": f"Bearer {key_one.json()['api_key']}"})
    response_two = client.post("/api/v1/orders", json=_order_payload("STORE-TWO-1", "0555000002"), headers={"Authorization": f"Bearer {key_two.json()['api_key']}"})
    assert response_one.status_code == 201, response_one.text
    assert response_two.status_code == 201, response_two.text

    orders_one = client.get("/api/v1/orders", headers={"Authorization": f"Bearer {key_one.json()['api_key']}"})
    orders_two = client.get("/api/v1/orders", headers={"Authorization": f"Bearer {key_two.json()['api_key']}"})
    assert [item["external_order_id"] for item in orders_one.json()["data"]] == ["STORE-ONE-1"]
    assert [item["external_order_id"] for item in orders_two.json()["data"]] == ["STORE-TWO-1"]


def test_store_metrics_are_separated():
    raw_system = _merchant_with_system_key()
    headers = {"Authorization": f"Bearer {raw_system}"}
    first = client.get("/api/v1/stores", headers=headers).json()[0]
    second = client.post("/api/v1/stores", json={"name": "Metrics Store"}, headers=headers).json()
    key_one = client.post("/api/v1/api-keys", json={"name": "Metrics One", "environment": "live", "store_id": first["id"], "scopes": ["orders:write", "orders:read"]}, headers=headers).json()["api_key"]
    key_two = client.post("/api/v1/api-keys", json={"name": "Metrics Two", "environment": "live", "store_id": second["id"], "scopes": ["orders:write", "orders:read"]}, headers=headers).json()["api_key"]
    assert client.post("/api/v1/orders", json=_order_payload("METRIC-ONE", "0555000011"), headers={"Authorization": f"Bearer {key_one}"}).status_code == 201
    assert client.post("/api/v1/orders", json=_order_payload("METRIC-TWO", "0555000012"), headers={"Authorization": f"Bearer {key_two}"}).status_code == 201
    m1 = client.get(f"/api/v1/metrics/summary?store_id={first['id']}", headers=headers).json()
    m2 = client.get(f"/api/v1/metrics/summary?store_id={second['id']}", headers=headers).json()
    assert m1["total_orders"] == 1
    assert m2["total_orders"] == 1
