import hashlib
import hmac
import json
from uuid import uuid4

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.models.store import Store
from app.services.api_key_service import ApiKeyService

client = TestClient(app)


def test_custom_store_can_connect_and_send_signed_order_webhook(monkeypatch):
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Custom Integration Merchant",
            email=f"custom-integration-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )
        db.add(merchant)
        db.flush()
        store = Store(
            merchant_id=merchant.id,
            name="Custom Shop",
            slug=f"custom-{uuid4().hex[:12]}",
            is_active=True,
        )
        db.add(store)
        db.flush()
        _, raw_key = ApiKeyService(db).create_key(
            merchant,
            "Custom integration manager",
            environment="live",
            scopes=["keys:manage"],
            key_kind="system",
        )
        merchant_id = str(merchant.id)
        store_id = str(store.id)
        db.commit()
    finally:
        db.close()

    connection_response = client.post(
        "/api/v1/integrations/connections",
        json={
            "store_id": store_id,
            "platform": "custom",
            "external_store_id": f"custom-{uuid4().hex}.example.test",
            "display_name": "Custom Shop",
        },
        headers={"Authorization": f"Bearer {raw_key}"},
    )
    assert connection_response.status_code == 201, connection_response.text
    connection = connection_response.json()
    assert connection["platform"] == "custom"
    assert connection["webhook_secret"]
    assert connection["webhook_url"].endswith(
        f"/api/v1/integrations/webhooks/custom/{connection['id']}"
    )

    captured = {}

    def fake_ingest(order, received_merchant_id, received_store_id, event_id):
        captured.update(
            order=order,
            merchant_id=str(received_merchant_id),
            store_id=str(received_store_id),
            event_id=event_id,
        )
        return {"accepted": True, "order_id": "ordium-test-order", "replayed": False}

    monkeypatch.setattr("app.api.v1.integrations._ingest", fake_ingest)
    payload = {
        "event": "order.created",
        "event_id": "delivery-123",
        "data": {
            "id": "SHOP-ORDER-123",
            "customer": {
                "first_name": "Ali",
                "last_name": "Bena",
                "phone": "0550123456",
            },
            "shipping_address": {
                "wilaya": "Alger",
                "commune": "Bab El Oued",
                "address": "12 Rue Exemple",
            },
            "total_price": "4200.00",
            "currency": "DZD",
            "items": [
                {
                    "name": "Product",
                    "sku": "SKU-001",
                    "quantity": 2,
                    "unit_price": "2100.00",
                }
            ],
        },
    }
    raw_body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    signature = hmac.new(
        connection["webhook_secret"].encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    webhook_headers = {
        "Content-Type": "application/json",
        "X-ORDIUM-Signature": signature,
        "X-ORDIUM-Event-ID": "delivery-123",
    }

    invalid_signature_response = client.post(
        connection["webhook_url"],
        content=raw_body,
        headers={**webhook_headers, "X-ORDIUM-Signature": "invalid"},
    )
    assert invalid_signature_response.status_code == 401

    accepted_response = client.post(
        connection["webhook_url"],
        content=raw_body,
        headers=webhook_headers,
    )
    assert accepted_response.status_code == 200, accepted_response.text
    assert accepted_response.json()["accepted"] is True
    assert captured["merchant_id"] == merchant_id
    assert captured["store_id"] == store_id
    assert captured["event_id"] == f"custom:{connection['id']}:delivery-123"
    assert captured["order"]["id"] == "SHOP-ORDER-123"
