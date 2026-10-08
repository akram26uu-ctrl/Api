from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.services.api_key_service import ApiKeyService
from tests.test_api_boundaries import create_active_merchant, payload
from app.db.database import SessionLocal

client = TestClient(app)


def test_live_key_is_environment_scoped_for_key_management():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        live_obj, live_key = ApiKeyService(db).create_key(merchant, "live", "live", ["keys:manage"])
        test_obj, _ = ApiKeyService(db).create_key(merchant, "test", "test", ["keys:manage"])
        db.commit()

        listed = client.get(
            "/api/v1/api-keys",
            headers={"Authorization": f"Bearer {live_key}"},
        )
        assert listed.status_code == 200
        assert all(item["environment"] == "live" for item in listed.json())

        revoke_test = client.post(
            f"/api/v1/api-keys/{test_obj.id}/revoke",
            headers={"Authorization": f"Bearer {live_key}"},
        )
        assert revoke_test.status_code == 404

        rotate_test = client.post(
            f"/api/v1/api-keys/{test_obj.id}/rotate",
            headers={"Authorization": f"Bearer {live_key}"},
        )
        assert rotate_test.status_code == 404

        assert live_obj is not None
    finally:
        db.rollback()
        db.close()


def test_live_webhook_control_is_environment_scoped():
    from app.services.webhook_service import WebhookService
    from app.models.webhook_endpoint import WebhookEndpoint
    from sqlalchemy import select

    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, live_key = ApiKeyService(db).create_key(merchant, "live", "live", ["webhooks:manage"])
        test_endpoint, _ = WebhookService(db).create_endpoint(
            merchant.id, "test", "https://1.1.1.1/test", ["*"]
        )
        db.commit()

        listed = client.get(
            "/api/v1/webhooks",
            headers={"Authorization": f"Bearer {live_key}"},
        )
        assert listed.status_code == 200
        assert listed.json() == []

        disabled = client.post(
            f"/api/v1/webhooks/{test_endpoint.id}/disable",
            headers={"Authorization": f"Bearer {live_key}"},
        )
        assert disabled.status_code == 404

        persisted = db.scalar(select(WebhookEndpoint).where(WebhookEndpoint.id == test_endpoint.id))
        assert persisted is not None and persisted.is_active
    finally:
        db.rollback()
        db.close()


def test_outcome_cannot_be_backdated_before_order_creation():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, raw_key = ApiKeyService(db).create_key(merchant, "live", "live", ["orders:write", "outcomes:write"])
        db.commit()

        order = client.post(
            "/api/v1/orders",
            json=payload(f"date-{uuid4()}", "0555000011"),
            headers={"Authorization": f"Bearer {raw_key}", "Idempotency-Key": f"date-{uuid4()}"},
        )
        assert order.status_code == 201
        order_id = order.json()["order_id"]

        future_before = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        future_response = client.post(
            f"/api/v1/orders/{order_id}/outcome",
            json={"outcome_status": "cancelled", "occurred_at": future_before},
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert future_response.status_code == 422

        too_old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        old_response = client.post(
            f"/api/v1/orders/{order_id}/outcome",
            json={"outcome_status": "cancelled", "occurred_at": too_old},
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert old_response.status_code == 422
    finally:
        db.rollback()
        db.close()
