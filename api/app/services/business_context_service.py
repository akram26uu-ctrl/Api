from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta, timezone
from decimal import Decimal
from statistics import median

from app.core.business_context import normalize_category
from app.models.order import Order
from app.repositories.order_item_repository import OrderItemRepository


@dataclass(frozen=True)
class BusinessContext: # kept as dict-compatible via to_dict
    merchant_category: str
    secondary_categories: list[str]
    scope: str
    category: str
    baseline_key: str | None
    baseline_confidence: str
    item_count: int
    total_quantity: int
    distinct_categories: list[str]
    items_subtotal: str
    amount: str
    quantity_baseline: dict
    value_baseline: dict
    time_behavior: dict

    def to_dict(self) -> dict:
        return {
            "merchant_category": self.merchant_category,
            "secondary_categories": self.secondary_categories,
            "baseline_scope": self.scope,
            "baseline_category": self.category,
            "baseline_key": self.baseline_key,
            "baseline_confidence": self.baseline_confidence,
            "item_count": self.item_count,
            "total_quantity": self.total_quantity,
            "distinct_categories": self.distinct_categories,
            "items_subtotal": self.items_subtotal,
            "order_amount": self.amount,
            "items_to_order_value_ratio": (
                float(self.items_subtotal) / float(self.amount) if float(self.amount) else None
            ),
            "quantity_baseline": self.quantity_baseline,
            "value_baseline": self.value_baseline,
            "time_behavior": self.time_behavior,
        }


