from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus, OrderStatus, RiskDecision
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.order_outcome import OrderOutcome
from app.models.risk_assessment import RiskAssessment
from app.models.risk_evaluation import RiskEvaluation
from app.models.store import Store
from app.models.store import Store
from app.services.risk_evaluation_service import RiskEvaluationService


def _fixtures(db):
    merchant = Merchant(name="Calibration", email=f"cal-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
    db.add(merchant); db.flush()
    store = Store(merchant_id=merchant.id, name="Calibration Store", slug=f"calibration-{uuid4()}", is_active=True)
    db.add(store); db.flush()
    order = Order(merchant_id=merchant.id, store_id=store.id, external_order_id=f"CAL-{uuid4()}", status=OrderStatus.PENDING,
                  total_amount=5000, currency="DZD", first_name="Cal", last_name="Test",
                  environment="live", data_origin="real")
    db.add(order); db.flush()
    assessment = RiskAssessment(order_id=order.id, score=65, decision=RiskDecision.REVIEW,
                                model_version="rules-v3", rules_version="test", risk_profile_version="test")
    db.add(assessment); db.flush()
    return order, assessment


def test_feedback_uses_outcome_time_and_can_be_corrected():
    db = SessionLocal()
    try:
        order, assessment = _fixtures(db)
        first_time = datetime.now(timezone.utc) - timedelta(days=10)
        first = OrderOutcome(order_id=order.id, outcome_status="cancelled", source="merchant", occurred_at=first_time)
        db.add(first); db.flush()

        service = RiskEvaluationService(db)
        evaluation = service.record_from_outcome(order, assessment, first)
        assert evaluation is not None
        assert evaluation.actual_bad_outcome is True
        assert evaluation.outcome_status == "cancelled"
        assert evaluation.outcome_occurred_at == first_time

        corrected_time = first_time + timedelta(days=1)
        corrected = OrderOutcome(order_id=order.id, outcome_status="delivered", source="merchant", occurred_at=corrected_time)
        # Simulate a corrected source record without creating a second DB row.
        evaluation = service.repository.update_from_outcome(
            evaluation, outcome_status=corrected.outcome_status, outcome_occurred_at=corrected.occurred_at,
            actual_bad_outcome=False, classification="false_positive",
        )
        assert evaluation.actual_bad_outcome is False
        assert evaluation.classification == "false_positive"
        assert evaluation.outcome_status == "delivered"
        assert evaluation.outcome_occurred_at == corrected_time
    finally:
        db.rollback(); db.close()


def test_metrics_use_outcome_occurred_at_window():
    db = SessionLocal()
    try:
        order, assessment = _fixtures(db)
        occurred = datetime.now(timezone.utc) - timedelta(days=40)
        evaluation = RiskEvaluation(
            merchant_id=order.merchant_id, order_id=order.id, risk_assessment_id=assessment.id,
            environment="live", data_origin="real", predicted_risky=True, actual_bad_outcome=True,
            outcome_status="cancelled", outcome_occurred_at=occurred, classification="true_positive",
        )
        db.add(evaluation); db.flush()
        counts = __import__("app.repositories.risk_evaluation_repository", fromlist=["RiskEvaluationRepository"]).RiskEvaluationRepository(db).counts(
            order.merchant_id, since=datetime.now(timezone.utc) - timedelta(days=30)
        )
        assert counts == {}
    finally:
        db.rollback(); db.close()


def test_outcome_correction_reclassifies_existing_feedback():
    from app.models.api_key import ApiKey
    from app.services.api_key_service import ApiKeyService
    from fastapi.testclient import TestClient
    from app.main import app

    db = SessionLocal()
    try:
        merchant = Merchant(name="Correction", email=f"corr-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant); db.flush()
        _, raw_key = ApiKeyService(db).create_key(merchant, "correction", environment="live", scopes=["orders:write", "outcomes:write"])
        db.commit()
        client = TestClient(app)
        # Create an order through the API so all required order fields are present.
        payload = {
            "external_order_id": f"CORR-{uuid4()}", "first_name": "Correct", "last_name": "Me",
            "phone": "0555000099", "wilaya": "Algiers", "commune": "Algiers",
            "address": "Correction Street", "total_amount": 5000, "currency": "DZD"
        }
        response = client.post("/api/v1/orders", json=payload, headers={"Authorization": f"Bearer {raw_key}", "Idempotency-Key": str(uuid4())})
        assert response.status_code == 201, response.text
        order_id = response.json()["order_id"]

        first = client.post(f"/api/v1/orders/{order_id}/outcome", json={"outcome_status": "cancelled"}, headers={"Authorization": f"Bearer {raw_key}"})
        assert first.status_code == 201, first.text
        corrected = client.put(f"/api/v1/orders/{order_id}/outcome", json={"outcome_status": "delivered"}, headers={"Authorization": f"Bearer {raw_key}"})
        assert corrected.status_code == 200, corrected.text
        assert corrected.json()["outcome_status"] == "delivered"
    finally:
        db.rollback(); db.close()


def test_quality_bucket_diagnostics_detect_non_monotonic_curve():
    buckets = [
        {"score_bucket": "0-24", "evaluated_orders": 60, "bad_outcomes": 6, "bad_rate": 0.10},
        {"score_bucket": "25-49", "evaluated_orders": 60, "bad_outcomes": 18, "bad_rate": 0.30},
        {"score_bucket": "50-69", "evaluated_orders": 60, "bad_outcomes": 12, "bad_rate": 0.20},
    ]
    quality, violations = RiskEvaluationService.quality_buckets(buckets, minimum_samples=50)
    assert all(item["sample_sufficient"] for item in quality)
    assert violations == ["25-49=0.300000 > 50-69=0.200000"]


def test_quality_signal_diagnostics_use_baseline_and_minimum_sample():
    signals = [
        {"event_type": "vpn_detected", "evaluated_orders": 20, "bad_outcomes": 10},
        {"event_type": "proxy_detected", "evaluated_orders": 60, "bad_outcomes": 30},
    ]
    result = RiskEvaluationService.quality_signals(
        signals,
        evaluated_orders=100,
        overall_bad_rate=0.20,
        minimum_samples=50,
    )
    assert result[0]["sample_sufficient"] is False
    assert result[0]["support_rate"] == 0.2
    assert result[0]["lift_vs_baseline"] == 2.5
    assert result[1]["sample_sufficient"] is True
    assert result[1]["lift_vs_baseline"] == 2.5


def test_risk_quality_endpoint_is_merchant_scoped_and_reports_signals():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.models.api_key import ApiKey
    from app.models.risk_event import RiskEvent
    from app.services.api_key_service import ApiKeyService

    db = SessionLocal()
    try:
        merchant = Merchant(name="Quality", email=f"quality-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant); db.flush()
        store = Store(merchant_id=merchant.id, name="Quality Store", slug=f"quality-{uuid4()}", is_active=True)
        db.add(store); db.flush()
        _, raw_key = ApiKeyService(db).create_key(
            merchant,
            "quality",
            environment="live",
            scopes=["metrics:read"],
        )
        order = Order(
            merchant_id=merchant.id, external_order_id=f"QUALITY-{uuid4()}", status=OrderStatus.PENDING,
            total_amount=5000, currency="DZD", first_name="Quality", last_name="Test",
            environment="live", data_origin="real", store_id=store.id,
        )
        db.add(order); db.flush()
        assessment = RiskAssessment(
            order_id=order.id, score=65, decision=RiskDecision.REVIEW,
            model_version="rules-v3", rules_version="test", risk_profile_version=1,
        )
        db.add(assessment); db.flush()
        event = RiskEvent(
            risk_assessment_id=assessment.id,
            event_type="vpn_detected",
            score_impact=15,
            event_data={"source": "test"},
        )
        db.add(event)
        evaluation = RiskEvaluation(
            merchant_id=merchant.id,
            order_id=order.id,
            risk_assessment_id=assessment.id,
            environment="live",
            data_origin="real",
            predicted_risky=True,
            actual_bad_outcome=True,
            outcome_status="cancelled",
            outcome_occurred_at=datetime.now(timezone.utc),
            classification="true_positive",
        )
        db.add(evaluation)
        db.commit()

        from app.repositories.risk_evaluation_repository import RiskEvaluationRepository
        assert RiskEvaluationRepository(db).threshold_counts(merchant.id, 50) == {
            "true_positives": 1, "false_positives": 0, "true_negatives": 0, "false_negatives": 0, "evaluated_orders": 1,
        }

        response = TestClient(app).get(
            "/api/v1/metrics/risk-quality?minimum_samples=1",
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["evaluated_orders"] == 1
        assert body["overall_bad_rate"] == 1.0
        assert body["review_threshold"] == 50
        assert body["reject_threshold"] == 80
        assert body["review_operating_point"]["true_positives"] == 1
        assert body["reject_operating_point"]["false_negatives"] == 1
        assert body["signals"][0]["event_type"] == "vpn_detected"
        assert body["signals"][0]["bad_rate"] == 1.0
        assert body["signals"][0]["sample_sufficient"] is True

        backtest = TestClient(app).get(
            "/api/v1/metrics/risk-backtest?minimum_samples=1",
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert backtest.status_code == 200, backtest.text
        backtest_body = backtest.json()
        assert backtest_body["replay_mode"] == "persisted-event-replay"
        assert backtest_body["changes_applied"] is False
        assert backtest_body["evaluated_orders"] == 1
    finally:
        db.rollback(); db.close()


def test_quality_signal_pairs_measure_overlap_without_calling_it_double_counting():
    pairs = [
        {
            "event_type_a": "device_reused",
            "event_type_b": "multiple_customers_same_device",
            "evaluated_orders": 40,
            "bad_outcomes": 30,
            "bad_rate": 0.75,
            "average_combined_score_impact": 45.0,
        },
        {
            "event_type_a": "vpn_detected",
            "event_type_b": "proxy_detected",
            "evaluated_orders": 10,
            "bad_outcomes": 8,
            "bad_rate": 0.80,
            "average_combined_score_impact": 30.0,
        },
    ]
    result = RiskEvaluationService.quality_signal_pairs(
        pairs,
        evaluated_orders=100,
        signal_support={
            "device_reused": 50,
            "multiple_customers_same_device": 60,
            "vpn_detected": 20,
            "proxy_detected": 30,
        },
        minimum_samples=20,
        overlap_threshold=0.50,
    )
    assert result[0]["jaccard_overlap"] == round(40 / (50 + 60 - 40), 6)
    assert result[0]["sample_sufficient"] is True
    assert result[0]["high_overlap"] is True
    assert result[0]["support_rate"] == 0.4
    assert result[1]["sample_sufficient"] is False
    assert result[1]["high_overlap"] is False


def test_score_attribution_identifies_dominant_signal_and_cap_loss():
    evaluations = [
        {
            "events": {"phone_reused": 15, "device_reused": 20},
            "final_score": 35,
            "actual_bad": True,
        },
        {
            "events": {"high_cancel_rate": 35, "device_reused": 20, "vpn_detected": 15},
            "final_score": 50,
            "actual_bad": False,
        },
    ]
    result = RiskEvaluationService.score_attribution(evaluations, minimum_samples=2)
    assert result["evaluated_orders"] == 2
    assert result["total_raw_event_score"] == 105
    assert result["total_final_score"] == 85
    assert result["capped_orders"] == 1
    assert result["total_capped_score_loss"] == 20
    assert result["dominant_signal_orders"] == 2
    assert result["strongly_dominant_signal_orders"] == 0
    signals = {item["event_type"]: item for item in result["signals"]}
    assert signals["device_reused"]["triggered_orders"] == 2
    assert signals["device_reused"]["sample_sufficient"] is True
    assert signals["device_reused"]["total_score_impact"] == 40
    assert signals["high_cancel_rate"]["bad_rate"] == 0.0


def test_score_attribution_does_not_double_count_duplicate_event_type():
    evaluations = [
        {
            "events": {"device_reused": 20},
            "final_score": 20,
            "actual_bad": True,
        },
    ]
    result = RiskEvaluationService.score_attribution(evaluations, minimum_samples=1)
    assert result["total_raw_event_score"] == 20
    assert result["signals"][0]["triggered_orders"] == 1
    assert result["signals"][0]["total_score_impact"] == 20
