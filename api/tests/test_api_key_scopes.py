from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.services.api_key_service import ApiKeyService
from tests.test_api_boundaries import create_active_merchant

client = TestClient(app)


def test_orders_only_key_cannot_access_control_plane():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, raw_key = ApiKeyService(db).create_key(merchant, "orders-only", "live", ["orders:write", "outcomes:write"])
        db.commit()
        response = client.get("/api/v1/metrics/risk-performance", headers={"Authorization": f"Bearer {raw_key}"})
        assert response.status_code == 403
    finally:
        db.close()


def test_key_cannot_mint_scope_above_its_own_permissions():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, raw_key = ApiKeyService(db).create_key(merchant, "manager", "live", ["keys:manage", "orders:write"])
        db.commit()
        response = client.post(
            "/api/v1/api-keys",
            json={"name": "escalated", "environment": "live", "scopes": ["keys:manage", "webhooks:manage"]},
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert response.status_code == 403
    finally:
        db.close()
