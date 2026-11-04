from decimal import Decimal
from app.core.algeria_geo import canonical_wilaya_text
from app.core.dz_input import normalize_dz_phone, to_cents

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from datetime import datetime

import ipaddress

from app.schemas.risk import RiskAssessmentResponse


def normalize_customer_ip(value: str | None) -> str | None:
    """Validate a shopper IP. Malformed -> error; non-public (private,
    loopback, reserved) -> None, because such an address cannot identify a
    shopper and would collapse unrelated customers into one network signal."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        parsed = ipaddress.ip_address(value)
    except ValueError as exc:
        raise ValueError("customer_ip must be a valid IPv4 or IPv6 address") from exc
    if getattr(parsed, "ipv4_mapped", None) is not None:
        parsed = parsed.ipv4_mapped
    if not parsed.is_global:
        return None
    return str(parsed)


class OrderItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    product_name: str = Field(min_length=1, max_length=255)
    sku: str | None = Field(default=None, max_length=100)
    product_category: str | None = Field(default=None, min_length=1, max_length=100)
    quantity: int = Field(gt=0, le=10000)
    unit_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)

    @field_validator("unit_price", mode="before")
    @classmethod
    def parse_unit_price(cls, value):
        return to_cents(value)


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_name: str
    sku: str | None
    product_category: str | None
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class OrderCreate(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
    )

    external_order_id: str = Field(
        min_length=1,
        max_length=255,
    )

    # One letter is a real (if terse) checkout entry; rejecting it lost orders.
    first_name: str = Field(
        min_length=1,
        max_length=100,
    )

    last_name: str = Field(
        min_length=1,
        max_length=100,
    )

    # Raw input may carry spaces, "(0)" and a country code; it is normalized
    # to 10 digits by validate_phone.
    phone: str = Field(
        min_length=9,
        max_length=32,
    )

    wilaya: str = Field(
        min_length=1,
        max_length=100,
    )

    commune: str = Field(
        min_length=1,
        max_length=100,
    )

    # A terse address is accepted and scored (LOW_QUALITY_IDENTITY) rather
    # than losing the order.
    address: str = Field(
        min_length=1,
        max_length=500,
    )

    total_amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )

    items: list[OrderItemCreate] = Field(default_factory=list, max_length=100)

    currency: str = Field(
        default="DZD",
        min_length=3,
        max_length=3,
    )

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        if any(ch.isalpha() for ch in value):
            raise ValueError("Phone number must contain only digits")
        value = normalize_dz_phone(value)
        if not value.isdigit():
            raise ValueError("Phone number must contain only digits")
        if len(value) != 10 or not value.startswith("0") or value.startswith("00"):
            raise ValueError("Invalid Algerian phone number")
        return value

    @field_validator("wilaya")
    @classmethod
    def readable_wilaya(cls, value: str) -> str:
        return canonical_wilaya_text(value)

    @field_validator("total_amount", mode="before")
    @classmethod
    def parse_total(cls, value):
        return to_cents(value)

    # The shopper's public IP as seen by the merchant's storefront. The API is
    # called server-to-server, so the transport peer IP is the merchant's
    # backend and must never be used as a customer risk signal.
    customer_ip: str | None = Field(default=None, max_length=45)

    @field_validator("customer_ip")
    @classmethod
    def validate_customer_ip(cls, value: str | None) -> str | None:
        return normalize_customer_ip(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        value = value.upper()

        if value != "DZD":
            raise ValueError(
                "Only DZD is currently supported",
            )

        return value


class OrderResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    order_id: str
    external_order_id: str
    status: str
    environment: str
    risk: RiskAssessmentResponse
    items: list[OrderItemResponse] = Field(default_factory=list)


class OrderListResponse(BaseModel):
    order_id: str
    external_order_id: str
    status: str
    environment: str
    store_id: str | None = None
    data_origin: str
    total_amount: Decimal
    currency: str
    first_name: str
    last_name: str
    phone: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime
    outcome_status: str | None = None
    risk: RiskAssessmentResponse
    items: list[OrderItemResponse] = Field(default_factory=list)


class OrderListPage(BaseModel):
    data: list[OrderListResponse]
    pagination: dict[str, int]