class BusinessContextService:
    TIME_BEHAVIOR_LOOKBACK_DAYS = 180
    TIME_BEHAVIOR_BUCKET_HOURS = 2
    TIME_BEHAVIOR_MIN_BUCKET_SAMPLES = 10
    def __init__(self, db):
        self.db = db
        self.repository = OrderItemRepository(db)

    def build(
        self,
        order: Order,
        min_samples: int = 20,
        recent_days: int = 30,
        recent_min_samples: int = 10,
    ) -> dict:
        item_count = len(order.items)
        total_quantity = sum(item.quantity for item in order.items)
        categories = sorted({
            item.product_category_normalized
            for item in order.items
            if item.product_category_normalized
        })
        skus = sorted({
            item.sku.strip().casefold()
            for item in order.items
            if item.sku and item.sku.strip()
        })
        subtotal = sum((item.line_total for item in order.items), Decimal("0"))
        merchant_category = normalize_category(order.merchant.primary_business_category if order.merchant else None)
        category = categories[0] if len(categories) == 1 else (merchant_category if not categories else "mixed")

        merchant_quantity_samples = self.repository.merchant_quantity_samples(
            order.merchant_id, order.environment, exclude_order_id=order.id
        )
        merchant_value_samples = self.repository.merchant_value_samples(
            order.merchant_id, order.environment, exclude_order_id=order.id
        )

        candidates: list[tuple[str, str | None, list, list]] = []
        if len(skus) == 1:
            sku = skus[0]
            candidates.append(("sku", sku,
                self.repository.sku_quantity_samples(order.merchant_id, order.environment, sku, exclude_order_id=order.id),
                self.repository.sku_value_samples(order.merchant_id, order.environment, sku, exclude_order_id=order.id)))
        if len(categories) == 1:
            candidates.append(("product_category", categories[0],
                self.repository.category_quantity_samples(order.merchant_id, order.environment, categories[0], exclude_order_id=order.id),
                self.repository.category_value_samples(order.merchant_id, order.environment, categories[0], exclude_order_id=order.id)))
        candidates.append(("merchant", merchant_category, merchant_quantity_samples, merchant_value_samples))

        # Use the most specific baseline that has enough trusted history. If it
        # does not, fall back to a broader scope rather than using a tiny sample.
        selected = next((candidate for candidate in candidates
                         if len(candidate[2]) >= min_samples and len(candidate[3]) >= min_samples), None)
        if selected is None:
            selected = max(candidates, key=lambda candidate: min(len(candidate[2]), len(candidate[3])))

        scope, baseline_key, quantity_samples, value_samples = selected

        # Recent behavior is a secondary guardrail, not a replacement for
        # long-term history. A request is considered unusual only when it
        # exceeds both baselines when recent evidence is sufficiently large.
        created_at = order.created_at
        if created_at is not None and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        recent_since = (created_at - timedelta(days=max(1, recent_days))) if created_at else None

        if scope == "sku" and baseline_key:
            recent_quantity_samples = self.repository.sku_quantity_samples(
                order.merchant_id, order.environment, baseline_key,
                exclude_order_id=order.id, since=recent_since
            )
            recent_value_samples = self.repository.sku_value_samples(
                order.merchant_id, order.environment, baseline_key,
                exclude_order_id=order.id, since=recent_since
            )
        elif scope == "product_category" and baseline_key:
            recent_quantity_samples = self.repository.category_quantity_samples(
                order.merchant_id, order.environment, baseline_key,
                exclude_order_id=order.id, since=recent_since
            )
            recent_value_samples = self.repository.category_value_samples(
                order.merchant_id, order.environment, baseline_key,
                exclude_order_id=order.id, since=recent_since
            )
        else:
            recent_quantity_samples = self.repository.merchant_quantity_samples(
                order.merchant_id, order.environment, exclude_order_id=order.id, since=recent_since
            )
            recent_value_samples = self.repository.merchant_value_samples(
                order.merchant_id, order.environment, exclude_order_id=order.id, since=recent_since
            )

        time_behavior = self._build_time_behavior(order)

        recent_sample_size = min(len(recent_quantity_samples), len(recent_value_samples))
        recent_confidence = (
            "high" if recent_sample_size >= max(recent_min_samples * 3, 30)
            else "medium" if recent_sample_size >= recent_min_samples
            else "insufficient"
        )
        sample_size = min(len(quantity_samples), len(value_samples))
        confidence = (
            "high" if sample_size >= max(min_samples * 3, 60)
            else "medium" if sample_size >= min_samples
            else "low"
        )

        return BusinessContext(
            merchant_category=merchant_category,
            secondary_categories=list(order.merchant.secondary_business_categories or []) if order.merchant else [],
            scope=scope,
            category=category,
            baseline_key=baseline_key,
            baseline_confidence=confidence,
            item_count=item_count,
            total_quantity=total_quantity,
            distinct_categories=categories,
            items_subtotal=str(subtotal),
            amount=str(order.total_amount),
            quantity_baseline={
                **self._baseline(quantity_samples),
                "recent": self._baseline(recent_quantity_samples),
                "recent_window_days": max(1, recent_days),
                "recent_min_samples": recent_min_samples,
                "recent_confidence": recent_confidence,
            },
            value_baseline={
                **self._baseline(value_samples),
                "recent": self._baseline(recent_value_samples),
                "recent_window_days": max(1, recent_days),
                "recent_min_samples": recent_min_samples,
                "recent_confidence": recent_confidence,
            },
            time_behavior=time_behavior,
        ).to_dict()

    def _build_time_behavior(self, order: Order) -> dict:
        created_at = order.created_at
        if created_at is None:
            return {
                "timezone": "UTC",
                "lookback_days": self.TIME_BEHAVIOR_LOOKBACK_DAYS,
                "bucket_hours": self.TIME_BEHAVIOR_BUCKET_HOURS,
                "sample_size": 0,
                "same_weekday_sample_size": 0,
                "same_weekday_bucket_sample_size": 0,
                "same_weekday_share": None,
                "same_weekday_bucket_share": None,
                "confidence": "insufficient",
            }

        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        else:
            created_at = created_at.astimezone(timezone.utc)

        since = created_at - timedelta(days=self.TIME_BEHAVIOR_LOOKBACK_DAYS)
        timestamps = self.repository.merchant_order_timestamps(
            order.merchant_id,
            order.environment,
            exclude_order_id=order.id,
            since=since,
        )

        bucket_start = (created_at.hour // self.TIME_BEHAVIOR_BUCKET_HOURS) * self.TIME_BEHAVIOR_BUCKET_HOURS
        same_weekday = 0
        same_bucket = 0
        for timestamp in timestamps:
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            else:
                timestamp = timestamp.astimezone(timezone.utc)
            if timestamp.weekday() == created_at.weekday():
                same_weekday += 1
                historical_bucket = (timestamp.hour // self.TIME_BEHAVIOR_BUCKET_HOURS) * self.TIME_BEHAVIOR_BUCKET_HOURS
                if historical_bucket == bucket_start:
                    same_bucket += 1

        sample_size = len(timestamps)
        confidence = (
            "high" if same_bucket >= self.TIME_BEHAVIOR_MIN_BUCKET_SAMPLES * 2
            else "medium" if same_bucket >= self.TIME_BEHAVIOR_MIN_BUCKET_SAMPLES
            else "insufficient"
        )
        return {
            "timezone": "UTC",
            "lookback_days": self.TIME_BEHAVIOR_LOOKBACK_DAYS,
            "bucket_hours": self.TIME_BEHAVIOR_BUCKET_HOURS,
            "current_weekday": created_at.weekday(),
            "current_hour": created_at.hour,
            "current_bucket_start_hour": bucket_start,
            "sample_size": sample_size,
            "same_weekday_sample_size": same_weekday,
            "same_weekday_bucket_sample_size": same_bucket,
            "same_weekday_share": round(same_weekday / sample_size, 4) if sample_size else None,
            "same_weekday_bucket_share": round(same_bucket / sample_size, 4) if sample_size else None,
            "confidence": confidence,
        }

    @staticmethod
    def _baseline(values: list[int] | list[Decimal]) -> dict:
        if not values:
            return {"sample_size": 0, "median": None, "p95": None}
        ordered = sorted(values)
        p95_index = max(0, min(len(ordered) - 1, int(round(0.95 * (len(ordered) - 1)))))
        med = median(ordered)
        p95 = ordered[p95_index]
        return {
            "sample_size": len(values),
            "median": float(med),
            "p95": float(p95),
        }
