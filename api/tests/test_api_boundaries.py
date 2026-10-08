from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.models.store import Store
from app.models.order import Order
from app.services.api_key_service import ApiKeyService


client = TestClient(app)


def create_active_merchant(db):
    merchant = Merchant(
        name="Boundary Merchant",
        email=f"boundary-{uuid4()}@ordium.local",
        status=MerchantStatus.ACTIVE,
    )
    db.add(merchant)
    db.flush()
    return merchant


def payload(external_order_id: str, phone: str = "0555000001"):
    return {
        "external_order_id": external_order_id,
        "first_name": "Boundary",
        "last_name": "Customer",
        "phone": phone,
        "wilaya": "Algiers",
        "commune": "Bab Ezzouar",
        "address": "1 Test Street",
        "total_amount": "5000.00",
        "currency": "DZD",
    }


def test_order_creation_works_without_idempotency_key():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, raw_key = ApiKeyService(db).create_key(
            merchant=merchant,
            name="No Idempotency",
            environment="live",
        )
        db.commit()

        response = client.post(
            "/api/v1/orders",
            json=payload(f"no-idempotency-{uuid4()}"),
            headers={"Authorization": f"Bearer {raw_key}"},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["environment"] == "live"
        assert "risk" in body
    finally:
        db.rollback()
        db.close()


def test_idempotency_replays_exact_original_response():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        api_key, raw_key = ApiKeyService(db).create_key(
            merchant=merchant,
            name="Live Test Key",
            environment="live",
        )
        db.commit()

        request_payload = payload(f"idem-{uuid4()}")
        headers = {
            "Authorization": f"Bearer {raw_key}",
            "Idempotency-Key": f"idem-key-{uuid4()}",
        }

        first = client.post("/api/v1/orders", json=request_payload, headers=headers)
        second = client.post("/api/v1/orders", json=request_payload, headers=headers)

        assert first.status_code == 201
        assert second.status_code == 201
        assert second.json() == first.json()

        count = db.scalar(
            select(func.count(Order.id)).where(Order.merchant_id == merchant.id)
        )
        assert count == 1

        # Outcome changes the current database state, but idempotent replay must
        # still return the original create response exactly.
        order_id = first.json()["order_id"]
        outcome = client.post(
            f"/api/v1/orders/{order_id}/outcome",
            json={"outcome_status": "cancelled"},
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert outcome.status_code == 201

        third = client.post("/api/v1/orders", json=request_payload, headers=headers)
        assert third.status_code == 201
        assert third.json() == first.json()
        assert third.json()["status"] == "pending"
    finally:
        db.rollback()
        db.close()


def test_same_idempotency_key_with_different_request_is_rejected():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, raw_key = ApiKeyService(db).create_key(
            merchant=merchant,
            name="Idempotency Key",
            environment="live",
        )
        db.commit()

        key = f"reuse-{uuid4()}"
        headers = {
            "Authorization": f"Bearer {raw_key}",
            "Idempotency-Key": key,
        }

        first = client.post(
            "/api/v1/orders",
            json=payload(f"first-{uuid4()}", "0555000002"),
            headers=headers,
        )
        second = client.post(
            "/api/v1/orders",
            json=payload(f"different-{uuid4()}", "0555000003"),
            headers=headers,
        )

        assert first.status_code == 201
        assert second.status_code == 422
        assert "Idempotency-Key" in second.json()["detail"]
    finally:
        db.rollback()
        db.close()


def test_test_environment_does_not_contaminate_live_risk_history():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, live_key = ApiKeyService(db).create_key(
            merchant=merchant,
            name="Live Key",
            environment="live",
        )
        _, test_key = ApiKeyService(db).create_key(
            merchant=merchant,
            name="Test Key",
            environment="test",
        )
        db.commit()

        # Build five TEST orders in the same short window. These would trigger
        # high order/IP frequency if the environment filter were missing.
        for i in range(5):
            response = client.post(
                "/api/v1/orders",
                json=payload(f"shared-external-{i}", f"05550000{i + 10:02d}"),
                headers={
                    "Authorization": f"Bearer {test_key}",
                    "Idempotency-Key": f"test-{uuid4()}",
                },
            )
            assert response.status_code == 201

        live_response = client.post(
            "/api/v1/orders",
            json=payload("shared-external-id", "0555000099"),
            headers={
                "Authorization": f"Bearer {live_key}",
                "Idempotency-Key": f"live-{uuid4()}",
            },
        )

        assert live_response.status_code == 201
        body = live_response.json()
        assert body["environment"] == "live"
        assert body["risk"]["score"] == 0

        live_order = db.scalar(
            select(Order).where(Order.external_order_id == "shared-external-id")
        )
        assert live_order is not None
        assert live_order.environment == "live"
        assert live_order.data_origin == "real"

        test_orders = db.scalars(
            select(Order).where(
                Order.merchant_id == merchant.id,
                Order.environment == "test",
            )
        ).all()
        assert len(test_orders) == 5
        assert all(order.data_origin == "test" for order in test_orders)
    finally:
        db.rollback()
        db.close()


def test_suspended_merchant_cannot_use_active_api_key():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, raw_key = ApiKeyService(db).create_key(
            merchant=merchant,
            name="Suspension Test",
            environment="live",
        )
        merchant.status = MerchantStatus.SUSPENDED
        db.commit()

        response = client.post(
            "/api/v1/orders",
            json=payload(f"suspended-{uuid4()}", "0555000010"),
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or inactive API key"
    finally:
        db.rollback()
        db.close()


def test_test_order_outcome_does_not_enter_production_evaluation_metrics():
    from app.models.risk_evaluation import RiskEvaluation

    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, test_key = ApiKeyService(db).create_key(
            merchant=merchant,
            name="Sandbox Evaluation Key",
            environment="test",
        )
        db.commit()

        order_response = client.post(
            "/api/v1/orders",
            json=payload(f"evaluation-test-{uuid4()}", "0555000088"),
            headers={
                "Authorization": f"Bearer {test_key}",
                "Idempotency-Key": f"evaluation-test-{uuid4()}",
            },
        )
        assert order_response.status_code == 201
        order_id = order_response.json()["order_id"]

        outcome_response = client.post(
            f"/api/v1/orders/{order_id}/outcome",
            json={"outcome_status": "cancelled"},
            headers={"Authorization": f"Bearer {test_key}"},
        )
        assert outcome_response.status_code == 201

        evaluation = db.scalar(
            select(RiskEvaluation).where(RiskEvaluation.order_id == UUID(order_id))
        )
        assert evaluation is None
    finally:
        db.rollback()
        db.close()


def test_risk_performance_endpoint_returns_production_metrics_only():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, raw_key = ApiKeyService(db).create_key(
            merchant=merchant,
            name="Metrics Key",
            environment="live",
            scopes=["metrics:read"],
        )
        db.commit()

        response = client.get(
            "/api/v1/metrics/risk-performance",
            headers={"Authorization": f"Bearer {raw_key}"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["evaluated_orders"] == 0
        assert body["detection_rate"] == 0.0
    finally:
        db.rollback()
        db.close()


def test_test_api_key_cannot_update_live_order_outcome():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, live_key = ApiKeyService(db).create_key(merchant, "live", environment="live")
        _, test_key = ApiKeyService(db).create_key(merchant, "test", environment="test")
        db.commit()

        live_response = client.post(
            "/api/v1/orders",
            json=payload(f"live-outcome-{uuid4()}", "0555000077"),
            headers={
                "Authorization": f"Bearer {live_key}",
                "Idempotency-Key": f"live-outcome-{uuid4()}",
            },
        )
        assert live_response.status_code == 201
        order_id = live_response.json()["order_id"]

        response = client.post(
            f"/api/v1/orders/{order_id}/outcome",
            json={"outcome_status": "cancelled"},
            headers={"Authorization": f"Bearer {test_key}"},
        )
        assert response.status_code == 404

        live_outcome = client.post(
            f"/api/v1/orders/{order_id}/outcome",
            json={"outcome_status": "cancelled"},
            headers={"Authorization": f"Bearer {live_key}"},
        )
        assert live_outcome.status_code == 201
    finally:
        db.rollback()
        db.close()


def test_test_api_key_cannot_read_production_metrics():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, test_key = ApiKeyService(db).create_key(merchant, "test-metrics", environment="test")
        db.commit()
        response = client.get(
            "/api/v1/metrics/risk-performance",
            headers={"Authorization": f"Bearer {test_key}"},
        )
        assert response.status_code == 403
    finally:
        db.rollback()
        db.close()


def test_client_ip_does_not_trust_forwarded_header_by_default(monkeypatch):
    from app.api.client_ip import get_client_ip
    from fastapi import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"x-forwarded-for", b"198.51.100.99")],
        "client": ("10.0.0.8", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
        "query_string": b"",
        "path_params": {},
        "root_path": "",
    }
    monkeypatch.setattr("app.api.client_ip.settings.trusted_proxy_networks", "")
    assert get_client_ip(Request(scope)) == "10.0.0.8"


def test_client_ip_uses_forwarded_header_only_for_trusted_proxy(monkeypatch):
    from app.api.client_ip import get_client_ip
    from fastapi import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(b"x-forwarded-for", b"198.51.100.99, 10.0.0.8")],
        "client": ("10.0.0.8", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
        "query_string": b"",
        "path_params": {},
        "root_path": "",
    }
    monkeypatch.setattr("app.api.client_ip.settings.trusted_proxy_networks", "10.0.0.8/32")
    assert get_client_ip(Request(scope)) == "198.51.100.99"


def test_authenticated_requests_expose_security_headers_and_rate_limit_headers():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, raw_key = ApiKeyService(db).create_key(merchant=merchant, name="Headers", environment="live", scopes=["risk_profile:read"])
        db.commit()
        response = client.get("/api/v1/risk-profile", headers={"Authorization": f"Bearer {raw_key}"})
        assert response.status_code == 200
        assert response.headers.get("x-request-id")
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers.get("x-ratelimit-limit")
        assert response.headers.get("x-ratelimit-remaining")
        assert response.headers.get("x-ratelimit-reset")
    finally:
        db.rollback()
        db.close()


def test_idempotency_key_isolated_between_live_and_test():
    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, live_key = ApiKeyService(db).create_key(merchant=merchant, name="Live", environment="live")
        _, test_key = ApiKeyService(db).create_key(merchant=merchant, name="Test", environment="test")
        db.commit()
        shared_key = f"shared-{uuid4()}"
        live = client.post("/api/v1/orders", json=payload(f"live-{uuid4()}"), headers={"Authorization": f"Bearer {live_key}", "Idempotency-Key": shared_key})
        sandbox = client.post("/api/v1/orders", json=payload(f"test-{uuid4()}", "0555000098"), headers={"Authorization": f"Bearer {test_key}", "Idempotency-Key": shared_key})
        assert live.status_code == 201
        assert sandbox.status_code == 201
        assert live.json()["environment"] == "live"
        assert sandbox.json()["environment"] == "test"
    finally:
        db.rollback()
        db.close()


def test_rate_limit_returns_429_after_limit(monkeypatch):
    from app.core.config import settings

    db = SessionLocal()
    try:
        merchant = create_active_merchant(db)
        _, raw_key = ApiKeyService(db).create_key(merchant=merchant, name="Rate", environment="live", scopes=["risk_profile:read"])
        db.commit()
        monkeypatch.setattr(settings, "live_requests_per_minute", 1)
        first = client.get("/api/v1/risk-profile", headers={"Authorization": f"Bearer {raw_key}"})
        second = client.get("/api/v1/risk-profile", headers={"Authorization": f"Bearer {raw_key}"})
        assert first.status_code == 200
        assert second.status_code == 429
        assert second.headers.get("retry-after")
        assert second.json()["detail"] == "Rate limit exceeded"
    finally:
        db.rollback()
        db.close()
