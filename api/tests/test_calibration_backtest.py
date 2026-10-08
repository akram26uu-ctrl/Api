from app.services.risk_evaluation_service import RiskEvaluationService


def rows():
    return [
        {"final_score": 20, "actual_bad": False, "events": {"a": 10}},
        {"final_score": 60, "actual_bad": True, "events": {"a": 40}},
        {"final_score": 70, "actual_bad": False, "events": {"b": 50}},
        {"final_score": 90, "actual_bad": True, "events": {"a": 30, "b": 30}},
    ]


def test_backtest_is_advisory_and_reports_operating_points():
    result = RiskEvaluationService.replay_calibration(
        rows(), review_threshold=50, reject_threshold=80, minimum_samples=1
    )
    assert result["replay_mode"] == "persisted-event-replay"
    assert result["changes_applied"] is False
    assert result["baseline"]["evaluated_orders"] == 4
    assert result["weight_candidates"]
    assert result["threshold_candidates"]


def test_backtest_requires_sample_for_weight_candidates():
    result = RiskEvaluationService.replay_calibration(
        rows(), review_threshold=50, reject_threshold=80, minimum_samples=10
    )
    assert result["weight_candidates"] == []
    assert any("minimum evidence" in item for item in result["calibration_recommendations"])


def test_backtest_does_not_mutate_input_events():
    source = rows()
    RiskEvaluationService.replay_calibration(
        source, review_threshold=50, reject_threshold=80, minimum_samples=1
    )
    assert source[3]["events"] == {"a": 30, "b": 30}
