import base64
import json
import time
from urllib.parse import parse_qs, urlsplit
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db import SessionLocal
from app.main import app
from app.models.user import User
from app.services import google_oauth
from app.services.google_oauth import GoogleIdentity, GoogleOAuthError
from app.services.ordium_api import OrdiumProvisioningClient

CLIENT_ID = "pytest-client.apps.googleusercontent.com"


def _jwt(claims: dict) -> str:
    def seg(obj):
        return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()
    return f"{seg({'alg': 'RS256'})}.{seg(claims)}.signature"


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", CLIENT_ID)
    monkeypatch.setattr(settings, "google_client_secret", "pytest-secret")
    merchant_id = uuid4()
    monkeypatch.setattr(OrdiumProvisioningClient, "provision_merchant", lambda self, **kwargs: merchant_id)
    monkeypatch.setattr(OrdiumProvisioningClient, "activate_merchant", lambda self, merchant_id: None)
    monkeypatch.setattr(OrdiumProvisioningClient, "ensure_store", lambda self, merchant_id: (uuid4(), "Store"))
    monkeypatch.setattr(OrdiumProvisioningClient, "create_dashboard_key", lambda self, merchant_id, environment="test": (uuid4(), f"ordium_{environment}_dashboard"))
    monkeypatch.setattr(OrdiumProvisioningClient, "revoke_api_key", lambda self, merchant_id, api_key_id: None)

    identity = {}
    seen = {}

    def fake_exchange(code, *, code_verifier, nonce):
        seen.update(code=code, verifier=code_verifier, nonce=nonce)
        if code == "bad":
            raise GoogleOAuthError("rejected")
        return GoogleIdentity(**identity)

    monkeypatch.setattr(google_oauth, "exchange_code", fake_exchange)
    return identity, seen


def _start(client: TestClient) -> str:
    response = client.post("/api/v1/auth/google/start")
    assert response.status_code == 200
    url = urlsplit(response.json()["authorization_url"])
    params = parse_qs(url.query)
    assert url.netloc == "accounts.google.com"
    assert params["client_id"] == [CLIENT_ID]
    assert params["redirect_uri"] == [settings.public_base_url.rstrip("/") + "/auth/google/callback"]
    assert params["code_challenge_method"] == ["S256"]
    return params["state"][0]


SIGNUP_FORM = {
    "first_name": "Amina",
    "last_name": "Kaci",
    "organization_name": "Amina Boutique",
    "wilaya": "16 - Algiers",
    "ecommerce_platform": "shopify",
    "business_type": "direct_ecommerce",
    "monthly_orders": "500_2000",
    "phone": "+213550123456",
}


