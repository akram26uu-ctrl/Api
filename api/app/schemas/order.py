from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from datetime import datetime

from app.schemas.risk import RiskAssessmentResponse


class OrderItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    product_name: str = Field(min_length=1, max_length=255)
    sku: str | None = Field(default=None, max_length=100)
    product_category: str | None = Field(default=None, min_length=2, max_length=100)
    quantity: int = Field(gt=0, le=10000)
    unit_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


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

    first_name: str = Field(
        min_length=2,
        max_length=100,
    )

    last_name: str = Field(
        min_length=2,
        max_length=100,
    )

    phone: str = Field(
        min_length=9,
        max_length=20,
    )

    wilaya: str = Field(
        min_length=2,
        max_length=100,
    )

    commune: str = Field(
        min_length=2,
        max_length=100,
    )

    address: str = Field(
        min_length=3,
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
        value = value.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace(".", "")

        if value.startswith("+213"):
            value = "0" + value[4:]
        elif value.startswith("00213"):
            value = "0" + value[5:]

        if not value.isdigit():
            raise ValueError(
                "Phone number must contain only digits",
            )

        if len(value) != 10 or not value.startswith("0"):
            raise ValueError(
                "Invalid Algerian phone number",
            )

        return value

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
