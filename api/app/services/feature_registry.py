from dataclasses import dataclass


@dataclass(frozen=True)
class FeatureDefinition:
    name: str
    value_type: str
    source: str
    description: str
    version: str = "1"


FEATURES: tuple[FeatureDefinition, ...] = (
    FeatureDefinition("customer_order_count", "integer", "orders", "Historical order count for the customer."),
    FeatureDefinition("customer_cancel_rate", "float", "orders", "Historical cancellation rate for the customer."),
    FeatureDefinition("phone_reuse_count", "integer", "orders", "Historical orders using the phone identifier."),
    FeatureDefinition("device_customer_count", "integer", "orders", "Distinct customers associated with the device."),
    FeatureDefinition("address_customer_count", "integer", "orders", "Distinct customers associated with the address."),
    FeatureDefinition("ip_velocity_10m", "integer", "orders", "Orders from the IP in the last ten minutes."),
    FeatureDefinition("ip_customer_count_10m", "integer", "orders", "Distinct customers from the IP in the last ten minutes."),
    FeatureDefinition("network_fraud_score", "integer", "network", "External network reputation score when available."),
    FeatureDefinition("identity_cluster_size", "integer", "identity_graph", "Number of connected identity entities in the evaluated cluster."),
    FeatureDefinition("identity_confidence", "integer", "identity", "Confidence of the resolved customer identity, 0-100."),
    FeatureDefinition("merchant_business_category", "string", "merchant", "Normalized primary business category."),
    FeatureDefinition("order_item_count", "integer", "order_items", "Number of line items in the order."),
    FeatureDefinition("order_total_quantity", "integer", "order_items", "Total units across all line items."),
    FeatureDefinition("order_distinct_categories", "integer", "order_items", "Distinct normalized product categories."),
    FeatureDefinition("order_items_subtotal", "number", "order_items", "Sum of quantity multiplied by unit price."),
    FeatureDefinition("business_quantity_baseline_p95", "number", "business_context", "95th percentile historical quantity baseline."),
    FeatureDefinition("business_quantity_recent_baseline_p95", "number", "business_context", "95th percentile recent quantity baseline."),
    FeatureDefinition("business_value_baseline_p95", "number", "business_context", "95th percentile historical value baseline."),
    FeatureDefinition("business_value_recent_baseline_p95", "number", "business_context", "95th percentile recent value baseline."),
    FeatureDefinition("business_baseline_scope", "string", "business_context", "Most specific trusted baseline scope used for behavioral comparison."),
    FeatureDefinition("business_baseline_confidence", "string", "business_context", "Confidence level derived from trusted historical sample size."),
    FeatureDefinition("merchant_time_bucket_sample_size", "integer", "time_behavior", "Trusted delivered orders in the current UTC time bucket over the lookback window."),
    FeatureDefinition("merchant_same_weekday_sample_size", "integer", "time_behavior", "Trusted delivered orders on the current UTC weekday over the lookback window."),
    FeatureDefinition("merchant_time_bucket_share", "float", "time_behavior", "Share of trusted merchant activity occurring in the current UTC time bucket."),
    FeatureDefinition("merchant_time_behavior_confidence", "string", "time_behavior", "Confidence based on the number of trusted orders in the current time bucket."),
)


class FeatureRegistry:
    @classmethod
    def names(cls) -> tuple[str, ...]:
        return tuple(feature.name for feature in FEATURES)

    @classmethod
    def definitions(cls) -> list[dict]:
        return [feature.__dict__.copy() for feature in FEATURES]