def test_config_reports_disabled_without_credentials(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", None)
    client = TestClient(app)
    assert client.get("/api/v1/auth/google/config").json() == {"enabled": False}
    assert client.post("/api/v1/auth/google/start").status_code == 404


def test_new_google_user_completes_store_details_then_gets_session(google):
    identity, seen = google
    identity.update(sub="google-new-1", email="amina@example.com", first_name="Amina", last_name="Kaci")
    client = TestClient(app)
    assert client.get("/api/v1/auth/google/config").json() == {"enabled": True}

    state = _start(client)
    result = client.post("/api/v1/auth/google/callback", json={"code": "good", "state": state})
    assert result.status_code == 200
    body = result.json()
    assert body["status"] == "signup_required"
    assert body["profile"] == {"email": "amina@example.com", "first_name": "Amina", "last_name": "Kaci"}
    assert seen["code"] == "good" and seen["verifier"] and seen["nonce"]
    # No account and no session exist until the store details are submitted.
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/google/pending").json()["email"] == "amina@example.com"

    created = client.post("/api/v1/auth/google/complete-signup", json=SIGNUP_FORM)
    assert created.status_code == 201, created.text
    assert created.json()["organization"]["name"] == "Amina Boutique"
    assert created.json()["organization"]["monthly_orders"] == "500_2000"
    assert created.json()["user"]["status"] == "active"

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200 and me.json()["user"]["email"] == "amina@example.com"
    with SessionLocal() as db:
        user = db.query(User).filter_by(email="amina@example.com").one()
        assert user.google_sub == "google-new-1"
        assert user.password_hash is None
        assert user.email_verified_at is not None

    # The pending sign-up is consumed.
    assert client.get("/api/v1/auth/google/pending").status_code == 401
    # The Google-only account cannot sign in with a password or change one.
    assert client.post("/api/v1/auth/change-password", json={"current_password": "x", "new_password": "StrongPassword123"}).status_code == 400
    assert TestClient(app).post("/api/v1/auth/login", json={"email": "amina@example.com", "password": "Anything12345"}).status_code == 401

    # Signing in with Google again opens the existing account directly.
    returning = TestClient(app)
    again = returning.post("/api/v1/auth/google/callback", json={"code": "good", "state": _start(returning)})
    assert again.json()["status"] == "signed_in"
    assert again.json()["session"]["organization"]["name"] == "Amina Boutique"
    assert returning.get("/api/v1/auth/me").status_code == 200


def test_complete_signup_requires_google_verified_identity(google):
    client = TestClient(app)
    response = client.post("/api/v1/auth/google/complete-signup", json=SIGNUP_FORM)
    assert response.status_code == 401
    client.cookies.set("ordium_google_signup", "forged-value")
    assert client.post("/api/v1/auth/google/complete-signup", json=SIGNUP_FORM).status_code == 401


def test_callback_rejects_wrong_or_missing_state(google):
    identity, _ = google
    identity.update(sub="google-state", email="state@example.com", first_name="S", last_name="T")
    client = TestClient(app)
    _start(client)
    assert client.post("/api/v1/auth/google/callback", json={"code": "good", "state": "x" * 43}).status_code == 400
    # The state cookie is single-use, so even the right state fails after a rejected attempt.
    assert TestClient(app).post("/api/v1/auth/google/callback", json={"code": "good", "state": "y" * 43}).status_code == 400


def test_callback_reports_google_exchange_failure(google):
    client = TestClient(app)
    assert client.post("/api/v1/auth/google/callback", json={"code": "bad", "state": _start(client)}).status_code == 400


def test_existing_active_password_account_is_linked(google):
    identity, _ = google
    client = TestClient(app)
    registered = client.post("/api/v1/auth/register", json={
        "email": "linked@example.com", "password": "StrongPassword123",
        "first_name": "Link", "last_name": "Me", "organization_name": "Linked Store",
    })
    assert registered.status_code == 201
    identity.update(sub="google-link-1", email="linked@example.com", first_name="Link", last_name="Me")
    fresh = TestClient(app)
    result = fresh.post("/api/v1/auth/google/callback", json={"code": "good", "state": _start(fresh)})
    assert result.json()["status"] == "signed_in"
    assert result.json()["session"]["organization"]["name"] == "Linked Store"
    # The password still works too.
    assert TestClient(app).post("/api/v1/auth/login", json={"email": "linked@example.com", "password": "StrongPassword123"}).status_code == 200


def test_unverified_account_is_not_taken_over_by_google(google, monkeypatch):
    identity, _ = google
    monkeypatch.setattr(settings, "require_email_verification", True)
    monkeypatch.setattr("app.api.auth.send_verification_email", lambda **kwargs: None)
    client = TestClient(app)
    assert client.post("/api/v1/auth/register", json={
        "email": "pending@example.com", "password": "StrongPassword123",
        "first_name": "P", "last_name": "Q", "organization_name": "Squatted Store",
    }).status_code == 201
    identity.update(sub="google-pending", email="pending@example.com", first_name="P", last_name="Q")
    fresh = TestClient(app)
    result = fresh.post("/api/v1/auth/google/callback", json={"code": "good", "state": _start(fresh)})
    assert result.status_code == 409
    with SessionLocal() as db:
        assert db.query(User).filter_by(email="pending@example.com").one().google_sub is None


def test_email_registration_rejects_email_used_by_google_account(google):
    identity, _ = google
    identity.update(sub="google-dup", email="dup@example.com", first_name="D", last_name="U")
    client = TestClient(app)
    client.post("/api/v1/auth/google/callback", json={"code": "good", "state": _start(client)})
    assert client.post("/api/v1/auth/google/complete-signup", json=SIGNUP_FORM).status_code == 201
    assert TestClient(app).post("/api/v1/auth/register", json={
        "email": "dup@example.com", "password": "StrongPassword123",
        "first_name": "D", "last_name": "U", "organization_name": "Dup Store",
    }).status_code == 409


class TestIdTokenValidation:
    @pytest.fixture(autouse=True)
    def _client_id(self, monkeypatch):
        monkeypatch.setattr(settings, "google_client_id", CLIENT_ID)

    def _claims(self, **overrides):
        claims = {
            "iss": "https://accounts.google.com", "aud": CLIENT_ID, "azp": CLIENT_ID,
            "sub": "123", "email": "User@Example.com", "email_verified": True,
            "given_name": "User", "family_name": "Name", "nonce": "n1", "exp": time.time() + 300,
        }
        claims.update(overrides)
        return claims

    def test_valid_token(self):
        identity = google_oauth.identity_from_id_token(_jwt(self._claims()), nonce="n1")
        assert identity == GoogleIdentity(sub="123", email="user@example.com", first_name="User", last_name="Name")

    @pytest.mark.parametrize("overrides", [
        {"iss": "https://evil.example"},
        {"aud": "another-client"},
        {"azp": "another-client"},
        {"exp": time.time() - 1},
        {"nonce": "other"},
        {"email_verified": False},
        {"sub": ""},
    ])
    def test_rejected_tokens(self, overrides):
        with pytest.raises(GoogleOAuthError):
            google_oauth.identity_from_id_token(_jwt(self._claims(**overrides)), nonce="n1")

    def test_malformed_token(self):
        with pytest.raises(GoogleOAuthError):
            google_oauth.identity_from_id_token("not-a-jwt", nonce="n1")
