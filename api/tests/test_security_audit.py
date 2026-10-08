from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.client_ip import get_client_ip
from app.api.dependencies import _test_merchant_rate_windows, _test_rate_windows
from app.core.config import Settings, settings
from app.db.database import SessionLocal
from app.main import app, unhandled_exception_handler
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.services.api_key_service import ApiKeyService
from app.services.network_intelligence import IPQualityScoreProvider
from app.services.webhook_service import WebhookService

client = TestClient(app)


def merchant(db, prefix="security"):
    item = Merchant(name="Security Audit", email=f"{prefix}-{uuid4()}@example.com", status=MerchantStatus.ACTIVE)
    db.add(item)
    db.flush()
    return item


def order_payload(external=None, phone="0555000011"):
    return {
        "external_order_id": external or str(uuid4()),
        "first_name": "Test",
        "last_name": "Merchant",
        "phone": phone,
        "wilaya": "Algiers",
        "commune": "Algiers",
        "address": "1 Security Street",
        "total_amount": 1000,
        "currency": "DZD",
    }


def test_invalid_object_ids_are_not_500():
    db = SessionLocal()
    try:
        m = merchant(db)
        _, key = ApiKeyService(db).create_key(m, "security", "live", scopes=["keys:manage", "webhooks:manage"])
        db.commit()
        h = {"Authorization": f"Bearer {key}"}
        for path in (
            "/api/v1/api-keys/not-a-uuid/revoke",
            "/api/v1/api-keys/not-a-uuid/rotate",
            "/api/v1/webhooks/not-a-uuid/disable",
        ):
            r = client.post(path, headers=h)
            assert r.status_code in {400, 422}
    finally:
        db.rollback(); db.close()


def test_trusted_proxy_walks_from_right_to_left(monkeypatch):
    scope = {
        "type": "http", "method": "GET", "path": "/",
        "headers": [(b"x-forwarded-for", b"198.51.100.100, 10.0.0.9, 10.0.0.8")],
        "client": ("10.0.0.8", 12345), "server": ("testserver", 80),
        "scheme": "http", "query_string": b"", "path_params": {}, "root_path": "",
    }
    monkeypatch.setattr(settings, "trusted_proxy_networks", "10.0.0.0/8")
    assert get_client_ip(Request(scope)) == "198.51.100.100"


def test_production_configuration_fails_closed():
    base = dict(
        ENVIRONMENT="production",
        DEBUG="false",
        DATABASE_URL="postgresql+psycopg://user:pass@db.example/ordium",
        SECRET_KEY="x" * 48,
        NETWORK_INTELLIGENCE_PROVIDER="ipqs",
        IPQS_API_KEY="key",
        ENABLE_DOCS="false",
        ALLOWED_HOSTS="api.example.com",
    )
    with pytest.raises(ValueError, match="ENABLE_DOCS"):
        Settings(**{**base, "ENABLE_DOCS": "true", "DEBUG": "false", "NETWORK_INTELLIGENCE_PROVIDER": "ipqs"})
    with pytest.raises(ValueError, match="ALLOWED_HOSTS"):
        Settings(**{**base, "ALLOWED_HOSTS": ""})
    with pytest.raises(ValueError, match="SQLite"):
        Settings(**{**base, "DATABASE_URL": "sqlite+pysqlite:///prod.db"})
    with pytest.raises(ValueError, match="NETWORK_INTELLIGENCE_PROVIDER=mock"):
        Settings(**{**base, "NETWORK_INTELLIGENCE_PROVIDER": "mock"})
    with pytest.raises(ValueError, match="DEBUG"):
        Settings(**{**base, "DEBUG": "true"})


def test_webhook_rejects_userinfo_and_fragment():
    service = WebhookService(None)
    with pytest.raises(ValueError):
        service.validate_url("https://user:pass@example.com/hook")
    with pytest.raises(ValueError):
        service.validate_url("https://example.com/hook#secret")


def test_ipqs_key_is_not_in_url(monkeypatch):
    captured = {}
    class Response:
        def raise_for_status(self): pass
        def json(self): return {"vpn": False, "fraud_score": 1}
    def fake_get(url, **kwargs):
        captured.update(url=url, headers=kwargs["headers"], params=kwargs["params"])
        return Response()
    monkeypatch.setattr("app.services.network_intelligence.httpx.get", fake_get)
    result = IPQualityScoreProvider(api_key="SUPER-SECRET").lookup("8.8.8.8")
    assert result.available
    assert "SUPER-SECRET" not in captured["url"]
    assert captured["headers"]["IPQS-KEY"] == "SUPER-SECRET"
    assert captured["params"]["ip"] == "8.8.8.8"


