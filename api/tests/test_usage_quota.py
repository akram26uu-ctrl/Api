from uuid import uuid4

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.services.api_key_service import ApiKeyService

client = TestClient(app)


def test_usage_endpoint_returns_beta_free_quota():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Usage Merchant",
            email=f"usage-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )
        db.add(merchant)
        db.flush()
        key, raw = ApiKeyService(db).create_key(
            merchant,
            "Usage Dashboard",
            environment="live",
            scopes=["metrics:read"],
        )
        db.commit()
        response = client.get(
            "/api/v1/usage",
            headers={"Authorization": f"Bearer {raw}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["plan_code"] == "free"
        assert payload["plan_name"] == "Free"
        assert payload["beta_access"] is True
        assert payload["evaluations_limit"] == 1000
        assert payload["evaluations_used"] == 0
        assert payload["evaluations_remaining"] == 1000
    finally:
        db.close()
