from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
