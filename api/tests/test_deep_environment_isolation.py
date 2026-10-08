from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.database import SessionLocal
from app.main import app
from app.models.audit_log import AuditLog
from app.models.merchant import Merchant
from app.models.enums import MerchantStatus
from app.models.webhook_endpoint import WebhookEndpoint
from app.services.api_key_service import ApiKeyService
from tests.test_api_boundaries import create_active_merchant

client = TestClient(app)


def test_test_key_cannot_manage_live_api_key():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        live_obj, live_key = ApiKeyService(db).create_key(merchant, "live", "live", ["keys:manage"])
        test_obj, test_key = ApiKeyService(db).create_key(merchant, "test", "test", ["keys:manage"])
        db.commit()

        response = client.post(
            f"/api/v1/api-keys/{live_obj.id}/rotate",
            headers={"Authorization": f"Bearer {test_key}"},
        )
        assert response.status_code == 404

        response = client.post(
            f"/api/v1/api-keys/{live_obj.id}/revoke",
            headers={"Authorization": f"Bearer {test_key}"},
        )
        assert response.status_code == 404

        listed = client.get("/api/v1/api-keys", headers={"Authorization": f"Bearer {test_key}"})
        assert listed.status_code == 200
        assert all(item["environment"] == "test" for item in listed.json())
    finally:
        db.rollback(); db.close()


def test_test_webhook_cannot_see_or_disable_live_webhook():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, live_key = ApiKeyService(db).create_key(merchant, "live", "live", ["webhooks:manage", "orders:write", "outcomes:write"])
        _, test_key = ApiKeyService(db).create_key(merchant, "test", "test", ["webhooks:manage", "orders:write", "outcomes:write"])
        db.commit()

        live = client.post(
            "/api/v1/webhooks",
            json={"url": "https://1.1.1.1/live", "events": ["*"]},
            headers={"Authorization": f"Bearer {live_key}"},
        )
        assert live.status_code == 201
        live_id = live.json()["id"]
        assert live.json()["environment"] == "live"

        test_list = client.get("/api/v1/webhooks", headers={"Authorization": f"Bearer {test_key}"})
        assert test_list.status_code == 200
        assert test_list.json() == []

        test_disable = client.post(
            f"/api/v1/webhooks/{live_id}/disable",
            headers={"Authorization": f"Bearer {test_key}"},
        )
        assert test_disable.status_code == 404

        db.expire_all()
        endpoint = db.scalar(select(WebhookEndpoint).where(WebhookEndpoint.id == UUID(live_id)))
        assert endpoint is not None and endpoint.is_active
    finally:
        db.rollback(); db.close()


def test_test_order_does_not_enqueue_to_live_webhook():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, live_key = ApiKeyService(db).create_key(merchant, "live", "live", ["webhooks:manage", "orders:write", "outcomes:write"])
        _, test_key = ApiKeyService(db).create_key(merchant, "test", "test", ["orders:write", "outcomes:write"])
        from app.services.webhook_service import WebhookService
        WebhookService(db).create_endpoint(merchant.id, "live", "https://1.1.1.1/live", ["order.risk_assessed"])
        WebhookService(db).create_endpoint(merchant.id, "test", "https://1.1.1.1/test", ["order.risk_assessed"])
        db.commit()

        from tests.test_api_boundaries import payload
        response = client.post(
            "/api/v1/orders",
            json=payload(f"env-hook-{uuid4()}", "0555000123"),
            headers={"Authorization": f"Bearer {test_key}", "Idempotency-Key": f"env-{uuid4()}"},
        )
        assert response.status_code == 201

        from app.models.webhook_delivery import WebhookDelivery
        deliveries = db.scalars(select(WebhookDelivery).where(WebhookDelivery.merchant_id == merchant.id) if False else select(WebhookDelivery).join(WebhookEndpoint).where(WebhookEndpoint.merchant_id == merchant.id)).all()
        assert deliveries
        assert all(d.environment == "test" for d in deliveries)
    finally:
        db.rollback(); db.close()


def test_test_key_cannot_read_live_audit_logs():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, live_key = ApiKeyService(db).create_key(merchant, "live", "live", ["audit:read"])
        _, test_key = ApiKeyService(db).create_key(merchant, "test", "test", ["audit:read"])
        from app.services.audit_service import AuditService
        AuditService(db).record(action="live.secret.event", resource_type="test", resource_id="live", merchant_id=merchant.id, environment="live")
        AuditService(db).record(action="test.safe.event", resource_type="test", resource_id="test", merchant_id=merchant.id, environment="test")
        db.commit()

        live_response = client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {live_key}"})
        test_response = client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {test_key}"})

        assert live_response.status_code == 200
        assert test_response.status_code == 200
        assert all(item["environment"] == "live" for item in live_response.json())
        assert all(item["environment"] == "test" for item in test_response.json())
    finally:
        db.rollback(); db.close()
