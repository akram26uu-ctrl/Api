from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, case, func, select, not_
from sqlalchemy.orm import Session
from app.models.order import Order

from app.models.risk_evaluation import RiskEvaluation


class RiskEvaluationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_order_id(self, order_id: UUID) -> RiskEvaluation | None:
        return self.db.scalar(
            select(RiskEvaluation).where(RiskEvaluation.order_id == order_id)
        )

    def create(self, evaluation: RiskEvaluation) -> RiskEvaluation:
        self.db.add(evaluation)
        self.db.flush()
        return evaluation

    def update_from_outcome(
        self,
        evaluation: RiskEvaluation,
        *,
        outcome_status: str,
        outcome_occurred_at: datetime,
        actual_bad_outcome: bool,
        classification: str,
    ) -> RiskEvaluation:
        evaluation.outcome_status = outcome_status
        evaluation.outcome_occurred_at = outcome_occurred_at
        evaluation.actual_bad_outcome = actual_bad_outcome
        evaluation.classification = classification
        self.db.flush()
        return evaluation

    def score_buckets(self, merchant_id: UUID, since: datetime | None = None, store_id: UUID | None = None) -> list[dict[str, int | str]]:
        from app.models.risk_assessment import RiskAssessment

        bucket = case(
            (RiskAssessment.score < 25, "0-24"),
            (RiskAssessment.score < 50, "25-49"),
            (RiskAssessment.score < 70, "50-69"),
            (RiskAssessment.score < 80, "70-79"),
            (RiskAssessment.score < 90, "80-89"),
            else_="90-100",
        )
        bad = func.sum(case((RiskEvaluation.actual_bad_outcome.is_(True), 1), else_=0))
        statement = select(bucket.label("score_bucket"), func.count(RiskEvaluation.id), bad).join(
            RiskAssessment, RiskAssessment.id == RiskEvaluation.risk_assessment_id
        ).join(RiskEvaluation.order).where(
            RiskEvaluation.merchant_id == merchant_id,
            RiskEvaluation.environment == "live",
            RiskEvaluation.data_origin == "real",
        )
        if store_id is not None:
            statement = statement.where(Order.store_id == store_id)
        if since is not None:
            statement = statement.where(RiskEvaluation.outcome_occurred_at >= since)
        statement = statement.group_by(bucket).order_by(bucket)
        rows = self.db.execute(statement).all()
        return [
            {
                "score_bucket": bucket_name,
                "evaluated_orders": int(total),
                "bad_outcomes": int(bad_count or 0),
                "bad_rate": round((int(bad_count or 0) / int(total)), 6) if total else 0.0,
            }
            for bucket_name, total, bad_count in rows
        ]

    def counts(self, merchant_id: UUID, since: datetime | None = None, store_id: UUID | None = None) -> dict[str, int]:
        statement = select(
            RiskEvaluation.classification,
            func.count(RiskEvaluation.id),
        ).join(RiskEvaluation.order).where(
            RiskEvaluation.merchant_id == merchant_id,
            RiskEvaluation.environment == "live",
            RiskEvaluation.data_origin == "real",
        )
        if store_id is not None:
            statement = statement.where(Order.store_id == store_id)

        if since is not None:
            statement = statement.where(RiskEvaluation.outcome_occurred_at >= since)

        statement = statement.group_by(RiskEvaluation.classification)
        rows = self.db.execute(statement).all()
        return {classification: count for classification, count in rows}

    def threshold_counts(
        self,
        merchant_id: UUID,
        threshold: int,
        since: datetime | None = None,
        store_id: UUID | None = None,
    ) -> dict[str, int]:
        """Confusion matrix when score >= threshold is treated as risky."""
        from app.models.risk_assessment import RiskAssessment

        statement = select(
            RiskAssessment.score,
            RiskEvaluation.actual_bad_outcome,
        ).join(
            RiskAssessment, RiskAssessment.id == RiskEvaluation.risk_assessment_id
        ).join(RiskEvaluation.order).where(
            RiskEvaluation.merchant_id == merchant_id,
            RiskEvaluation.environment == "live",
            RiskEvaluation.data_origin == "real",
        )
        if store_id is not None:
            statement = statement.where(Order.store_id == store_id)
        if since is not None:
            statement = statement.where(RiskEvaluation.outcome_occurred_at >= since)

        counts = {
            "true_positives": 0,
            "false_positives": 0,
            "true_negatives": 0,
            "false_negatives": 0,
            "evaluated_orders": 0,
        }
        for score, actual_bad in self.db.execute(statement).all():
            predicted_risky = int(score) >= threshold
            if predicted_risky and actual_bad:
                counts["true_positives"] += 1
            elif predicted_risky:
                counts["false_positives"] += 1
            elif actual_bad:
                counts["false_negatives"] += 1
            else:
                counts["true_negatives"] += 1
            counts["evaluated_orders"] += 1
        return counts

    def signal_cooccurrence(
        self,
        merchant_id: UUID,
        since: datetime | None = None,
        store_id: UUID | None = None,
    ) -> list[dict[str, int | str | float]]:
        """Return unique signal pairs observed on the same evaluated order.

        This is diagnostic evidence only. A high overlap does not prove that
        two rules double-count the same behavior; it identifies pairs that
        deserve review before changing weights.
        """
        from itertools import combinations

        from app.models.risk_assessment import RiskAssessment
        from app.models.risk_event import RiskEvent
        statement = select(
            RiskEvaluation.risk_assessment_id,
            RiskEvaluation.actual_bad_outcome,
            RiskEvent.event_type,
            RiskEvent.score_impact,
        ).join(
            RiskAssessment, RiskAssessment.id == RiskEvaluation.risk_assessment_id
        ).join(
            RiskEvent, RiskEvent.risk_assessment_id == RiskAssessment.id
        ).join(RiskEvaluation.order).where(
            RiskEvaluation.merchant_id == merchant_id,
            RiskEvaluation.environment == "live",
            RiskEvaluation.data_origin == "real",
        )
        if store_id is not None:
            statement = statement.where(Order.store_id == store_id)
        if since is not None:
            statement = statement.where(RiskEvaluation.outcome_occurred_at >= since)

        per_assessment: dict[UUID, dict[str, object]] = {}
        for assessment_id, actual_bad, event_type, score_impact in self.db.execute(statement).all():
            bucket = per_assessment.setdefault(
                assessment_id,
                {"bad": bool(actual_bad), "events": {}},
            )
            events = bucket["events"]
            key = event_type.value if hasattr(event_type, "value") else str(event_type)
            # An event type should only contribute once per assessment.
            events[key] = max(int(score_impact), int(events.get(key, 0)))

        pairs: dict[tuple[str, str], dict[str, float | int]] = {}
        for bucket in per_assessment.values():
            events = bucket["events"]
            for left, right in combinations(sorted(events), 2):
                pair = pairs.setdefault(
                    (left, right),
                    {"evaluated_orders": 0, "bad_outcomes": 0, "combined_score_impact": 0},
                )
                pair["evaluated_orders"] += 1
                pair["bad_outcomes"] += int(bucket["bad"])
                pair["combined_score_impact"] += int(events[left]) + int(events[right])

        return [
            {
                "event_type_a": left,
                "event_type_b": right,
                "evaluated_orders": int(data["evaluated_orders"]),
                "bad_outcomes": int(data["bad_outcomes"]),
                "bad_rate": round(
                    int(data["bad_outcomes"]) / int(data["evaluated_orders"]), 6
                ) if data["evaluated_orders"] else 0.0,
                "average_combined_score_impact": round(
                    int(data["combined_score_impact"]) / int(data["evaluated_orders"]), 6
                ) if data["evaluated_orders"] else 0.0,
            }
            for (left, right), data in sorted(pairs.items())
        ]


    def score_attribution(
        self,
        merchant_id: UUID,
        since: datetime | None = None,
        store_id: UUID | None = None,
    ) -> list[dict[str, object]]:
        """Return per-evaluation score/event attribution evidence.

        Each event type is counted once per risk assessment, using its maximum
        score impact. This is diagnostic: it explains how much of the raw event
        score was attributable to each signal before the final score cap.
        """
        from app.models.risk_assessment import RiskAssessment
        from app.models.risk_event import RiskEvent
        statement = select(
            RiskEvaluation.id,
            RiskEvaluation.risk_assessment_id,
            RiskEvaluation.actual_bad_outcome,
            RiskAssessment.score,
            RiskEvent.event_type,
            RiskEvent.score_impact,
        ).join(
            RiskAssessment, RiskAssessment.id == RiskEvaluation.risk_assessment_id
        ).join(
            RiskEvent, RiskEvent.risk_assessment_id == RiskAssessment.id
        ).join(RiskEvaluation.order).where(
            RiskEvaluation.merchant_id == merchant_id,
            RiskEvaluation.environment == "live",
            RiskEvaluation.data_origin == "real",
        )
        if store_id is not None:
            statement = statement.where(Order.store_id == store_id)
        if since is not None:
            statement = statement.where(RiskEvaluation.outcome_occurred_at >= since)

        per_evaluation: dict[UUID, dict[str, object]] = {}
        for evaluation_id, assessment_id, actual_bad, final_score, event_type, score_impact in self.db.execute(statement).all():
            bucket = per_evaluation.setdefault(
                evaluation_id,
                {
                    "assessment_id": assessment_id,
                    "actual_bad": bool(actual_bad),
                    "final_score": int(final_score),
                    "events": {},
                },
            )
            events = bucket["events"]
            key = event_type.value if hasattr(event_type, "value") else str(event_type)
            events[key] = max(int(score_impact), int(events.get(key, 0)))

        return [
            {
                "evaluation_id": evaluation_id,
                "assessment_id": data["assessment_id"],
                "actual_bad": data["actual_bad"],
                "final_score": data["final_score"],
                "events": data["events"],
            }
            for evaluation_id, data in per_evaluation.items()
        ]

    def calibration_replay_rows(
        self,
        merchant_id: UUID,
        since: datetime | None = None,
        store_id: UUID | None = None,
    ) -> list[dict[str, object]]:
        """Return immutable live/real event snapshots for offline calibration replay."""
        rows = self.score_attribution(merchant_id, since=since, store_id=store_id)
        return rows

    def signal_quality(
        self,
        merchant_id: UUID,
        since: datetime | None = None,
        store_id: UUID | None = None,
    ) -> list[dict[str, int | str]]:
        """Measure each risk event against the eventual live/real outcome."""
        from app.models.risk_assessment import RiskAssessment
        from app.models.risk_event import RiskEvent
        statement = select(
            RiskEvent.event_type,
            func.count(func.distinct(RiskEvaluation.id)),
            func.count(
                func.distinct(
                    case((RiskEvaluation.actual_bad_outcome.is_(True), RiskEvaluation.id))
                )
            ),
        ).join(
            RiskAssessment, RiskAssessment.id == RiskEvent.risk_assessment_id
        ).join(
            RiskEvaluation, RiskEvaluation.risk_assessment_id == RiskAssessment.id
        ).join(RiskEvaluation.order).where(
            RiskEvaluation.merchant_id == merchant_id,
            RiskEvaluation.environment == "live",
            RiskEvaluation.data_origin == "real",
        ).group_by(RiskEvent.event_type).order_by(RiskEvent.event_type)
        if store_id is not None:
            statement = statement.where(Order.store_id == store_id)
        if since is not None:
            statement = statement.where(RiskEvaluation.outcome_occurred_at >= since)
        rows = self.db.execute(statement).all()
        return [
            {
                "event_type": event_type.value if hasattr(event_type, "value") else str(event_type),
                "evaluated_orders": int(total),
                "bad_outcomes": int(bad or 0),
            }
            for event_type, total, bad in rows
        ]
