from dataclasses import dataclass
import time

from app.utils.json import to_json_safe
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.risk_config import DEFAULT_RISK_PROFILE
from app.models.enums import RiskDecision, RiskEventType
from app.models.order import Order
from app.models.risk_assessment import RiskAssessment
from app.models.risk_event import RiskEvent
from app.models.risk_feature_snapshot import RiskFeatureSnapshot
from app.models.risk_profile import RiskProfile
from app.repositories.order_repository import OrderRepository
from app.repositories.risk_assessment_repository import (
    RiskAssessmentRepository,
)
from app.repositories.risk_event_repository import (
    RiskEventRepository,
)
from app.repositories.risk_profile_repository import (
    RiskProfileRepository,
)
from app.services.network_intelligence import (
    NetworkIntelResult,
    NetworkIntelligenceProvider,
    build_network_intelligence_provider,
)
from app.services.risk_rules import RiskRules
from app.services.identity_graph_service import IdentityGraphService
from app.services.business_context_service import BusinessContextService


@dataclass
class RiskResult:
    score: int
    decision: RiskDecision
    assessment: RiskAssessment
    events: list[RiskEvent]


class RiskService:
    MODEL_VERSION = "rules-v4"
    RULES_VERSION = "2026-09-global-reputation-v4"

    def __init__(
        self,
        db: Session,
        network_provider: NetworkIntelligenceProvider | None = None,
    ):
        self.db = db

        self.order_repository = OrderRepository(db)

        self.assessment_repository = (
            RiskAssessmentRepository(db)
        )

        self.event_repository = (
            RiskEventRepository(db)
        )

        self.risk_profile_repository = (
            RiskProfileRepository(db)
        )

        self.graph_service = IdentityGraphService(db)
        self.business_context_service = BusinessContextService(db)

        self.network_provider = (
            network_provider
            if network_provider is not None
            else build_network_intelligence_provider()
        )

    def _get_or_create_profile(
        self,
        merchant_id,
    ) -> RiskProfile:
        profile = (
            self.risk_profile_repository.get_by_merchant_id(
                merchant_id,
            )
        )

        if profile is not None:
            return profile

        defaults = DEFAULT_RISK_PROFILE

        profile = RiskProfile(
            merchant_id=merchant_id,

            high_cancel_rate_threshold=(
                defaults.high_cancel_rate_threshold
            ),
            high_cancel_rate_min_orders=(
                defaults.high_cancel_rate_min_orders
            ),
            high_cancel_rate_score=(
                defaults.high_cancel_rate_score
            ),

            phone_reuse_threshold=(
                defaults.phone_reuse_threshold
            ),
            phone_reuse_score=(
                defaults.phone_reuse_score
            ),

            device_reuse_threshold=(
                defaults.device_reuse_threshold
            ),
            device_reuse_score=(
                defaults.device_reuse_score
            ),

            address_reuse_threshold=(
                defaults.address_reuse_threshold
            ),
            address_reuse_score=(
                defaults.address_reuse_score
            ),

            multiple_customers_same_phone_threshold=(
                defaults.multiple_customers_same_phone_threshold
            ),
            multiple_customers_same_phone_score=(
                defaults.multiple_customers_same_phone_score
            ),

            multiple_phones_same_device_threshold=(
                defaults.multiple_phones_same_device_threshold
            ),
            multiple_phones_same_device_score=(
                defaults.multiple_phones_same_device_score
            ),

            high_order_frequency_count=(
                defaults.high_order_frequency_count
            ),
            high_order_frequency_window_minutes=(
                defaults.high_order_frequency_window_minutes
            ),
            high_order_frequency_score=(
                defaults.high_order_frequency_score
            ),

            high_ip_frequency_count=(
                defaults.high_ip_frequency_count
            ),
            high_ip_frequency_window_minutes=(
                defaults.high_ip_frequency_window_minutes
            ),
            high_ip_frequency_score=(
                defaults.high_ip_frequency_score
            ),

            multiple_customers_same_ip_threshold=(
                defaults.multiple_customers_same_ip_threshold
            ),
            multiple_customers_same_ip_score=(
                defaults.multiple_customers_same_ip_score
            ),

            new_device_customer_min_orders=(
                defaults.new_device_customer_min_orders
            ),
            new_device_score=(
                defaults.new_device_score
            ),

            vpn_score=defaults.vpn_score,
            proxy_score=defaults.proxy_score,

            duplicate_order_window_minutes=defaults.duplicate_order_window_minutes,
            duplicate_order_score=defaults.duplicate_order_score,
            burst_ip_window_minutes=defaults.burst_ip_window_minutes,
            burst_ip_customer_threshold=defaults.burst_ip_customer_threshold,
            burst_ip_phone_threshold=defaults.burst_ip_phone_threshold,
            burst_ip_score=defaults.burst_ip_score,
            strong_identity_combination_score=defaults.strong_identity_combination_score,
            customer_velocity_count=defaults.customer_velocity_count,
            customer_velocity_window_minutes=defaults.customer_velocity_window_minutes,
            customer_velocity_score=defaults.customer_velocity_score,
            phone_velocity_count=defaults.phone_velocity_count,
            phone_velocity_window_minutes=defaults.phone_velocity_window_minutes,
            phone_velocity_score=defaults.phone_velocity_score,
            device_velocity_count=defaults.device_velocity_count,
            device_velocity_window_minutes=defaults.device_velocity_window_minutes,
            device_velocity_score=defaults.device_velocity_score,
            multiple_customers_same_address_threshold=defaults.multiple_customers_same_address_threshold,
            multiple_customers_same_address_score=defaults.multiple_customers_same_address_score,
            multiple_customers_same_device_threshold=defaults.multiple_customers_same_device_threshold,
            multiple_customers_same_device_score=defaults.multiple_customers_same_device_score,
            high_ip_reputation_threshold=defaults.high_ip_reputation_threshold,
            high_ip_reputation_score=defaults.high_ip_reputation_score,
            bot_activity_score=defaults.bot_activity_score,
            tor_score=defaults.tor_score,

            global_phone_min_orders=defaults.global_phone_min_orders,
            global_phone_bad_rate_threshold=defaults.global_phone_bad_rate_threshold,
            global_phone_min_merchants=defaults.global_phone_min_merchants,
            global_reputation_min_bad_merchants=defaults.global_reputation_min_bad_merchants,
            global_phone_score=defaults.global_phone_score,
            global_device_min_orders=defaults.global_device_min_orders,
            global_device_bad_rate_threshold=defaults.global_device_bad_rate_threshold,
            global_device_min_merchants=defaults.global_device_min_merchants,
            global_device_score=defaults.global_device_score,
            global_ip_min_orders=defaults.global_ip_min_orders,
            global_ip_bad_rate_threshold=defaults.global_ip_bad_rate_threshold,
            global_ip_min_merchants=defaults.global_ip_min_merchants,
            global_ip_score=defaults.global_ip_score,

            identity_cluster_threshold=defaults.identity_cluster_threshold,
            identity_cluster_score=defaults.identity_cluster_score,

            business_context_min_orders=defaults.business_context_min_orders,
            business_context_recent_days=defaults.business_context_recent_days,
            business_context_recent_min_orders=defaults.business_context_recent_min_orders,
            business_context_quantity_multiplier=defaults.business_context_quantity_multiplier,
            business_context_value_multiplier=defaults.business_context_value_multiplier,
            unusual_quantity_score=defaults.unusual_quantity_score,
            unusual_value_score=defaults.unusual_value_score,

            review_threshold=defaults.review_threshold,
            reject_threshold=defaults.reject_threshold,
            max_score=defaults.max_score,

            is_active=True,
        )

        # Two concurrent first-assessments for the same merchant used to race:
        # both saw no profile, both inserted, and the second request died on the
        # unique constraint, rolling back the whole order transaction. Create the
        # default profile inside a SAVEPOINT so a concurrent insert is caught and
        # the winner's row is returned instead.
        try:
            with self.db.begin_nested():
                self.db.add(profile)
                self.db.flush()
        except IntegrityError:
            existing = self.risk_profile_repository.get_by_merchant_id(merchant_id)
            if existing is None:
                raise
            return existing
        return profile

    def assess_order(
        self,
        order: Order,
    ) -> RiskResult:
        started_at = time.perf_counter()
        profile = self._get_or_create_profile(
            order.merchant_id,
        )

        score = 0
        events: list[RiskEvent] = []

        network_result: NetworkIntelResult | None = None

        if order.ip_address:
            network_result = self.network_provider.lookup(
                order.ip_address,
            )

        business_context = self.business_context_service.build(
            order,
            min_samples=profile.business_context_min_orders,
            recent_days=profile.business_context_recent_days,
            recent_min_samples=profile.business_context_recent_min_orders,
        )

        rules = RiskRules(
            order_repository=self.order_repository,
            profile=profile,
        )

        rule_results = rules.evaluate_all(
            order,
            network_result,
            business_context=business_context,
        )

        graph_summary = self.graph_service.summarize_order(order)

        for result in rule_results:
            score += result.score

            if result.event is not None:
                events.append(result.event)

        event_types = {event.event_type for event in events}

        if {
            RiskEventType.HIGH_CANCEL_RATE,
            RiskEventType.PHONE_REUSED,
            RiskEventType.DEVICE_REUSED,
        }.issubset(event_types):
            events.append(
                RiskEvent(
                    event_type=RiskEventType.STRONG_IDENTITY_COMBINATION,
                    score_impact=profile.strong_identity_combination_score,
                    event_data={
                        "signals": [
                            "high_cancel_rate",
                            "phone_reused",
                            "device_reused",
                        ],
                    },
                )
            )
            score += profile.strong_identity_combination_score

        if (
            graph_summary.get("identity_cluster_size", 0)
            >= profile.identity_cluster_threshold
        ):
            events.append(
                RiskEvent(
                    event_type=RiskEventType.IDENTITY_CLUSTER_RISK,
                    score_impact=profile.identity_cluster_score,
                    event_data={
                        "identity_cluster_size": graph_summary[
                            "identity_cluster_size"
                        ],
                        "threshold": profile.identity_cluster_threshold,
                    },
                )
            )
            score += profile.identity_cluster_score

        score = min(
            score,
            profile.max_score,
        )

        decision = self._get_decision(
            score,
            profile,
        )

        assessment = RiskAssessment(
            order_id=order.id,
            score=score,
            decision=decision,
            model_version=self.MODEL_VERSION,
            rules_version=self.RULES_VERSION,
            risk_profile_version=profile.version,
            execution_time_ms=round((time.perf_counter() - started_at) * 1000, 3),
            identity_confidence=order.identity_confidence,
            identity_match_reasons=order.identity_match_reasons,
        )

        self.assessment_repository.create(
            assessment,
        )

        for event in events:
            event.risk_assessment_id = assessment.id

            self.event_repository.create(
                event,
            )

        self.db.flush()

        self.db.add(
            RiskFeatureSnapshot(
                risk_assessment_id=assessment.id,
                schema_version="features-business-context-v3",
                features=self._build_feature_snapshot(
                    order=order,
                    network_result=network_result,
                    events=events,
                    graph_summary=graph_summary,
                    business_context=business_context,
                ),
            )
        )

        self.db.flush()

        return RiskResult(
            score=score,
            decision=decision,
            assessment=assessment,
            events=events,
        )

    @staticmethod
    def _build_feature_snapshot(
        order: Order,
        network_result: NetworkIntelResult | None,
        events: list[RiskEvent],
        graph_summary: dict | None = None,
        business_context: dict | None = None,
    ) -> dict:
        network = None

        if network_result is not None:
            network = {
                "provider": network_result.provider,
                "available": network_result.available,
                "vpn": network_result.vpn,
                "proxy": network_result.proxy,
                "tor": network_result.tor,
                "active_vpn": network_result.active_vpn,
                "active_tor": network_result.active_tor,
                "bot_status": network_result.bot_status,
                "recent_abuse": network_result.recent_abuse,
                "fraud_score": network_result.fraud_score,
                "usage_type": network_result.usage_type,
            }

        snapshot = {
            "environment": order.environment,
            "data_origin": order.data_origin,
            "currency": order.currency,
            "amount": str(order.total_amount),
            "has_customer": order.customer_id is not None,
            "has_phone": order.phone_identifier_id is not None,
            "has_device": order.device_identifier_id is not None,
            "has_address": order.address_identifier_id is not None,
            "has_ip": bool(order.ip_address),
            "source": order.source,
            "identity": {
                "confidence": order.identity_confidence,
                "match_reasons": order.identity_match_reasons,
            },
            "identity_graph": graph_summary or {},
            "business_context": business_context or {},
            "feature_schema_version": "features-business-context-v3",
            "network": network,
            "signals": [
                {
                    "event_type": event.event_type.value,
                    "score_impact": event.score_impact,
                    "event_data": event.event_data,
                }
                for event in events
            ],
        }

        return to_json_safe(snapshot)
    @staticmethod
    def _get_decision(
        score: int,
        profile: RiskProfile | None = None,
    ) -> RiskDecision:
        review_threshold = (
            profile.review_threshold
            if profile is not None
            else 50
        )

        reject_threshold = (
            profile.reject_threshold
            if profile is not None
            else 80
        )

        if score >= reject_threshold:
            return RiskDecision.REJECT

        if score >= review_threshold:
            return RiskDecision.REVIEW

        return RiskDecision.ALLOW
