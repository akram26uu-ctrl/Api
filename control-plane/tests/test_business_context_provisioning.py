from uuid import UUID

from fastapi.testclient import TestClient

from app.api.auth import router
from app.main import app
from app.services.ordium_api import OrdiumProvisioningClient


def test_registration_passes_business_type_to_merchant_provisioning(monkeypatch):
    captured = {}

    def fake_provision(self, *, name, email, business_type=None, secondary_business_categories=None):
        captured.update({"name": name, "email": email, "business_type": business_type, "secondary": secondary_business_categories})
        return UUID("00000000-0000-0000-0000-000000000001")

    def fake_activate(self, merchant_id):
        return None

    def fake_store(self, merchant_id):
        return (UUID("00000000-0000-0000-0000-000000000004"), "Appliance Store Store")

    def fake_key(self, merchant_id):
        return (UUID("00000000-0000-0000-0000-000000000002"), "ordium_test_dummy")

    def fake_dashboard(self, merchant_id, environment="test"):
        return (UUID("00000000-0000-0000-0000-000000000003"), "ordium_dashboard_dummy")

    monkeypatch.setattr(OrdiumProvisioningClient, "provision_merchant", fake_provision)
    monkeypatch.setattr(OrdiumProvisioningClient, "activate_merchant", fake_activate)
    monkeypatch.setattr(OrdiumProvisioningClient, "ensure_store", fake_store)
    monkeypatch.setattr(OrdiumProvisioningClient, "create_initial_test_key", fake_key)
    monkeypatch.setattr(OrdiumProvisioningClient, "create_dashboard_key", fake_dashboard)

    client = TestClient(app)
    response = client.post("/api/v1/auth/register", json={
        "email": "buyer@example.com",
        "password": "StrongPassword123",
        "first_name": "Akram",
        "last_name": "Test",
        "organization_name": "Appliance Store",
        "country": "Algeria",
        "business_type": "Électroménager",
        "primary_market": "Algeria",
    })
    # Email verification is enabled by default in production-like config, so account creation can legitimately return 202.
    assert response.status_code in {201, 202}
    assert captured["business_type"] == "Électroménager"
