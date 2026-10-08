from uuid import UUID

from app.models.order import Order
from app.models.order_outcome import OrderOutcome
from app.models.risk_evaluation import RiskEvaluation
from app.models.risk_assessment import RiskAssessment
from app.repositories.risk_evaluation_repository import RiskEvaluationRepository


class RiskEvaluationService:
    def __init__(self, db):
        self.repository = RiskEvaluationRepository(db)

    @staticmethod
    def _classification(predicted_risky: bool, actual_bad: bool) -> str:
        if predicted_risky and actual_bad:
            return "true_positive"
        if predicted_risky and not actual_bad:
            return "false_positive"
        if not predicted_risky and actual_bad:
            return "false_negative"
        return "true_negative"

    def record_from_outcome(
        self,
        order: Order,
        assessment: RiskAssessment | None,
        outcome: OrderOutcome,
    ) -> RiskEvaluation | None:
        # Only live + real traffic can become production feedback.
        if (
            order.environment != "live"
            or order.data_origin != "real"
            or assessment is None
        ):
            return None

        predicted_risky = assessment.decision.value != "allow"
        actual_bad = outcome.outcome_status in {"cancelled", "returned"}
        classification = self._classification(predicted_risky, actual_bad)
        existing = self.repository.get_by_order_id(order.id)

        if existing is not None:
            # Outcome corrections must update the feedback label rather than
            # leaving stale calibration data behind. The audit log records the
            # business-level change separately.
            return self.repository.update_from_outcome(
                existing,
                outcome_status=outcome.outcome_status,
                outcome_occurred_at=outcome.occurred_at,
                actual_bad_outcome=actual_bad,
                classification=classification,
            )

        return self.repository.create(
            RiskEvaluation(
                merchant_id=order.merchant_id,
                store_id=order.store_id,
                order_id=order.id,
                risk_assessment_id=assessment.id,
                environment=order.environment,
                data_origin=order.data_origin,
                predicted_risky=predicted_risky,
                actual_bad_outcome=actual_bad,
                outcome_status=outcome.outcome_status,
                outcome_occurred_at=outcome.occurred_at,
                classification=classification,
            )
        )

    @staticmethod
    def metrics(counts: dict[str, int]) -> dict[str, float | int]:
        tp = counts.get("true_positive", 0)
        fp = counts.get("false_positive", 0)
        tn = counts.get("true_negative", 0)
        fn = counts.get("false_negative", 0)
        total = tp + fp + tn + fn

        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        false_positive_rate = fp / (fp + tn) if (fp + tn) else 0.0
        false_negative_rate = fn / (fn + tp) if (fn + tp) else 0.0
        flag_rate = (tp + fp) / total if total else 0.0

        return {
            "evaluated_orders": total,
            "true_positives": tp,
            "false_positives": fp,
            "true_negatives": tn,
            "false_negatives": fn,
            "precision": round(precision, 6),
            "recall": round(recall, 6),
            "detection_rate": round(recall, 6),
            "false_positive_rate": round(false_positive_rate, 6),
            "false_negative_rate": round(false_negative_rate, 6),
            "flag_rate": round(flag_rate, 6),
        }


    @staticmethod
    def recommend_thresholds(
        score_buckets: list[dict[str, int | float | str]],
        minimum_orders_per_bucket: int = 50,
        review_bad_rate: float = 0.35,
        reject_bad_rate: float = 0.70,
    ) -> dict[str, int | bool | None]:
        eligible: list[tuple[int, float]] = []
        for bucket in score_buckets:
            total = int(bucket["evaluated_orders"])
            bad = int(bucket["bad_outcomes"])
            if total < minimum_orders_per_bucket:
                continue
            start = int(str(bucket["score_bucket"]).split("-")[0])
            eligible.append((start, bad / total))

        eligible.sort(key=lambda item: item[0])
        recommended_review = next(
            (start for start, bad_rate in eligible if bad_rate >= review_bad_rate),
            None,
        )
        recommended_reject = next(
            (start for start, bad_rate in eligible if bad_rate >= reject_bad_rate),
            None,
        )

        # Never recommend a reject threshold below the review threshold.
        if (
            recommended_review is not None
            and recommended_reject is not None
            and recommended_reject <= recommended_review
        ):
            recommended_reject = None

        return {
            "calibration_ready": bool(eligible),
            "minimum_orders_per_bucket": minimum_orders_per_bucket,
            "recommended_review_threshold": recommended_review,
            "recommended_reject_threshold": recommended_reject,
        }


    @staticmethod
    def backtest_operating_point(
        rows: list[dict[str, object]],
        threshold: int,
    ) -> dict[str, int | float]:
        counts = {
            "true_positive": 0, "false_positive": 0,
            "true_negative": 0, "false_negative": 0,
        }
        for row in rows:
            predicted = int(row.get("score", 0)) >= threshold
            actual_bad = bool(row.get("actual_bad", False))
            classification = RiskEvaluationService._classification(predicted, actual_bad)
            counts[classification] += 1
        metrics = RiskEvaluationService.metrics(counts)
        precision = float(metrics["precision"])
        recall = float(metrics["recall"])
        f1 = (2 * precision * recall / (precision + recall)) if precision + recall else 0.0
        return {
            **metrics,
            "threshold": threshold,
            "f1_score": round(f1, 6),
        }

    @staticmethod
    def replay_calibration(
        evaluations: list[dict[str, object]],
        *,
        review_threshold: int,
        reject_threshold: int,
        minimum_samples: int = 50,
        weight_multipliers: tuple[float, ...] = (0.75, 0.9, 1.1, 1.25),
        max_signal_candidates: int = 10,
    ) -> dict[str, object]:
        """Replay persisted event evidence without mutating production rules.

        This is intentionally an event-replay backtest, not a full rule-engine
        re-execution. It is suitable for evidence-based calibration because each
        historical assessment already contains the signal impacts that were used
        at decision time.
        """
        baseline_rows = [
            {**row, "score": min(100, max(0, int(row.get("final_score", 0))))}
            for row in evaluations
        ]
        baseline = RiskEvaluationService.backtest_operating_point(
            baseline_rows, review_threshold
        )

        # Threshold candidates use the persisted final score and require a valid
        # review < reject ordering.
        threshold_candidates = []
        for review in range(30, 81, 5):
            for reject in range(max(review + 5, 40), 101, 10):
                # Keep the candidate set compact and centered around current rules.
                if abs(review - review_threshold) > 20 or abs(reject - reject_threshold) > 20:
                    continue
                # A two-stage decision is reduced to the risky/not-risky boundary
                # for calibration metrics; reject is retained as metadata.
                op = RiskEvaluationService.backtest_operating_point(baseline_rows, review)
                threshold_candidates.append({
                    "review_threshold": review,
                    "reject_threshold": reject,
                    "operating_point": op,
                })

        # Candidate signals are selected by sufficient support and contribution.
        signal_support: dict[str, int] = {}
        signal_impact: dict[str, int] = {}
        for row in evaluations:
            for event_type, impact in dict(row.get("events", {})).items():
                signal_support[event_type] = signal_support.get(event_type, 0) + 1
                signal_impact[event_type] = signal_impact.get(event_type, 0) + max(0, int(impact))
        eligible = [
            event for event, support in signal_support.items()
            if support >= minimum_samples
        ]
        eligible.sort(key=lambda event: signal_impact.get(event, 0), reverse=True)
        eligible = eligible[:max_signal_candidates]

        weight_candidates = []
        baseline_f1 = float(baseline["f1_score"])
        baseline_fpr = float(baseline["false_positive_rate"])
        baseline_recall = float(baseline["recall"])
        for event_type in eligible:
            for multiplier in weight_multipliers:
                rows = []
                changed = 0
                delta_sum = 0
                for row in evaluations:
                    events = dict(row.get("events", {}))
                    old = int(row.get("final_score", 0))
                    raw = sum(max(0, int(v)) for v in events.values())
                    adjusted_raw = raw + (max(0, int(events.get(event_type, 0))) * (multiplier - 1.0))
                    score = min(100, max(0, round(adjusted_raw)))
                    if score != old:
                        changed += 1
                    delta_sum += score - old
                    rows.append({"score": score, "actual_bad": bool(row.get("actual_bad", False))})
                op = RiskEvaluationService.backtest_operating_point(rows, review_threshold)
                improves = float(op["f1_score"]) > baseline_f1
                guardrails = (
                    float(op["false_positive_rate"]) <= baseline_fpr + 0.05
                    and float(op["recall"]) >= baseline_recall - 0.05
                )
                weight_candidates.append({
                    "event_type": event_type,
                    "multiplier": multiplier,
                    "evaluated_orders": len(rows),
                    "changed_orders": changed,
                    "average_score_delta": round(delta_sum / len(rows), 6) if rows else 0.0,
                    "operating_point": op,
                    "improves_f1": improves,
                    "guardrails_pass": guardrails,
                    "advisory": True,
                })

        recommendations = []
        viable_weights = [c for c in weight_candidates if c["improves_f1"] and c["guardrails_pass"]]
        if viable_weights:
            recommendations.append(
                "Weight candidates exist that improve F1 within the configured recall/FPR guardrails; review them before any rule change."
            )
        else:
            recommendations.append(
                "No weight candidate met both F1 improvement and recall/FPR guardrails; keep current weights pending more outcome data."
            )
        if len(evaluations) < minimum_samples:
            recommendations.append("Calibration sample is below the minimum evidence threshold; treat all results as exploratory.")
        recommendations.append("Threshold and weight candidates are advisory only; no production configuration was modified.")

        return {
            "replay_mode": "persisted-event-replay",
            "evaluated_orders": len(evaluations),
            "minimum_samples": minimum_samples,
            "baseline": baseline,
            "threshold_candidates": threshold_candidates,
            "weight_candidates": weight_candidates,
            "calibration_recommendations": recommendations,
            "changes_applied": False,
        }

    @staticmethod
    def operating_point(
        counts: dict[str, int],
        threshold: int,
    ) -> dict[str, int | float]:
        normalized = {
            "true_positive": counts.get("true_positives", 0),
            "false_positive": counts.get("false_positives", 0),
            "true_negative": counts.get("true_negatives", 0),
            "false_negative": counts.get("false_negatives", 0),
        }
        metrics = RiskEvaluationService.metrics(normalized)
        return {
            "threshold": threshold,
            "evaluated_orders": metrics["evaluated_orders"],
            "true_positives": metrics["true_positives"],
            "false_positives": metrics["false_positives"],
            "true_negatives": metrics["true_negatives"],
            "false_negatives": metrics["false_negatives"],
            "precision": metrics["precision"],
            "recall": metrics["recall"],
            "false_positive_rate": metrics["false_positive_rate"],
            "false_negative_rate": metrics["false_negative_rate"],
            "flag_rate": metrics["flag_rate"],
        }


    @staticmethod
    def score_attribution(
        evaluations: list[dict[str, object]],
        *,
        minimum_samples: int,
    ) -> dict[str, object]:
        """Aggregate raw score contribution by signal without changing scoring.

        ``raw_event_score`` is the sum of unique event-type impacts before the
        configured max-score cap. ``capped_score_loss`` is the difference between
        that raw sum and the persisted assessment score when the cap applies.
        """
        signal_stats: dict[str, dict[str, float | int]] = {}
        total_evaluations = len(evaluations)
        capped_orders = 0
        total_raw_score = 0
        total_final_score = 0
        total_capped_loss = 0
        dominant_signal_orders = 0
        top_signal_orders = 0

        for evaluation in evaluations:
            events = dict(evaluation.get("events", {}))
            final_score = int(evaluation.get("final_score", 0))
            raw_score = sum(max(0, int(value)) for value in events.values())
            total_raw_score += raw_score
            total_final_score += final_score
            capped_loss = max(0, raw_score - final_score)
            total_capped_loss += capped_loss
            if capped_loss > 0:
                capped_orders += 1

            ranked = sorted(events.items(), key=lambda item: (-int(item[1]), item[0]))
            if ranked and raw_score > 0:
                top_share = int(ranked[0][1]) / raw_score
                if top_share >= 0.50:
                    dominant_signal_orders += 1
                if top_share >= 0.75:
                    top_signal_orders += 1

            for event_type, impact_value in events.items():
                impact = max(0, int(impact_value))
                stat = signal_stats.setdefault(
                    str(event_type),
                    {
                        "triggered_orders": 0,
                        "total_score_impact": 0,
                        "total_raw_score": 0,
                        "bad_outcomes": 0,
                    },
                )
                stat["triggered_orders"] += 1
                stat["total_score_impact"] += impact
                stat["total_raw_score"] += raw_score
                stat["bad_outcomes"] += int(bool(evaluation.get("actual_bad")))

        attribution = []
        for event_type, stat in sorted(signal_stats.items()):
            triggered = int(stat["triggered_orders"])
            impact = int(stat["total_score_impact"])
            bad = int(stat["bad_outcomes"])
            raw_total = int(stat["total_raw_score"])
            attribution.append({
                "event_type": event_type,
                "triggered_orders": triggered,
                "bad_outcomes": bad,
                "bad_rate": round(bad / triggered, 6) if triggered else 0.0,
                "total_score_impact": impact,
                "average_score_impact": round(impact / triggered, 6) if triggered else 0.0,
                "average_raw_order_score": round(raw_total / triggered, 6) if triggered else 0.0,
                "score_contribution_share": round(impact / total_raw_score, 6) if total_raw_score else 0.0,
                "sample_sufficient": triggered >= minimum_samples,
            })

        return {
            "evaluated_orders": total_evaluations,
            "total_raw_event_score": total_raw_score,
            "total_final_score": total_final_score,
            "capped_orders": capped_orders,
            "capped_order_rate": round(capped_orders / total_evaluations, 6) if total_evaluations else 0.0,
            "total_capped_score_loss": total_capped_loss,
            "dominant_signal_orders": dominant_signal_orders,
            "dominant_signal_rate": round(dominant_signal_orders / total_evaluations, 6) if total_evaluations else 0.0,
            "strongly_dominant_signal_orders": top_signal_orders,
            "strongly_dominant_signal_rate": round(top_signal_orders / total_evaluations, 6) if total_evaluations else 0.0,
            "signals": attribution,
        }

    @staticmethod
    def quality_buckets(
        score_buckets: list[dict[str, int | float | str]],
        minimum_samples: int,
    ) -> tuple[list[dict[str, int | float | str | bool]], list[str]]:
        buckets = [
            {
                **bucket,
                "sample_sufficient": int(bucket["evaluated_orders"]) >= minimum_samples,
            }
            for bucket in score_buckets
        ]
        violations: list[str] = []
        eligible = [bucket for bucket in buckets if bucket["sample_sufficient"]]
        for previous, current in zip(eligible, eligible[1:]):
            if float(current["bad_rate"]) < float(previous["bad_rate"]):
                violations.append(
                    f"{previous['score_bucket']}={previous['bad_rate']:.6f} > "
                    f"{current['score_bucket']}={current['bad_rate']:.6f}"
                )
        return buckets, violations

    @staticmethod
    def quality_signal_pairs(
        pairs: list[dict[str, int | str | float]],
        *,
        evaluated_orders: int,
        signal_support: dict[str, int],
        minimum_samples: int,
        overlap_threshold: float = 0.50,
    ) -> list[dict[str, int | float | str | bool]]:
        """Quantify signal overlap without asserting that overlap is causation.

        Jaccard overlap is computed from pair support and individual signal
        support. Pairs are marked high_overlap only when both the sample size
        and configured overlap threshold are met.
        """
        result = []
        for pair in pairs:
            total = int(pair["evaluated_orders"])
            left = str(pair["event_type_a"])
            right = str(pair["event_type_b"])
            left_support = signal_support.get(left, 0)
            right_support = signal_support.get(right, 0)
            union = left_support + right_support - total
            jaccard = total / union if union > 0 else 0.0
            support_rate = total / evaluated_orders if evaluated_orders else 0.0
            result.append({
                **pair,
                "support_rate": round(support_rate, 6),
                "jaccard_overlap": round(jaccard, 6),
                "sample_sufficient": total >= minimum_samples,
                "high_overlap": total >= minimum_samples and jaccard >= overlap_threshold,
            })
        return result

    @staticmethod
    def quality_signals(
        signals: list[dict[str, int | str]],
        *,
        evaluated_orders: int,
        overall_bad_rate: float,
        minimum_samples: int,
    ) -> list[dict[str, int | float | str | bool | None]]:
        result = []
        for signal in signals:
            total = int(signal["evaluated_orders"])
            bad = int(signal["bad_outcomes"])
            bad_rate = bad / total if total else 0.0
            result.append({
                "event_type": str(signal["event_type"]),
                "evaluated_orders": total,
                "bad_outcomes": bad,
                "bad_rate": round(bad_rate, 6),
                "support_rate": round(total / evaluated_orders, 6) if evaluated_orders else 0.0,
                "lift_vs_baseline": round(bad_rate / overall_bad_rate, 6) if overall_bad_rate else None,
                "sample_sufficient": total >= minimum_samples,
            })
        return result
