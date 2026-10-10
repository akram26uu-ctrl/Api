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

def test_logout_clears_cookie_and_revokes_session():
    import hashlib
    from datetime import datetime, timedelta, timezone

    from app.db import SessionLocal
    from app.models.session import Session as DbSession
    from app.models.user import User

    raw_token = "test-logout-token"
    db = SessionLocal()
    try:
        user = User(
            email="logout-cookie-regression@example.com",
            password_hash="not-used",
            first_name="Logout",
            last_name="Regression",
            status="active",
        )
        db.add(user)
        db.flush()
        session = DbSession(
            user_id=user.id,
            token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(session)
        db.commit()
        session_id = session.id
    finally:
        db.close()

    client = TestClient(app)
    client.cookies.set("ordium_session", raw_token)
    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 204
    set_cookie = response.headers.get("set-cookie", "").lower()
    assert "ordium_session" in set_cookie
    assert "max-age=0" in set_cookie or "expires=" in set_cookie

    db = SessionLocal()
    try:
        persisted = db.get(DbSession, session_id)
        assert persisted is not None
        assert persisted.revoked_at is not None
    finally:
        db.close()



def test_registration_rejects_whitespace_only_required_fields():
    import pytest
    from pydantic import ValidationError
    from app.schemas.auth import RegisterRequest

    base = {
        "email": "spaces@example.com",
        "password": "StrongPassword123",
        "first_name": "Valid",
        "last_name": "User",
        "organization_name": "Valid Store",
        "country": "Algeria",
    }
    for field in ("first_name", "last_name", "organization_name", "country"):
        payload = {**base, field: "   "}
        with pytest.raises(ValidationError):
            RegisterRequest(**payload)
