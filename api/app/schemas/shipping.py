from datetime import datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CarrierAccountCreate(BaseModel):
    carrier_code: str = Field(min_length=1, max_length=40)
    display_name: str = Field(min_length=1, max_length=150)
    credentials: dict = Field(default_factory=dict)


class CarrierAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: UUID
    environment: str
    carrier_code: str
    display_name: str
    status: str
    last_sync_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime


class CarrierWarehouseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    external_id: str
    name: str
    wilaya_code: str | None = None
    commune: str | None = None
    is_active: bool


class CarrierListResponse(BaseModel):
    accounts: list[CarrierAccountResponse]
    available: list[dict]


class ShippingSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    auto_dispatch: bool | None = None
    dispatch_trigger: Literal["after_confirmation", "on_allow"] | None = None
    hold_minutes: int | None = Field(default=None, ge=0, le=1440)
    confirmation_timeout_hours: int | None = Field(default=None, ge=1, le=168)
    retry_max: int | None = Field(default=None, ge=0, le=20)
    retry_interval_minutes: int | None = Field(default=None, ge=1, le=1440)
    fallback_enabled: bool | None = None
    out_of_stock_policy: Literal["hold", "backorder", "other_warehouse"] | None = None
    low_stock_days: int | None = Field(default=None, ge=1, le=60)
    reserve_on_accept: bool | None = None
    disable_product_when_out: bool | None = None
    pickup_name: str | None = Field(default=None, max_length=150)
    pickup_wilaya: str | None = Field(default=None, max_length=100)
    pickup_commune: str | None = Field(default=None, max_length=100)
    pickup_phone: str | None = Field(default=None, max_length=32)
    label_size: Literal["a6", "a4_4", "a4_1"] | None = None
    notify_on_hold: bool | None = None
    notify_on_failure: bool | None = None
    notify_on_low_stock: bool | None = None


class ShippingSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    store_id: UUID
    auto_dispatch: bool
    dispatch_trigger: str
    hold_minutes: int
    confirmation_timeout_hours: int
    retry_max: int
    retry_interval_minutes: int
    fallback_enabled: bool
    out_of_stock_policy: str
    low_stock_days: int
    reserve_on_accept: bool
    disable_product_when_out: bool
    pickup_name: str | None = None
    pickup_wilaya: str | None = None
    pickup_commune: str | None = None
    pickup_phone: str | None = None
    label_size: str
    notify_on_hold: bool
    notify_on_failure: bool
    notify_on_low_stock: bool


class ShippingRouteWrite(BaseModel):
    wilaya_codes: list[str] = Field(default_factory=list, max_length=58)
    carrier_account_id: UUID
    fallback_carrier_account_id: UUID | None = None
    priority: int = Field(default=100, ge=0, le=100000)

    @field_validator("wilaya_codes")
    @classmethod
    def _codes(cls, value: list[str]) -> list[str]:
        for code in value:
            if not (len(code) == 2 and code.isascii() and code.isdigit() and 1 <= int(code) <= 58):
                raise ValueError(f"invalid wilaya code: {code}")
        return sorted(set(value))


class ShippingRouteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: UUID
    wilaya_codes: list[str]
    carrier_account_id: UUID
    fallback_carrier_account_id: UUID | None = None
    priority: int


class ShipmentCreate(BaseModel):
    order_id: UUID


class DispatchFromRequest(BaseModel):
    warehouse_id: UUID
