"""Fake carrier for the `test` environment. Shipments progress with SANDBOX_CLOCK."""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Callable

from app.services.carriers.base import (
    Capabilities,
    CarrierAuthError,
    CarrierShipmentResult,
    CarrierUnavailable,
    CarrierValidationError,
    ShipmentRequest,
    StockInfo,
    TrackingEvent,
    WarehouseInfo,
)

SANDBOX_CLOCK: Callable[[], datetime] = lambda: datetime.now(timezone.utc)  # noqa: E731

# tracking -> {"created_at", "return", "cancelled_at"}
_STATE: dict[str, dict] = {}

_DELIVERY_TIMELINE = [
    (0, "accepted"),
    (2, "picked_up"),
    (26, "in_transit"),
    (40, "out_for_delivery"),
    (48, "delivered"),
]
_RETURN_TIMELINE = [
    (0, "accepted"),
    (2, "picked_up"),
    (26, "in_transit"),
    (40, "out_for_delivery"),
    (44, "delivery_attempt_failed"),
    (46, "returning"),
    (50, "returned"),
]

_WAREHOUSES = [
    WarehouseInfo("ORN", "Oran Hub", "31", "Oran"),
    WarehouseInfo("ALG", "Alger Hub", "16", "Alger"),
]
_STOCK = [
    ("P1", "SNK-BLK-41", "Sneaker Black 41", "ORN", 25),
    ("P2", "SNK-BLK-42", "Sneaker Black 42", "ORN", 12),
    ("P3", "WAT-SLV-02", "Watch Silver", "ALG", 8),
]


class SandboxCarrier:
    code = "sandbox"
    capabilities = Capabilities(webhooks=True, warehouses=True, stop_desks=False, cancel=True)

    def __init__(self, credentials: dict) -> None:
        self.credentials = credentials

    def validate_credentials(self) -> None:
        if not str(self.credentials.get("api_token", "")).startswith("test_"):
            raise CarrierAuthError("sandbox accepts only test_ tokens")

    def list_warehouses(self) -> list[WarehouseInfo]:
        return list(_WAREHOUSES)

    def list_stock(self) -> list[StockInfo]:
        return [StockInfo(*row) for row in _STOCK]

    def create_shipment(self, req: ShipmentRequest) -> CarrierShipmentResult:
        address = req.recipient.address.upper()
        if "DOWN" in address:
            raise CarrierUnavailable("sandbox carrier is down")
        if "FAIL" in address:
            raise CarrierValidationError("sandbox rejected the address")
        digest = hashlib.sha256(req.idempotency_key.encode()).hexdigest()[:10].upper()
        tracking = f"SBX-{digest}"
        _STATE.setdefault(
            tracking,
            {"created_at": SANDBOX_CLOCK(), "return": "RETURN" in address, "cancelled_at": None},
        )
        return CarrierShipmentResult(tracking, self.label_url(tracking), {"sandbox": True})

    def cancel_shipment(self, tracking: str) -> None:
        self._state(tracking)["cancelled_at"] = SANDBOX_CLOCK()

    def get_tracking(self, tracking: str) -> list[TrackingEvent]:
        st = self._state(tracking)
        now = SANDBOX_CLOCK()
        timeline = _RETURN_TIMELINE if st["return"] else _DELIVERY_TIMELINE
        events = []
        for hours, status in timeline:
            at = st["created_at"] + timedelta(hours=hours)
            if at <= now:
                events.append(self._event(tracking, status, at))
        if st["cancelled_at"] is not None:
            events.append(self._event(tracking, "cancelled", st["cancelled_at"]))
        return events

    def parse_webhook(self, headers: dict, body: bytes) -> list[tuple[str, TrackingEvent]]:
        key = str(self.credentials.get("api_token", "")).encode()
        expected = hmac.new(key, body, hashlib.sha256).hexdigest()
        given = next(
            (v for k, v in headers.items() if k.lower() == "x-sandbox-signature"), ""
        )
        if not hmac.compare_digest(expected, str(given)):
            raise CarrierAuthError("bad sandbox webhook signature")
        try:
            items = json.loads(body)["events"]
            return [
                (
                    it["tracking"],
                    self._event(
                        it["tracking"], it["status"], datetime.fromisoformat(it["occurred_at"])
                    ),
                )
                for it in items
            ]
        except (ValueError, KeyError, TypeError) as exc:
            raise CarrierValidationError("malformed sandbox webhook") from exc

    def label_url(self, tracking: str) -> str | None:
        return f"https://sandbox.invalid/labels/{tracking}.pdf"

    @staticmethod
    def _state(tracking: str) -> dict:
        try:
            return _STATE[tracking]
        except KeyError:
            raise CarrierValidationError(f"unknown tracking {tracking}") from None

    @staticmethod
    def _event(tracking: str, status: str, at: datetime) -> TrackingEvent:
        return TrackingEvent(status, status, None, at, f"{tracking}:{status}")
