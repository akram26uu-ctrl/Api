from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    fulfillment: Literal["carrier", "merchant"] = "merchant"
    weight_grams: int | None = Field(default=None, ge=0)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    fulfillment: Literal["carrier", "merchant"] | None = None
    weight_grams: int | None = Field(default=None, ge=0)


class ProductLinkCreate(BaseModel):
    carrier_account_id: UUID
    external_product_id: str = Field(min_length=1, max_length=100)


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: UUID
    sku: str
    name: str
    fulfillment: str
    weight_grams: int | None = None
    created_at: datetime


class UnmappedProduct(BaseModel):
    sku: str | None = None
    display_sku: str | None = None
    name: str


class StockLocation(BaseModel):
    warehouse_id: UUID | None = None
    warehouse_name: str | None = None
    on_hand: int
    reserved: int
    inbound: int


class StockRow(BaseModel):
    product_id: UUID
    store_id: UUID
    sku: str
    name: str
    fulfillment: str
    locations: list[StockLocation]
    total_on_hand: int
    total_reserved: int
    total_inbound: int
    total_available: int
    is_low: bool
    status: Literal["ok", "low", "out", "merchant", "unmapped"]


class DepositLine(BaseModel):
    sku: str = Field(min_length=1, max_length=100)
    quantity: int = Field(gt=0)


class DepositCreate(BaseModel):
    carrier_account_id: UUID
    warehouse_id: UUID | None = None
    reference: str = Field(min_length=1, max_length=100)
    lines: list[DepositLine] = Field(min_length=1)


class DepositStatusUpdate(BaseModel):
    status: Literal["in_transit", "counting", "received"]


class DepositResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    carrier_account_id: UUID
    warehouse_id: UUID | None = None
    reference: str
    status: str
    lines: list[DepositLine]
    created_at: datetime


class MovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    warehouse_id: UUID | None = None
    delta: int
    reason: str
    shipment_id: UUID | None = None
    deposit_id: UUID | None = None
    occurred_at: datetime


class MovementPage(BaseModel):
    data: list[MovementResponse]
    pagination: dict
