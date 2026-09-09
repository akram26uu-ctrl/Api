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
    NEW_DEVICE = "new_device"
    REPEATED_REQUEST = "repeated_request"
    MULTIPLE_CUSTOMERS_SAME_PHONE = "multiple_customers_same_phone"
    MULTIPLE_PHONES_SAME_DEVICE = "multiple_phones_same_device"
    ADDRESS_REUSED = "address_reused"
    HIGH_ORDER_FREQUENCY = "high_order_frequency"