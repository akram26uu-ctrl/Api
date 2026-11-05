"""Carrier adapter contract: DTOs, errors, status ordering and the adapter protocol."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol

SHIPMENT_STATUSES: tuple[str, ...] = (
    "pending_dispatch",
    "dispatch_failed",
    "accepted",
    "picked_up",
    "in_transit",
    "out_for_delivery",
    "delivery_attempt_failed",
    "delivered",
    "returning",
    "returned",
    "cancelled",
)

# Higher rank wins when events arrive out of order; terminal states rank highest.
STATUS_RANK: dict[str, int] = {
    "pending_dispatch": 0,
    "dispatch_failed": 1,
    "accepted": 2,
    "picked_up": 3,
    "in_transit": 4,
    "out_for_delivery": 5,
    "delivery_attempt_failed": 6,
    "returning": 7,
    "delivered": 8,
    "returned": 8,
    "cancelled": 8,
}


class CarrierError(Exception):
    pass


class CarrierAuthError(CarrierError):
    pass


class CarrierValidationError(CarrierError):
    """Carrier rejected the request; retrying will not help."""


class CarrierUnavailable(CarrierError):
    """Transient carrier failure; safe to retry."""


@dataclass(frozen=True)
class Recipient:
    first_name: str
    last_name: str
    phone: str
    wilaya: str
    commune: str
    address: str


@dataclass(frozen=True)
class ShipmentLine:
    sku: str
    name: str
    quantity: int


@dataclass(frozen=True)
class ShipmentRequest:
    idempotency_key: str
    recipient: Recipient
    delivery_type: str
    stop_desk_id: str | None
    cod_amount: Decimal
    lines: list[ShipmentLine]
    warehouse_external_id: str | None


@dataclass(frozen=True)
class CarrierShipmentResult:
    tracking_number: str
    label_url: str | None
    raw: dict


@dataclass(frozen=True)
class TrackingEvent:
    status: str
    raw_status: str
    location: str | None
    occurred_at: datetime
    dedupe_key: str


@dataclass(frozen=True)
class WarehouseInfo:
    external_id: str
    name: str
    wilaya_code: str
    commune: str


@dataclass(frozen=True)
class StockInfo:
    external_product_id: str
    sku: str
    name: str
    warehouse_external_id: str
    on_hand: int


@dataclass(frozen=True)
class Capabilities:
    webhooks: bool
    warehouses: bool
    stop_desks: bool
    cancel: bool


class CarrierAdapter(Protocol):
    code: str
    capabilities: Capabilities

    def __init__(self, credentials: dict) -> None: ...

    def validate_credentials(self) -> None: ...

    def list_warehouses(self) -> list[WarehouseInfo]: ...

    def list_stock(self) -> list[StockInfo]: ...

    def create_shipment(self, req: ShipmentRequest) -> CarrierShipmentResult: ...

    def cancel_shipment(self, tracking: str) -> None: ...

    def get_tracking(self, tracking: str) -> list[TrackingEvent]: ...

    def parse_webhook(
        self, headers: dict, body: bytes
    ) -> list[tuple[str, TrackingEvent]]: ...

    def label_url(self, tracking: str) -> str | None: ...
