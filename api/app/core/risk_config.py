from dataclasses import dataclass


@dataclass(frozen=True)
class RiskProfileDefaults:
    high_cancel_rate_threshold: float = 0.70
    high_cancel_rate_min_orders: int = 5
    high_cancel_rate_score: int = 35

    phone_reuse_threshold: int = 10
    phone_reuse_score: int = 15

    device_reuse_threshold: int = 10
    device_reuse_score: int = 20

    address_reuse_threshold: int = 10
    address_reuse_score: int = 15

    multiple_customers_same_phone_threshold: int = 2
    multiple_customers_same_phone_score: int = 20

    multiple_phones_same_device_threshold: int = 2
    multiple_phones_same_device_score: int = 25

    high_order_frequency_count: int = 5
    high_order_frequency_window_minutes: int = 10
    high_order_frequency_score: int = 20

    high_ip_frequency_count: int = 5
    high_ip_frequency_window_minutes: int = 10
    high_ip_frequency_score: int = 20

    multiple_customers_same_ip_threshold: int = 2
    multiple_customers_same_ip_score: int = 20

    new_device_customer_min_orders: int = 2
    new_device_score: int = 10

    vpn_score: int = 15
    proxy_score: int = 15

    duplicate_order_window_minutes: int = 30
    duplicate_order_score: int = 10

    burst_ip_window_minutes: int = 10
    burst_ip_customer_threshold: int = 3
    burst_ip_phone_threshold: int = 3
    burst_ip_score: int = 20

    strong_identity_combination_score: int = 15

    customer_velocity_count: int = 3
    customer_velocity_window_minutes: int = 15
    customer_velocity_score: int = 10

    phone_velocity_count: int = 3
    phone_velocity_window_minutes: int = 15
    phone_velocity_score: int = 12

    device_velocity_count: int = 3
    device_velocity_window_minutes: int = 15
    device_velocity_score: int = 12

    multiple_customers_same_address_threshold: int = 3
    multiple_customers_same_address_score: int = 18

    multiple_customers_same_device_threshold: int = 3
    multiple_customers_same_device_score: int = 25

    high_ip_reputation_threshold: int = 85
    high_ip_reputation_score: int = 20
    bot_activity_score: int = 15
    tor_score: int = 20

    global_phone_min_orders: int = 12
    global_phone_bad_rate_threshold: float = 0.70
    global_phone_min_merchants: int = 2
    global_reputation_min_bad_merchants: int = 2
    global_phone_score: int = 20

    global_device_min_orders: int = 10
    global_device_bad_rate_threshold: float = 0.65
    global_device_min_merchants: int = 2
    global_device_score: int = 25

    global_ip_min_orders: int = 20
    global_ip_bad_rate_threshold: float = 0.70
    global_ip_min_merchants: int = 3
    global_ip_score: int = 20

    business_context_min_orders: int = 20
    business_context_recent_days: int = 30
    business_context_recent_min_orders: int = 10
    business_context_quantity_multiplier: float = 1.75
    business_context_value_multiplier: float = 2.00
    unusual_quantity_score: int = 10
    unusual_value_score: int = 10

    review_threshold: int = 50
    reject_threshold: int = 80
    identity_cluster_threshold: int = 6
    identity_cluster_score: int = 15
    max_score: int = 100


DEFAULT_RISK_PROFILE = RiskProfileDefaults()