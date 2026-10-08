from uuid import UUID

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.ordium_api import OrdiumProvisioningClient
from app.services.email import send_verification_email


def test_email_verification_activates_account_and_creates_dashboard_session(monkeypatch):
    captured = {}
    old = settings.require_email_verification
    settings.require_email_verification = True

    monkeypatch.setattr(OrdiumProvisioningClient, "provision_merchant", lambda self, **kwargs: UUID("00000000-0000-0000-0000-000000000011"))
    monkeypatch.setattr(OrdiumProvisioningClient, "activate_merchant", lambda self, merchant_id: None)
    monkeypatch.setattr(OrdiumProvisioningClient, "ensure_store", lambda self, merchant_id: (UUID("00000000-0000-0000-0000-000000000015"), "Verify Store"))
    monkeypatch.setattr(OrdiumProvisioningClient, "create_initial_test_key", lambda self, merchant_id: (UUID("00000000-0000-0000-0000-000000000012"), "ordium_test_initial"))
    monkeypatch.setattr(OrdiumProvisioningClient, "create_dashboard_key", lambda self, merchant_id, environment="test": (UUID("00000000-0000-0000-0000-000000000013" if environment == "test" else "00000000-0000-0000-0000-000000000014"), f"ordium_{environment}_dashboard"))
    monkeypatch.setattr(OrdiumProvisioningClient, "revoke_api_key", lambda self, merchant_id, api_key_id: None)
    monkeypatch.setattr("app.api.auth.send_verification_email", lambda **kwargs: captured.update(kwargs))

    client = TestClient(app)
    response = client.post("/api/v1/auth/register", json={
        "email": "verify@example.com",
        "password": "StrongPassword123",
        "first_name": "Verify",
        "last_name": "User",
        "organization_name": "Verify Store",
    })
    assert response.status_code == 201
    body = response.json()
    assert body["verification_required"] is True
    assert captured["recipient"] == "verify@example.com"
    token = body["verification_token"]
    assert token

    verified = client.post(f"/api/v1/auth/verify-email?token={token}")
    assert verified.status_code == 200
    assert verified.json()["user"]["status"] == "active"
    assert verified.json().get("dashboard_api_key") is None
    assert verified.json().get("dashboard_api_keys") is None

    settings.require_email_verification = old
