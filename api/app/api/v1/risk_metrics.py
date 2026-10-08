from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_database, require_api_scope
from app.models.api_key import ApiKey
from app.models.order import Order
from app.models.risk_assessment import RiskAssessment
from sqlalchemy import exists, func
from app.repositories.risk_evaluation_repository import RiskEvaluationRepository
from app.schemas.risk_metrics import RiskCalibrationResponse, RiskPerformanceResponse
from app.schemas.risk_quality import RiskAttributionResponse, RiskBacktestResponse, RiskQualityResponse
from app.repositories.risk_profile_repository import RiskProfileRepository
from app.services.risk_evaluation_service import RiskEvaluationService
from app.core.config import settings
from app.api.store_scope import requested_store_id


router = APIRouter(prefix="/metrics", tags=["Risk Metrics"])


def require_live_metrics_key(
    api_key: ApiKey = Depends(require_api_scope("metrics:read")),
) -> ApiKey:
    if api_key.environment != "live":
        raise HTTPException(
            status_code=403,
            detail="Risk metrics are available only with a live API key",
        )
    return api_key


@router.get("/risk-performance", response_model=RiskPerformanceResponse)
def get_risk_performance(
    days: int | None = Query(default=None, ge=1, le=3650),
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_live_metrics_key),
):
    since = None
    if days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=days)

    selected_store = requested_store_id(db, api_key, store_id)
    counts = RiskEvaluationRepository(db).counts(merchant_id=api_key.merchant_id, since=since, store_id=selected_store)
    return RiskEvaluationService.metrics(counts)


@router.get("/risk-calibration", response_model=RiskCalibrationResponse)
def get_risk_calibration(
    days: int | None = Query(default=None, ge=1, le=3650),
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_live_metrics_key),
):
    since = None
    if days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=days)

    selected_store = requested_store_id(db, api_key, store_id)
    repository = RiskEvaluationRepository(db)
    counts = repository.counts(merchant_id=api_key.merchant_id, since=since, store_id=selected_store)
    score_buckets = repository.score_buckets(api_key.merchant_id, since=since, store_id=selected_store)
    return {
        **RiskEvaluationService.metrics(counts),
        "score_buckets": score_buckets,
        **RiskEvaluationService.recommend_thresholds(score_buckets),
    }


@router.get("/risk-attribution", response_model=RiskAttributionResponse)
def get_risk_attribution(
    days: int | None = Query(default=None, ge=1, le=3650),
    store_id: str | None = Query(default=None),
    minimum_samples: int = Query(default=50, ge=1, le=100000),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_live_metrics_key),
):
    """Explain how recorded risk-event impacts contribute to persisted scores."""
    since = None
    if days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=days)

    selected_store = requested_store_id(db, api_key, store_id)
    repository = RiskEvaluationRepository(db)
    evaluations = repository.score_attribution(api_key.merchant_id, since=since, store_id=selected_store)
    return {
        **RiskEvaluationService.score_attribution(
            evaluations, minimum_samples=minimum_samples
        ),
        "minimum_samples": minimum_samples,
    }


@router.get("/summary")
def get_risk_summary(
    store_id: str | None = Query(default=None),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_api_scope("orders:read")),
):
    selected_store = requested_store_id(db, api_key, store_id)
    base = db.query(Order).filter(Order.merchant_id == api_key.merchant_id, Order.environment == api_key.environment)
    if selected_store is not None:
        base = base.filter(Order.store_id == selected_store)
    total = base.count()

    # Do not use Query.distinct() on the full Order entity here. PostgreSQL
    # cannot apply DISTINCT to JSON columns such as identity_match_reasons.
    # EXISTS keeps the count at the order level and also remains correct if an
    # order ever receives more than one risk assessment.
    def has_assessment(decision: str | None = None):
        conditions = [RiskAssessment.order_id == Order.id]
        if decision is not None:
            conditions.append(RiskAssessment.decision == decision)
        return exists().where(*conditions)

    assessed = base.filter(has_assessment()).count()
    allow = base.filter(has_assessment("allow")).count()
    review = base.filter(has_assessment("review")).count()
    reject = base.filter(has_assessment("reject")).count()

    volume = base.with_entities(
        func.coalesce(func.sum(Order.total_amount), 0)
    ).scalar() or 0
    blocked = base.filter(has_assessment("reject")).with_entities(
        func.coalesce(func.sum(Order.total_amount), 0)
    ).scalar() or 0
    assessment_query = base.join(RiskAssessment, RiskAssessment.order_id == Order.id)
    average_score = assessment_query.with_entities(func.coalesce(func.avg(RiskAssessment.score), 0)).scalar() or 0
    average_execution = assessment_query.with_entities(func.avg(RiskAssessment.execution_time_ms)).scalar()
    return {
        "orders_analyzed": assessed, "total_orders": total, "total_volume": float(volume),
        "fraud_blocked_volume": float(blocked), "avg_execution_time_ms": round(float(average_execution), 3) if average_execution is not None else None,
        "allow_count": allow, "review_count": review, "reject_count": reject,
        "allow_percentage": round((allow / assessed) * 100) if assessed else 0,
        "review_percentage": round((review / assessed) * 100) if assessed else 0,
        "reject_percentage": round((reject / assessed) * 100) if assessed else 0,
        "avg_risk_score": round(float(average_score)), "average_risk_score": round(float(average_score)),
        "allow_rate": round((allow / assessed) * 100, 1) if assessed else 0,
        "review_rate": round((review / assessed) * 100, 1) if assessed else 0,
        "reject_rate": round((reject / assessed) * 100, 1) if assessed else 0,
        "risk_detection_rate": round(((review + reject) / assessed) * 100, 1) if assessed else 0,
        "api_health": None,
        "rate_limit_per_min": settings.live_requests_per_minute,
    }