def test_multi_key_rate_limit_bypass_is_blocked(monkeypatch):
    db = SessionLocal()
    try:
        m = merchant(db)
        _, key1 = ApiKeyService(db).create_key(m, "one", "live")
        _, key2 = ApiKeyService(db).create_key(m, "two", "live")
        db.commit()
        monkeypatch.setattr(settings, "live_requests_per_minute", 1000)
        monkeypatch.setattr(settings, "live_requests_per_minute_per_merchant", 2)
        _test_rate_windows.clear(); _test_merchant_rate_windows.clear()
        for key in (key1, key2):
            r = client.post("/api/v1/orders", json=order_payload(), headers={"Authorization": f"Bearer {key}", "Idempotency-Key": str(uuid4())})
            assert r.status_code == 201
        r = client.post("/api/v1/orders", json=order_payload(), headers={"Authorization": f"Bearer {key2}", "Idempotency-Key": str(uuid4())})
        assert r.status_code == 429
    finally:
        _test_rate_windows.clear(); _test_merchant_rate_windows.clear()
        db.rollback(); db.close()


def test_expired_api_key_is_rejected_even_with_naive_db_datetime():
    db = SessionLocal()
    try:
        m = merchant(db)
        key, raw = ApiKeyService(db).create_key(m, "expired", "live")
        key.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
        r = client.get("/api/v1/risk-features", headers={"Authorization": f"Bearer {raw}"})
        assert r.status_code == 401
    finally:
        db.rollback(); db.close()


def test_error_logging_redacts_exception_text_when_debug_disabled(caplog):
    scope = {
        "type": "http", "method": "GET", "path": "/probe", "headers": [],
        "client": ("127.0.0.1", 1), "server": ("testserver", 80), "scheme": "http",
        "query_string": b"", "path_params": {}, "root_path": "", "state": {"request_id": str(uuid4())},
    }
    request = Request(scope)
    secret = "SUPER_SECRET_EXCEPTION_VALUE"
    with caplog.at_level(logging.ERROR):
        response = asyncio.run(unhandled_exception_handler(request, RuntimeError(secret)))
    assert response.status_code == 500
    assert secret not in caplog.text


def test_cross_merchant_object_authorization_for_webhooks_and_keys():
    db = SessionLocal()
    try:
        a = merchant(db, "a")
        b = merchant(db, "b")
        _, key_a = ApiKeyService(db).create_key(a, "a", "live", scopes=["webhooks:manage", "keys:manage"])
        _, key_b = ApiKeyService(db).create_key(b, "b", "live", scopes=["webhooks:manage", "keys:manage"])
        db.commit()
        ra = client.post("/api/v1/webhooks", json={"url": "https://1.1.1.1/a", "events": ["*"]}, headers={"Authorization": f"Bearer {key_a}"})
        assert ra.status_code == 201
        endpoint_id = ra.json()["id"]
        assert client.post(f"/api/v1/webhooks/{endpoint_id}/disable", headers={"Authorization": f"Bearer {key_b}"}).status_code == 404
        assert client.post(f"/api/v1/api-keys/{endpoint_id}/revoke", headers={"Authorization": f"Bearer {key_b}"}).status_code == 404
    finally:
        db.rollback(); db.close()


def test_global_reputation_event_does_not_disclose_cross_merchant_counts():
    # Static contract test: global reputation signals must stay abstract in API-visible event_data.
    from app.services.risk_rules import RiskRules
    import inspect
    source = inspect.getsource(RiskRules.evaluate_global_phone_reputation)
    assert '"orders": total' not in source
    assert '"bad_orders": bad' not in source
    assert '"merchants": merchants' not in source


def test_api_key_rotation_cannot_escalate_scopes():
    db = SessionLocal()
    try:
        m = merchant(db, "rotate-scope")
        target, _ = ApiKeyService(db).create_key(
            m,
            "privileged",
            "live",
            scopes=["keys:manage", "webhooks:manage", "audit:read"],
        )
        _, scoped_raw = ApiKeyService(db).create_key(
            m,
            "scoped",
            "live",
            scopes=["keys:manage"],
        )
        db.commit()
        response = client.post(
            f"/api/v1/api-keys/{target.id}/rotate",
            headers={"Authorization": f"Bearer {scoped_raw}"},
        )
        assert response.status_code == 403
    finally:
        db.rollback(); db.close()


def test_identity_resolution_is_merchant_scoped():
    from app.services.identity_service import IdentityService
    from app.repositories.merchant_customer_repository import MerchantCustomerRepository
    from app.models.customer import Customer
    from app.models.customer_phone import CustomerPhone
    from app.models.phone_identifier import PhoneIdentifier
    from app.models.merchant_customer import MerchantCustomer

    db = SessionLocal()
    try:
        a = merchant(db, "identity-a")
        b = merchant(db, "identity-b")
        phone = PhoneIdentifier(phone="0555111222")
        customer_b = Customer(first_name="John", last_name="Doe", normalized_name="john doe")
        db.add_all([phone, customer_b]); db.flush()
        db.add(MerchantCustomer(merchant_id=b.id, customer_id=customer_b.id))
        db.add(CustomerPhone(customer_id=customer_b.id, phone_identifier_id=phone.id))
        db.commit()

        result = IdentityService(db).resolve_customer(
            merchant_id=a.id,
            first_name="John",
            last_name="Doe",
            phone="0555111222",
        )
        assert result.customer.id != customer_b.id
        link = MerchantCustomerRepository(db).get(a.id, result.customer.id)
        assert link is not None
    finally:
        db.rollback(); db.close()
