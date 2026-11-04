"""Session lifecycle and sign-in hardening."""
import hashlib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import Response
from fastapi.testclient import TestClient

from app.api import auth as auth_routes
from app.auth import set_session_cookie
from app.client_ip import client_ip
from app.core.config import settings
from app.db import SessionLocal
from app.main import app
from app.models.membership import Membership
from app.models.organization import Organization
from app.models.session import Session as DbSession
from app.models.user import User
from app.services.passwords import hash_password

client = TestClient(app)


def _user_with_session(*, expires_in: timedelta, created_ago: timedelta = timedelta(0), password: str = "not-used"):
    raw = f"tok-{uuid4().hex}"
    db = SessionLocal()
    try:
        user = User(email=f"s-{uuid4().hex}@example.com", password_hash=hash_password(password) if password != "not-used" else password,
                    first_name="Sara", last_name="Test", status="active")
        db.add(user)
        db.flush()
        org = Organization(name="Org", merchant_id=uuid4(), country="Algeria")
        db.add(org)
        db.flush()
        db.add(Membership(user_id=user.id, organization_id=org.id, role="owner"))
        now = datetime.now(timezone.utc)
        session = DbSession(user_id=user.id, token_hash=hashlib.sha256(raw.encode()).hexdigest(),
                            expires_at=now + expires_in, created_at=now - created_ago, last_seen_at=now - timedelta(hours=2))
        db.add(session)
        db.commit()
        return raw, session.id, user.email
    finally:
        db.close()


def _session(session_id):
    db = SessionLocal()
    try:
        return db.get(DbSession, session_id)
    finally:
        db.close()


def _as_utc(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def test_active_session_is_renewed_and_activity_recorded():
    raw, session_id, _ = _user_with_session(expires_in=timedelta(hours=1))
    response = client.get("/api/v1/auth/me", cookies={"ordium_session": raw})
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    renewed = _session(session_id)
    assert _as_utc(renewed.expires_at) > datetime.now(timezone.utc) + timedelta(seconds=settings.session_ttl_seconds) - timedelta(minutes=1)
    assert _as_utc(renewed.last_seen_at) > datetime.now(timezone.utc) - timedelta(minutes=1)


def test_renewal_never_exceeds_absolute_lifetime():
    # Signed in 30 days minus 30 minutes ago, 20 minutes left: renewal stops at the 30-day cap.
    raw, session_id, _ = _user_with_session(expires_in=timedelta(minutes=20), created_ago=timedelta(seconds=settings.session_absolute_max_seconds) - timedelta(minutes=30))
    assert client.get("/api/v1/auth/me", cookies={"ordium_session": raw}).status_code == 200
    capped = _as_utc(_session(session_id).expires_at)
    now = datetime.now(timezone.utc)
    assert now + timedelta(minutes=25) < capped <= now + timedelta(minutes=31)


def test_expired_session_is_rejected_and_hidden_from_session_list():
    raw, _, _ = _user_with_session(expires_in=timedelta(days=1))
    expired_raw, expired_id, _ = _user_with_session(expires_in=timedelta(seconds=-1))
    assert client.get("/api/v1/auth/me", cookies={"ordium_session": expired_raw}).status_code == 401

    # Attach an expired session to the first user and make sure the list hides it.
    db = SessionLocal()
    try:
        first = db.scalar(__import__("sqlalchemy").select(DbSession).where(DbSession.token_hash == hashlib.sha256(raw.encode()).hexdigest()))
        stale = db.get(DbSession, expired_id)
        stale.user_id = first.user_id
        db.commit()
    finally:
        db.close()
    listed = client.get("/api/v1/auth/sessions", cookies={"ordium_session": raw}).json()
    assert str(expired_id) not in {item["id"] for item in listed}


def test_session_cookie_is_httponly_lax_and_long_lived():
    response = Response()
    set_session_cookie(response, "value")
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert f"max-age={settings.session_absolute_max_seconds}" in cookie


def test_account_is_locked_after_repeated_failed_sign_ins(monkeypatch):
    _, _, email = _user_with_session(expires_in=timedelta(days=1), password="Correct-Password-123")
    monkeypatch.setattr(auth_routes, "_rate_limit", lambda *args, **kwargs: None)
    for _ in range(auth_routes._FAILED_LOGIN_LIMIT):
        assert client.post("/api/v1/auth/login", json={"email": email, "password": "Wrong-Password-123"}).status_code == 401
    locked = client.post("/api/v1/auth/login", json={"email": email, "password": "Correct-Password-123"})
    assert locked.status_code == 429
    auth_routes._clear_failed_logins(email)


def test_unknown_email_still_verifies_a_password_hash(monkeypatch):
    calls = []
    real = auth_routes.verify_password
    monkeypatch.setattr(auth_routes, "verify_password", lambda pw, h: calls.append(h) or real(pw, h))
    monkeypatch.setattr(auth_routes, "_rate_limit", lambda *args, **kwargs: None)
    response = client.post("/api/v1/auth/login", json={"email": f"nobody-{uuid4().hex}@example.com", "password": "Whatever-123456"})
    assert response.status_code == 401
    assert calls == [auth_routes._DUMMY_PASSWORD_HASH]


def test_client_ip_trusts_reported_ip_only_from_internal_proxy(monkeypatch):
    monkeypatch.setattr(settings, "trusted_proxy_networks", "172.16.0.0/12")
    proxied = SimpleNamespace(client=SimpleNamespace(host="172.18.0.5"), headers={"x-ordium-client-ip": "41.111.2.3"})
    direct = SimpleNamespace(client=SimpleNamespace(host="203.0.113.7"), headers={"x-ordium-client-ip": "41.111.2.3"})
    garbage = SimpleNamespace(client=SimpleNamespace(host="172.18.0.5"), headers={"x-ordium-client-ip": "not-an-ip"})
    assert client_ip(proxied) == "41.111.2.3"
    assert client_ip(direct) == "203.0.113.7"
    assert client_ip(garbage) == "172.18.0.5"
