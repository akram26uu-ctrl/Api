from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.order_item import OrderItem
from app.services.api_key_service import ApiKeyService


client = TestClient(app)
INTERNAL_KEY = "pytest-internal-shared-secret-that-is-long-enough-123"


def test_internal_provisioning_stores_normalized_business_context():
    response = client.post(
        "/internal/v1/merchants/provision",
        headers={"X-ORDIUM-Internal-Key": INTERNAL_KEY},
        json={
            "name": "Appliance Store",
            "email": f"internal-{uuid4()}@example.com",
            "business_type": "Électroménager",
            "secondary_business_categories": ["Electronics", "أخرى"],
        },
    )
    assert response.status_code == 200
    merchant_id = response.json()["merchant_id"]

    db = SessionLocal()
    try:
        merchant = db.scalar(select(Merchant).where(Merchant.id == UUID(merchant_id)))
        assert merchant is not None
        assert merchant.primary_business_category == "home_appliances"
        assert "electronics" in merchant.secondary_business_categories
    finally:
        db.rollback(); db.close()


def test_internal_routes_require_shared_secret():
    response = client.post(
        "/internal/v1/merchants/provision",
        json={"name": "Nope", "email": f"nope-{uuid4()}@example.com"},
    )
    assert response.status_code == 401


def test_order_response_contains_items_and_business_explanation():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Item Store", email=f"items-{uuid4()}@example.com",
            status=MerchantStatus.ACTIVE, primary_business_category="fashion"
        )
        db.add(merchant); db.flush()
        _, raw = ApiKeyService(db).create_key(merchant, "items", "live", ["orders:write"])
        db.commit()

        response = client.post(
            "/api/v1/orders",
            headers={"Authorization": f"Bearer {raw}"},
            json={
                "external_order_id": f"ITEM-{uuid4()}",
                "first_name": "Test", "last_name": "Customer",
                "phone": "0555000033",
                "wilaya": "Algiers", "commune": "Algiers",
                "address": "1 Test Street",
                "total_amount": "500.00",
                "currency": "DZD",
                "items": [{
                    "product_name": "T-shirt",
                    "product_category": "Clothing",
                    "quantity": 5,
                    "unit_price": "100.00"
                }]
            },
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert len(body["items"]) == 1
        assert body["items"][0]["quantity"] == 5
        context = body["risk"]["explanation"]["business_context"]
        assert context["merchant_category"] == "fashion"
        assert context["total_quantity"] == 5
    finally:
        db.rollback(); db.close()
