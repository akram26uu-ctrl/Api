from enum import Enum


class MerchantStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class RiskDecision(str, Enum):
    ALLOW = "allow"
    REVIEW = "review"
    REJECT = "reject"


class RiskEventType(str, Enum):
    VPN_DETECTED = "vpn_detected"
    PROXY_DETECTED = "proxy_detected"

    HIGH_CANCEL_RATE = "high_cancel_rate"

    PHONE_REUSED = "phone_reused"
    DEVICE_REUSED = "device_reused"
    ADDRESS_REUSED = "address_reused"

    NEW_DEVICE = "new_device"

    REPEATED_REQUEST = "repeated_request"

    MULTIPLE_CUSTOMERS_SAME_PHONE = (
        "multiple_customers_same_phone"
    )

    MULTIPLE_PHONES_SAME_DEVICE = (
        "multiple_phones_same_device"
    )

    MULTIPLE_CUSTOMERS_SAME_IP = (
        "multiple_customers_same_ip"
    )

    HIGH_IP_FREQUENCY = "high_ip_frequency"

    HIGH_ORDER_FREQUENCY = "high_order_frequency"

    DUPLICATE_ORDER_PATTERN = "duplicate_order_pattern"
    BURST_NETWORK_ACTIVITY = "burst_network_activity"
    STRONG_IDENTITY_COMBINATION = "strong_identity_combination"
    HIGH_CUSTOMER_VELOCITY = "high_customer_velocity"
    HIGH_PHONE_VELOCITY = "high_phone_velocity"
    HIGH_DEVICE_VELOCITY = "high_device_velocity"
    MULTIPLE_CUSTOMERS_SAME_ADDRESS = "multiple_customers_same_address"
    MULTIPLE_CUSTOMERS_SAME_DEVICE = "multiple_customers_same_device"
    HIGH_IP_REPUTATION = "high_ip_reputation"
    BOT_ACTIVITY = "bot_activity"
    TOR_DETECTED = "tor_detected"
    GLOBAL_PHONE_REPUTATION = "global_phone_reputation"
    GLOBAL_DEVICE_REPUTATION = "global_device_reputation"
    GLOBAL_IP_REPUTATION = "global_ip_reputation"
    IDENTITY_CLUSTER_RISK = "identity_cluster_risk"
    UNUSUAL_ORDER_QUANTITY = "unusual_order_quantity"
    UNUSUAL_ORDER_VALUE = "unusual_order_value"
