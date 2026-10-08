from dataclasses import dataclass
from datetime import timedelta

from app.models.enums import RiskEventType
from app.models.order import Order
from app.models.risk_event import RiskEvent
from app.models.risk_profile import RiskProfile
from app.repositories.order_repository import OrderRepository
from app.services.network_intelligence import NetworkIntelResult


@dataclass
class RiskRuleResult:
    score: int
    event: RiskEvent | None = None


class RiskRules:
    def __init__(
        self,
        order_repository: OrderRepository,
        profile: RiskProfile,
    ):
        self.order_repository = order_repository
        self.profile = profile

    def evaluate_high_cancel_rate(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if order.customer_id is None:
            return RiskRuleResult(score=0)

        total_orders = (
            self.order_repository.count_customer_orders(
                merchant_id=order.merchant_id,
                environment=order.environment,
                customer_id=order.customer_id,
                exclude_order_id=order.id,
            )
        )

        cancelled_orders = (
            self.order_repository.count_customer_cancelled_orders(
                merchant_id=order.merchant_id,
                environment=order.environment,
                customer_id=order.customer_id,
                exclude_order_id=order.id,
            )
        )

        if total_orders < self.profile.high_cancel_rate_min_orders:
            return RiskRuleResult(score=0)

        cancellation_rate = cancelled_orders / total_orders

        if (
            cancellation_rate
            < self.profile.high_cancel_rate_threshold
        ):
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.HIGH_CANCEL_RATE,
            score_impact=self.profile.high_cancel_rate_score,
            event_data={
                "previous_orders": total_orders,
                "cancelled_orders": cancelled_orders,
                "cancellation_rate": cancellation_rate,
                "threshold": self.profile.high_cancel_rate_threshold,
            },
        )

        return RiskRuleResult(
            score=self.profile.high_cancel_rate_score,
            event=event,
        )

    def evaluate_phone_reuse(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if order.phone_identifier_id is None:
            return RiskRuleResult(score=0)

        phone_orders = (
            self.order_repository.count_phone_orders(
                merchant_id=order.merchant_id,
                environment=order.environment,
                phone_identifier_id=order.phone_identifier_id,
                exclude_order_id=order.id,
            )
        )

        if phone_orders < self.profile.phone_reuse_threshold:
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.PHONE_REUSED,
            score_impact=self.profile.phone_reuse_score,
            event_data={
                "previous_orders": phone_orders,
                "threshold": self.profile.phone_reuse_threshold,
            },
        )

        return RiskRuleResult(
            score=self.profile.phone_reuse_score,
            event=event,
        )

    def evaluate_device_reuse(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if order.device_identifier_id is None:
            return RiskRuleResult(score=0)

        device_orders = (
            self.order_repository.count_device_orders(
                merchant_id=order.merchant_id,
                environment=order.environment,
                device_identifier_id=order.device_identifier_id,
                exclude_order_id=order.id,
            )
        )

        if device_orders < self.profile.device_reuse_threshold:
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.DEVICE_REUSED,
            score_impact=self.profile.device_reuse_score,
            event_data={
                "previous_orders": device_orders,
                "threshold": self.profile.device_reuse_threshold,
            },
        )

        return RiskRuleResult(
            score=self.profile.device_reuse_score,
            event=event,
        )

    def evaluate_address_reuse(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if order.address_identifier_id is None:
            return RiskRuleResult(score=0)

        address_orders = (
            self.order_repository.count_address_orders(
                merchant_id=order.merchant_id,
                environment=order.environment,
                address_identifier_id=order.address_identifier_id,
                exclude_order_id=order.id,
            )
        )

        if address_orders < self.profile.address_reuse_threshold:
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.ADDRESS_REUSED,
            score_impact=self.profile.address_reuse_score,
            event_data={
                "previous_orders": address_orders,
                "threshold": self.profile.address_reuse_threshold,
            },
        )

        return RiskRuleResult(
            score=self.profile.address_reuse_score,
            event=event,
        )

    def evaluate_multiple_customers_same_phone(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if order.phone_identifier_id is None:
            return RiskRuleResult(score=0)

        customer_count = (
            self.order_repository
            .count_distinct_customers_for_phone(
                merchant_id=order.merchant_id,
                environment=order.environment,
                phone_identifier_id=order.phone_identifier_id,
                exclude_order_id=order.id,
            )
        )

        if (
            customer_count
            < self.profile.multiple_customers_same_phone_threshold
        ):
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.MULTIPLE_CUSTOMERS_SAME_PHONE,
            score_impact=self.profile.multiple_customers_same_phone_score,
            event_data={
                "distinct_customers": customer_count,
                "threshold": (
                    self.profile
                    .multiple_customers_same_phone_threshold
                ),
            },
        )

        return RiskRuleResult(
            score=self.profile.multiple_customers_same_phone_score,
            event=event,
        )

    def evaluate_multiple_phones_same_device(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if order.device_identifier_id is None:
            return RiskRuleResult(score=0)

        phone_count = (
            self.order_repository
            .count_distinct_phones_for_device(
                merchant_id=order.merchant_id,
                environment=order.environment,
                device_identifier_id=order.device_identifier_id,
                exclude_order_id=order.id,
            )
        )

        if (
            phone_count
            < self.profile.multiple_phones_same_device_threshold
        ):
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.MULTIPLE_PHONES_SAME_DEVICE,
            score_impact=self.profile.multiple_phones_same_device_score,
            event_data={
                "distinct_phones": phone_count,
                "threshold": (
                    self.profile
                    .multiple_phones_same_device_threshold
                ),
            },
        )

        return RiskRuleResult(
            score=self.profile.multiple_phones_same_device_score,
            event=event,
        )

    def evaluate_high_order_frequency(
        self,
        order: Order,
    ) -> RiskRuleResult:
        window_start = (
            order.created_at
            - timedelta(
                minutes=self.profile.high_order_frequency_window_minutes,
            )
        )

        order_count = (
            self.order_repository.count_orders_since(
                merchant_id=order.merchant_id,
                environment=order.environment,
                since=window_start,
                exclude_order_id=order.id,
            )
        )

        if order_count < self.profile.high_order_frequency_count:
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.HIGH_ORDER_FREQUENCY,
            score_impact=self.profile.high_order_frequency_score,
            event_data={
                "previous_orders_in_window": order_count,
                "window_minutes": (
                    self.profile.high_order_frequency_window_minutes
                ),
                "threshold": (
                    self.profile.high_order_frequency_count
                ),
            },
        )

        return RiskRuleResult(
            score=self.profile.high_order_frequency_score,
            event=event,
        )

    def evaluate_new_device(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if (
            order.customer_id is None
            or order.device_identifier_id is None
        ):
            return RiskRuleResult(score=0)

        previous_customer_orders = (
            self.order_repository.count_customer_orders(
                merchant_id=order.merchant_id,
                environment=order.environment,
                customer_id=order.customer_id,
                exclude_order_id=order.id,
            )
        )

        if (
            previous_customer_orders
            < self.profile.new_device_customer_min_orders
        ):
            return RiskRuleResult(score=0)

        previous_orders_on_device = (
            self.order_repository
            .count_customer_orders_with_device(
                merchant_id=order.merchant_id,
                environment=order.environment,
                customer_id=order.customer_id,
                device_identifier_id=order.device_identifier_id,
                exclude_order_id=order.id,
            )
        )

        if previous_orders_on_device > 0:
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.NEW_DEVICE,
            score_impact=self.profile.new_device_score,
            event_data={
                "customer_previous_orders": previous_customer_orders,
                "customer_device_orders": previous_orders_on_device,
                "minimum_customer_orders": (
                    self.profile.new_device_customer_min_orders
                ),
            },
        )

        return RiskRuleResult(
            score=self.profile.new_device_score,
            event=event,
        )

    def evaluate_multiple_customers_same_ip(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if not order.ip_address:
            return RiskRuleResult(score=0)

        customer_count = (
            self.order_repository
            .count_distinct_customers_for_ip(
                merchant_id=order.merchant_id,
                environment=order.environment,
                ip_address=order.ip_address,
                exclude_order_id=order.id,
            )
        )

        if (
            customer_count
            < self.profile.multiple_customers_same_ip_threshold
        ):
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.MULTIPLE_CUSTOMERS_SAME_IP,
            score_impact=self.profile.multiple_customers_same_ip_score,
            event_data={
                "distinct_customers": customer_count,
                "threshold": (
                    self.profile.multiple_customers_same_ip_threshold
                ),
            },
        )

        return RiskRuleResult(
            score=self.profile.multiple_customers_same_ip_score,
            event=event,
        )

    def evaluate_high_ip_frequency(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if not order.ip_address:
            return RiskRuleResult(score=0)

        window_start = (
            order.created_at
            - timedelta(
                minutes=self.profile.high_ip_frequency_window_minutes,
            )
        )

        order_count = (
            self.order_repository
            .count_orders_for_ip_since(
                merchant_id=order.merchant_id,
                environment=order.environment,
                ip_address=order.ip_address,
                since=window_start,
                exclude_order_id=order.id,
            )
        )

        if (
            order_count
            < self.profile.high_ip_frequency_count
        ):
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.HIGH_IP_FREQUENCY,
            score_impact=self.profile.high_ip_frequency_score,
            event_data={
                "previous_orders_in_window": order_count,
                "window_minutes": (
                    self.profile.high_ip_frequency_window_minutes
                ),
                "threshold": self.profile.high_ip_frequency_count,
            },
        )

        return RiskRuleResult(
            score=self.profile.high_ip_frequency_score,
            event=event,
        )

    def evaluate_duplicate_order_pattern(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if order.phone_identifier_id is None or order.address_identifier_id is None:
            return RiskRuleResult(score=0)

        window_start = order.created_at - timedelta(
            minutes=self.profile.duplicate_order_window_minutes
        )
        previous_similar_orders = self.order_repository.count_recent_similar_orders(
            merchant_id=order.merchant_id,
            environment=order.environment,
            phone_identifier_id=order.phone_identifier_id,
            address_identifier_id=order.address_identifier_id,
            total_amount=order.total_amount,
            since=window_start,
            exclude_order_id=order.id,
        )

        if previous_similar_orders == 0:
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.DUPLICATE_ORDER_PATTERN,
            score_impact=self.profile.duplicate_order_score,
            event_data={
                "previous_similar_orders": previous_similar_orders,
                "window_minutes": self.profile.duplicate_order_window_minutes,
            },
        )
        return RiskRuleResult(score=self.profile.duplicate_order_score, event=event)

    def evaluate_burst_network_activity(
        self,
        order: Order,
    ) -> RiskRuleResult:
        if not order.ip_address:
            return RiskRuleResult(score=0)

        window_start = order.created_at - timedelta(
            minutes=self.profile.burst_ip_window_minutes
        )
        distinct_customers = self.order_repository.count_distinct_customers_for_ip(
            merchant_id=order.merchant_id,
            environment=order.environment,
            ip_address=order.ip_address,
            since=window_start,
            exclude_order_id=order.id,
        )
        distinct_phones = self.order_repository.count_distinct_phones_for_ip_since(
            merchant_id=order.merchant_id,
            ip_address=order.ip_address,
            since=window_start,
            environment=order.environment,
            exclude_order_id=order.id,
        )

        if (
            distinct_customers < self.profile.burst_ip_customer_threshold
            or distinct_phones < self.profile.burst_ip_phone_threshold
        ):
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.BURST_NETWORK_ACTIVITY,
            score_impact=self.profile.burst_ip_score,
            event_data={
                "distinct_customers": distinct_customers,
                "distinct_phones": distinct_phones,
                "window_minutes": self.profile.burst_ip_window_minutes,
                "customer_threshold": self.profile.burst_ip_customer_threshold,
                "phone_threshold": self.profile.burst_ip_phone_threshold,
            },
        )
        return RiskRuleResult(score=self.profile.burst_ip_score, event=event)

    def evaluate_customer_velocity(self, order: Order) -> RiskRuleResult:
        if order.customer_id is None:
            return RiskRuleResult(score=0)
        window_start = order.created_at - timedelta(minutes=self.profile.customer_velocity_window_minutes)
        count = self.order_repository.count_customer_orders_since(
            merchant_id=order.merchant_id, customer_id=order.customer_id,
            since=window_start, exclude_order_id=order.id, environment=order.environment,
        )
        if count < self.profile.customer_velocity_count:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.customer_velocity_score,
            event=RiskEvent(
                event_type=RiskEventType.HIGH_CUSTOMER_VELOCITY,
                score_impact=self.profile.customer_velocity_score,
                event_data={"previous_orders_in_window": count, "window_minutes": self.profile.customer_velocity_window_minutes, "threshold": self.profile.customer_velocity_count},
            ),
        )

    def evaluate_phone_velocity(self, order: Order) -> RiskRuleResult:
        if order.phone_identifier_id is None:
            return RiskRuleResult(score=0)
        window_start = order.created_at - timedelta(minutes=self.profile.phone_velocity_window_minutes)
        count = self.order_repository.count_phone_orders_since(
            merchant_id=order.merchant_id, phone_identifier_id=order.phone_identifier_id,
            since=window_start, exclude_order_id=order.id, environment=order.environment,
        )
        if count < self.profile.phone_velocity_count:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.phone_velocity_score,
            event=RiskEvent(
                event_type=RiskEventType.HIGH_PHONE_VELOCITY,
                score_impact=self.profile.phone_velocity_score,
                event_data={"previous_orders_in_window": count, "window_minutes": self.profile.phone_velocity_window_minutes, "threshold": self.profile.phone_velocity_count},
            ),
        )

    def evaluate_device_velocity(self, order: Order) -> RiskRuleResult:
        if order.device_identifier_id is None:
            return RiskRuleResult(score=0)
        window_start = order.created_at - timedelta(minutes=self.profile.device_velocity_window_minutes)
        count = self.order_repository.count_device_orders_since(
            merchant_id=order.merchant_id, device_identifier_id=order.device_identifier_id,
            since=window_start, exclude_order_id=order.id, environment=order.environment,
        )
        if count < self.profile.device_velocity_count:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.device_velocity_score,
            event=RiskEvent(
                event_type=RiskEventType.HIGH_DEVICE_VELOCITY,
                score_impact=self.profile.device_velocity_score,
                event_data={"previous_orders_in_window": count, "window_minutes": self.profile.device_velocity_window_minutes, "threshold": self.profile.device_velocity_count},
            ),
        )

    def evaluate_multiple_customers_same_address(self, order: Order) -> RiskRuleResult:
        if order.address_identifier_id is None:
            return RiskRuleResult(score=0)
        count = self.order_repository.count_distinct_customers_for_address(
            merchant_id=order.merchant_id, address_identifier_id=order.address_identifier_id,
            exclude_order_id=order.id, environment=order.environment,
        )
        if count < self.profile.multiple_customers_same_address_threshold:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.multiple_customers_same_address_score,
            event=RiskEvent(
                event_type=RiskEventType.MULTIPLE_CUSTOMERS_SAME_ADDRESS,
                score_impact=self.profile.multiple_customers_same_address_score,
                event_data={"distinct_customers": count, "threshold": self.profile.multiple_customers_same_address_threshold},
            ),
        )

    def evaluate_multiple_customers_same_device(self, order: Order) -> RiskRuleResult:
        if order.device_identifier_id is None:
            return RiskRuleResult(score=0)
        count = self.order_repository.count_distinct_customers_for_device(
            merchant_id=order.merchant_id, device_identifier_id=order.device_identifier_id,
            exclude_order_id=order.id, environment=order.environment,
        )
        if count < self.profile.multiple_customers_same_device_threshold:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.multiple_customers_same_device_score,
            event=RiskEvent(
                event_type=RiskEventType.MULTIPLE_CUSTOMERS_SAME_DEVICE,
                score_impact=self.profile.multiple_customers_same_device_score,
                event_data={"distinct_customers": count, "threshold": self.profile.multiple_customers_same_device_threshold},
            ),
        )

    def evaluate_network_reputation(self, order: Order, network_result: NetworkIntelResult | None) -> RiskRuleResult:
        if network_result is None or network_result.fraud_score is None:
            return RiskRuleResult(score=0)
        if network_result.fraud_score < self.profile.high_ip_reputation_threshold:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.high_ip_reputation_score,
            event=RiskEvent(
                event_type=RiskEventType.HIGH_IP_REPUTATION,
                score_impact=self.profile.high_ip_reputation_score,
                event_data={"fraud_score": network_result.fraud_score, "threshold": self.profile.high_ip_reputation_threshold, "provider": network_result.provider, "usage_type": network_result.usage_type},
            ),
        )

    def evaluate_bot_activity(self, order: Order, network_result: NetworkIntelResult | None) -> RiskRuleResult:
        if network_result is None or not network_result.bot_status:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.bot_activity_score,
            event=RiskEvent(
                event_type=RiskEventType.BOT_ACTIVITY,
                score_impact=self.profile.bot_activity_score,
                event_data={"bot_status": True, "provider": network_result.provider},
            ),
        )

    def evaluate_tor(self, order: Order, network_result: NetworkIntelResult | None) -> RiskRuleResult:
        if network_result is None or not network_result.tor:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.tor_score,
            event=RiskEvent(
                event_type=RiskEventType.TOR_DETECTED,
                score_impact=self.profile.tor_score,
                event_data={"tor": True, "provider": network_result.provider},
            ),
        )


    def evaluate_global_phone_reputation(self, order: Order) -> RiskRuleResult:
        if order.phone_identifier_id is None or order.environment != "live":
            return RiskRuleResult(score=0)
        total = self.order_repository.count_global_evaluated_orders_for_phone(order.phone_identifier_id, exclude_order_id=order.id)
        merchants = self.order_repository.count_global_merchants_for_phone(order.phone_identifier_id, exclude_order_id=order.id)
        if total < self.profile.global_phone_min_orders or merchants < self.profile.global_phone_min_merchants:
            return RiskRuleResult(score=0)
        bad = self.order_repository.count_global_bad_orders_for_phone(order.phone_identifier_id, exclude_order_id=order.id)
        bad_merchants = self.order_repository.count_global_bad_merchants_for_phone(order.phone_identifier_id, exclude_order_id=order.id)
        if bad_merchants < self.profile.global_reputation_min_bad_merchants:
            return RiskRuleResult(score=0)
        bad_rate = bad / total if total else 0.0
        if bad_rate < self.profile.global_phone_bad_rate_threshold:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.global_phone_score,
            event=RiskEvent(
                event_type=RiskEventType.GLOBAL_PHONE_REPUTATION,
                score_impact=self.profile.global_phone_score,
                event_data={
                    "scope": "global",
                    "signal_strength": "high",
                    "evidence": "cross_merchant_reputation",
                },
            ),
        )

    def evaluate_global_device_reputation(self, order: Order) -> RiskRuleResult:
        if order.device_identifier_id is None or order.environment != "live":
            return RiskRuleResult(score=0)
        total = self.order_repository.count_global_evaluated_orders_for_device(order.device_identifier_id, exclude_order_id=order.id)
        merchants = self.order_repository.count_global_merchants_for_device(order.device_identifier_id, exclude_order_id=order.id)
        if total < self.profile.global_device_min_orders or merchants < self.profile.global_device_min_merchants:
            return RiskRuleResult(score=0)
        bad = self.order_repository.count_global_bad_orders_for_device(order.device_identifier_id, exclude_order_id=order.id)
        bad_merchants = self.order_repository.count_global_bad_merchants_for_device(order.device_identifier_id, exclude_order_id=order.id)
        if bad_merchants < self.profile.global_reputation_min_bad_merchants:
            return RiskRuleResult(score=0)
        bad_rate = bad / total if total else 0.0
        if bad_rate < self.profile.global_device_bad_rate_threshold:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.global_device_score,
            event=RiskEvent(
                event_type=RiskEventType.GLOBAL_DEVICE_REPUTATION,
                score_impact=self.profile.global_device_score,
                event_data={
                    "scope": "global",
                    "signal_strength": "high",
                    "evidence": "cross_merchant_reputation",
                },
            ),
        )

    def evaluate_global_ip_reputation(self, order: Order) -> RiskRuleResult:
        if not order.ip_address or order.environment != "live":
            return RiskRuleResult(score=0)
        total = self.order_repository.count_global_evaluated_orders_for_ip(order.ip_address, exclude_order_id=order.id)
        merchants = self.order_repository.count_global_merchants_for_ip(order.ip_address, exclude_order_id=order.id)
        if total < self.profile.global_ip_min_orders or merchants < self.profile.global_ip_min_merchants:
            return RiskRuleResult(score=0)
        bad = self.order_repository.count_global_bad_orders_for_ip(order.ip_address, exclude_order_id=order.id)
        bad_merchants = self.order_repository.count_global_bad_merchants_for_ip(order.ip_address, exclude_order_id=order.id)
        if bad_merchants < self.profile.global_reputation_min_bad_merchants:
            return RiskRuleResult(score=0)
        bad_rate = bad / total if total else 0.0
        if bad_rate < self.profile.global_ip_bad_rate_threshold:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.global_ip_score,
            event=RiskEvent(
                event_type=RiskEventType.GLOBAL_IP_REPUTATION,
                score_impact=self.profile.global_ip_score,
                event_data={
                    "scope": "global",
                    "signal_strength": "high",
                    "evidence": "cross_merchant_reputation",
                },
            ),
        )

    def evaluate_unusual_order_quantity(self, order: Order, business_context: dict | None) -> RiskRuleResult:
        if not business_context or business_context.get("item_count", 0) <= 0:
            return RiskRuleResult(score=0)
        baseline = business_context.get("quantity_baseline") or {}
        sample_size = int(baseline.get("sample_size") or 0)
        p95 = baseline.get("p95")
        if sample_size < self.profile.business_context_min_orders or p95 is None:
            return RiskRuleResult(score=0)
        current = int(business_context.get("total_quantity") or 0)
        median_value = float(baseline.get("median") or 0)
        historical_threshold = max(
            float(p95) * self.profile.business_context_quantity_multiplier,
            median_value * 2.0,
        )
        recent = baseline.get("recent") or {}
        recent_sample_size = int(recent.get("sample_size") or 0)
        recent_p95 = recent.get("p95")
        recent_median = float(recent.get("median") or 0)
        recent_threshold = None
        if recent_sample_size >= int(baseline.get("recent_min_samples") or 0) and recent_p95 is not None:
            recent_threshold = max(
                float(recent_p95) * self.profile.business_context_quantity_multiplier,
                recent_median * 2.0,
            )
        threshold = max(historical_threshold, recent_threshold or 0.0)
        if current <= threshold:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.unusual_quantity_score,
            event=RiskEvent(
                event_type=RiskEventType.UNUSUAL_ORDER_QUANTITY,
                score_impact=self.profile.unusual_quantity_score,
                event_data={
                    "current_total_quantity": current,
                    "baseline_p95": p95,
                    "baseline_median": baseline.get("median"),
                    "threshold": threshold,
                    "historical_threshold": historical_threshold,
                    "recent_threshold": recent_threshold,
                    "recent_sample_size": recent_sample_size,
                    "baseline_confidence": business_context.get("baseline_confidence"),
                    "baseline_key": business_context.get("baseline_key"),
                    "sample_size": sample_size,
                    "baseline_scope": business_context.get("baseline_scope"),
                    "category": business_context.get("baseline_category"),
                },
            ),
        )

    def evaluate_unusual_order_value(self, order: Order, business_context: dict | None) -> RiskRuleResult:
        if not business_context or business_context.get("item_count", 0) <= 0:
            return RiskRuleResult(score=0)
        baseline = business_context.get("value_baseline") or {}
        sample_size = int(baseline.get("sample_size") or 0)
        p95 = baseline.get("p95")
        if sample_size < self.profile.business_context_min_orders or p95 is None:
            return RiskRuleResult(score=0)
        current = float(business_context.get("items_subtotal") or 0)
        median_value = float(baseline.get("median") or 0)
        historical_threshold = max(
            float(p95) * self.profile.business_context_value_multiplier,
            median_value * 2.5,
        )
        recent = baseline.get("recent") or {}
        recent_sample_size = int(recent.get("sample_size") or 0)
        recent_p95 = recent.get("p95")
        recent_median = float(recent.get("median") or 0)
        recent_threshold = None
        if recent_sample_size >= int(baseline.get("recent_min_samples") or 0) and recent_p95 is not None:
            recent_threshold = max(
                float(recent_p95) * self.profile.business_context_value_multiplier,
                recent_median * 2.5,
            )
        threshold = max(historical_threshold, recent_threshold or 0.0)
        if current <= threshold:
            return RiskRuleResult(score=0)
        return RiskRuleResult(
            score=self.profile.unusual_value_score,
            event=RiskEvent(
                event_type=RiskEventType.UNUSUAL_ORDER_VALUE,
                score_impact=self.profile.unusual_value_score,
                event_data={
                    "current_items_subtotal": current,
                    "baseline_p95": p95,
                    "baseline_median": baseline.get("median"),
                    "threshold": threshold,
                    "historical_threshold": historical_threshold,
                    "recent_threshold": recent_threshold,
                    "recent_sample_size": recent_sample_size,
                    "baseline_confidence": business_context.get("baseline_confidence"),
                    "baseline_key": business_context.get("baseline_key"),
                    "sample_size": sample_size,
                    "baseline_scope": business_context.get("baseline_scope"),
                    "category": business_context.get("baseline_category"),
                },
            ),
        )

    def evaluate_vpn(
        self,
        order: Order,
        network_result: NetworkIntelResult | None,
    ) -> RiskRuleResult:
        if network_result is None:
            return RiskRuleResult(score=0)

        if not network_result.vpn:
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.VPN_DETECTED,
            score_impact=self.profile.vpn_score,
            event_data={
                "vpn": True,
            },
        )

        return RiskRuleResult(
            score=self.profile.vpn_score,
            event=event,
        )

    def evaluate_proxy(
        self,
        order: Order,
        network_result: NetworkIntelResult | None,
    ) -> RiskRuleResult:
        if network_result is None:
            return RiskRuleResult(score=0)

        if not network_result.proxy or network_result.vpn:
            return RiskRuleResult(score=0)

        event = RiskEvent(
            event_type=RiskEventType.PROXY_DETECTED,
            score_impact=self.profile.proxy_score,
            event_data={
                "proxy": True,
            },
        )

        return RiskRuleResult(
            score=self.profile.proxy_score,
            event=event,
        )

    def evaluate_all(
        self,
        order: Order,
        network_result: NetworkIntelResult | None = None,
        business_context: dict | None = None,
    ) -> list[RiskRuleResult]:
        return [
            self.evaluate_high_cancel_rate(order),
            self.evaluate_phone_reuse(order),
            self.evaluate_device_reuse(order),
            self.evaluate_address_reuse(order),
            self.evaluate_multiple_customers_same_phone(order),
            self.evaluate_multiple_phones_same_device(order),
            self.evaluate_high_order_frequency(order),
            self.evaluate_new_device(order),
            self.evaluate_multiple_customers_same_ip(order),
            self.evaluate_high_ip_frequency(order),
            self.evaluate_duplicate_order_pattern(order),
            self.evaluate_burst_network_activity(order),
            self.evaluate_customer_velocity(order),
            self.evaluate_phone_velocity(order),
            self.evaluate_device_velocity(order),
            self.evaluate_multiple_customers_same_address(order),
            self.evaluate_multiple_customers_same_device(order),
            self.evaluate_vpn(order, network_result),
            self.evaluate_proxy(order, network_result),
            self.evaluate_tor(order, network_result),
            self.evaluate_network_reputation(order, network_result),
            self.evaluate_bot_activity(order, network_result),
            self.evaluate_global_phone_reputation(order),
            self.evaluate_global_device_reputation(order),
            self.evaluate_global_ip_reputation(order),
            self.evaluate_unusual_order_quantity(order, business_context),
            self.evaluate_unusual_order_value(order, business_context),
        ]