@router.get("/risk-backtest", response_model=RiskBacktestResponse)
def get_risk_backtest(
    days: int | None = Query(default=None, ge=1, le=3650),
    store_id: str | None = Query(default=None),
    minimum_samples: int = Query(default=50, ge=1, le=100000),
    max_signal_candidates: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_live_metrics_key),
):
    """Replay historical persisted risk events for advisory calibration only."""
    since = None
    if days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=days)
    selected_store = requested_store_id(db, api_key, store_id)
    repository = RiskEvaluationRepository(db)
    profile = RiskProfileRepository(db).get_by_merchant_id(api_key.merchant_id)
    review_threshold = int(profile.review_threshold) if profile is not None else 50
    reject_threshold = int(profile.reject_threshold) if profile is not None else 80
    evaluations = repository.calibration_replay_rows(api_key.merchant_id, since=since, store_id=selected_store)
    return RiskEvaluationService.replay_calibration(
        evaluations,
        review_threshold=review_threshold,
        reject_threshold=reject_threshold,
        minimum_samples=minimum_samples,
        max_signal_candidates=max_signal_candidates,
    )


@router.get("/risk-quality", response_model=RiskQualityResponse)
def get_risk_quality(
    days: int | None = Query(default=None, ge=1, le=3650),
    store_id: str | None = Query(default=None),
    minimum_samples: int = Query(default=50, ge=1, le=100000),
    db: Session = Depends(get_database),
    api_key: ApiKey = Depends(require_live_metrics_key),
):
    since = None
    if days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=days)

    merchant_id = api_key.merchant_id
    selected_store = requested_store_id(db, api_key, store_id)
    repository = RiskEvaluationRepository(db)
    counts = repository.counts(merchant_id=merchant_id, since=since, store_id=selected_store)
    base_metrics = RiskEvaluationService.metrics(counts)
    evaluated_orders = int(base_metrics["evaluated_orders"])
    bad_total = int(counts.get("true_positive", 0) + counts.get("false_negative", 0))
    overall_bad_rate = bad_total / evaluated_orders if evaluated_orders else 0.0

    profile = RiskProfileRepository(db).get_by_merchant_id(merchant_id)
    review_threshold = int(profile.review_threshold) if profile is not None else 50
    reject_threshold = int(profile.reject_threshold) if profile is not None else 80

    review_counts = repository.threshold_counts(merchant_id, review_threshold, since=since, store_id=selected_store)
    reject_counts = repository.threshold_counts(merchant_id, reject_threshold, since=since, store_id=selected_store)
    raw_buckets = repository.score_buckets(merchant_id, since=since, store_id=selected_store)
    buckets, violations = RiskEvaluationService.quality_buckets(raw_buckets, minimum_samples)
    raw_signals = repository.signal_quality(merchant_id, since=since, store_id=selected_store)
    signals = RiskEvaluationService.quality_signals(
        raw_signals,
        evaluated_orders=evaluated_orders,
        overall_bad_rate=overall_bad_rate,
        minimum_samples=minimum_samples,
    )
    signal_support = {item["event_type"]: int(item["evaluated_orders"]) for item in raw_signals}
    raw_pairs = repository.signal_cooccurrence(merchant_id, since=since, store_id=selected_store)
    signal_pairs = RiskEvaluationService.quality_signal_pairs(
        raw_pairs,
        evaluated_orders=evaluated_orders,
        signal_support=signal_support,
        minimum_samples=minimum_samples,
    )

    return {
        "evaluated_orders": evaluated_orders,
        "overall_bad_rate": round(overall_bad_rate, 6),
        "minimum_samples": minimum_samples,
        "review_threshold": review_threshold,
        "reject_threshold": reject_threshold,
        "review_operating_point": RiskEvaluationService.operating_point(review_counts, review_threshold),
        "reject_operating_point": RiskEvaluationService.operating_point(reject_counts, reject_threshold),
        "score_buckets": buckets,
        "monotonicity_violations": violations,
        "signals": signals,
        "signal_pairs": signal_pairs,
        "overlap_threshold": 0.50,
    }
