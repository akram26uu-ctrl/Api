from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.models.risk_evaluation import RiskEvaluation
from app.services.api_key_service import ApiKeyService


def _setup():
    db = SessionLocal()
    merchant = Merchant(name="Reason", email=f"reason-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
    db.add(merchant)
    db.flush()
    _, raw_key = ApiKeyService(db).create_key(
        merchant, "reason", environment="live", scopes=["orders:write", "outcomes:write"]
    )
    db.commit()
    headers = {"Authorization": f"Bearer {raw_key}"}
    client = TestClient(app)
    payload = {
        "external_order_id": f"REASON-{uuid4()}", "first_name": "Reason", "last_name": "Test",
        "phone": "0555000098", "wilaya": "Algiers", "commune": "Algiers",
        "address": "Reason Street", "total_amount": 5000, "currency": "DZD",
    }
    response = client.post("/api/v1/orders", json=payload, headers={**headers, "Idempotency-Key": str(uuid4())})
    assert response.status_code == 201, response.text
    return db, client, headers, response.json()["order_id"]


def _actual_bad(db, order_id):
    db.expire_all()
    evaluation = db.query(RiskEvaluation).filter(RiskEvaluation.order_id == UUID(order_id)).one_or_none()
    # None = unlabeled: stock / risk-decision cancellations are neither good nor bad.
    return None if evaluation is None else evaluation.actual_bad_outcome


def _post(client, headers, order_id, body):
    return client.post(f"/api/v1/orders/{order_id}/outcome", json=body, headers=headers)


def test_create_with_reason_returns_it():
    db, client, headers, order_id = _setup()
    try:
        response = _post(client, headers, order_id, {"outcome_status": "cancelled", "reason": " Out_Of_Stock "})
        assert response.status_code == 201, response.text
        assert response.json()["reason"] == "out_of_stock"
    finally:
        db.close()


def test_invalid_reason_rejected():
    db, client, headers, order_id = _setup()
    try:
        response = _post(client, headers, order_id, {"outcome_status": "cancelled", "reason": "bogus"})
        assert response.status_code == 422
    finally:
        db.close()


def test_risk_decision_cancellation_is_not_bad():
    db, client, headers, order_id = _setup()
    try:
        assert _post(client, headers, order_id, {"outcome_status": "cancelled", "reason": "risk_decision"}).status_code == 201
        assert _actual_bad(db, order_id) is None
    finally:
        db.close()


def test_customer_refused_return_is_bad():
    db, client, headers, order_id = _setup()
    try:
        assert _post(client, headers, order_id, {"outcome_status": "returned", "reason": "customer_refused"}).status_code == 201
        assert _actual_bad(db, order_id) is True
    finally:
        db.close()


def test_cancelled_without_reason_is_bad():
    db, client, headers, order_id = _setup()
    try:
        response = _post(client, headers, order_id, {"outcome_status": "cancelled"})
        assert response.status_code == 201
        assert response.json()["reason"] is None
        assert _actual_bad(db, order_id) is True
    finally:
        db.close()


def test_update_can_change_reason_and_relabels_evaluation():
    db, client, headers, order_id = _setup()
    try:
        assert _post(client, headers, order_id, {"outcome_status": "cancelled"}).status_code == 201
        assert _actual_bad(db, order_id) is True
        response = client.put(
            f"/api/v1/orders/{order_id}/outcome",
            json={"outcome_status": "cancelled", "reason": "out_of_stock"}, headers=headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["reason"] == "out_of_stock"
        assert _actual_bad(db, order_id) is None
    finally:
        db.close()


def test_correction_without_reason_keeps_existing_reason():
    db, client, headers, order_id = _setup()
    try:
        assert _post(client, headers, order_id, {"outcome_status": "cancelled", "reason": "risk_decision"}).status_code == 201
        response = client.put(
            f"/api/v1/orders/{order_id}/outcome",
            json={"outcome_status": "cancelled", "note": "typo fix"}, headers=headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["reason"] == "risk_decision"
        assert _actual_bad(db, order_id) is None
    finally:
        db.close()
