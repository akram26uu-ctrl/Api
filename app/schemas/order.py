from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


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

    currency: str = Field(
        default="DZD",
        min_length=3,
        max_length=3,
    )

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        value = value.replace(" ", "").replace("-", "")

        if value.startswith("+213"):
            value = "0" + value[4:]

        if not value.isdigit():
            raise ValueError("Phone number must contain only digits")

        if len(value) != 10 or not value.startswith("0"):
            raise ValueError("Invalid Algerian phone number")

        return value

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        value = value.upper()

        if value != "DZD":
            raise ValueError("Only DZD is currently supported")

        return value