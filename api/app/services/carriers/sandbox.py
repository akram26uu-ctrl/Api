"""Fake carrier for the `test` environment. Shipments progress with SANDBOX_CLOCK.

Stateless across processes: the tracking number itself carries the creation time
and the outcome, ``SBX-<base36 epoch>-<D|R>-<digest of idempotency key>``, so any
worker can answer tracking. Cancellation is recorded on the shipment row only."""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Callable

from app.services.carriers.base import (
    SHIPMENT_STATUSES,
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

# Per-process cache: idempotency key -> tracking number, so a replay in the same
# process returns the same number (another process may mint a new epoch: fine for a sandbox).
_STATE: dict[str, str] = {}
_BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _to36(value: int) -> str:
    out = ""
    while True:
        value, rem = divmod(value, 36)
        out = _BASE36[rem] + out
        if value == 0:
            return out


def _parse(tracking: str) -> tuple[datetime, bool]:
    """(created_at, is_return) from a sandbox tracking number."""
    parts = str(tracking).split("-")
    if len(parts) != 4 or parts[0] != "SBX" or parts[2] not in ("D", "R") or not parts[1]:
        raise CarrierValidationError(f"unknown tracking {tracking}")
    try:
        epoch = int(parts[1], 36)
    except ValueError:
        raise CarrierValidationError(f"unknown tracking {tracking}") from None
    return datetime.fromtimestamp(epoch, tz=timezone.utc), parts[2] == "R"

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
        tracking = _STATE.get(req.idempotency_key)
        if tracking is None:
            digest = hashlib.sha256(req.idempotency_key.encode()).hexdigest()[:10].upper()
            epoch = int(SANDBOX_CLOCK().timestamp())
            tracking = f"SBX-{_to36(epoch)}-{'R' if 'RETURN' in address else 'D'}-{digest}"
            _STATE[req.idempotency_key] = tracking
        return CarrierShipmentResult(tracking, self.label_url(tracking), {"sandbox": True})

    def cancel_shipment(self, tracking: str) -> None:
        _parse(tracking)  # unknown numbers are still refused; the shipment row records the cancel

    def get_tracking(self, tracking: str) -> list[TrackingEvent]:
        created_at, is_return = _parse(tracking)
        now = SANDBOX_CLOCK()
        timeline = _RETURN_TIMELINE if is_return else _DELIVERY_TIMELINE
        events = [self._event(tracking, status, created_at + timedelta(hours=hours))
                  for hours, status in timeline if created_at + timedelta(hours=hours) <= now]
        events.sort(key=lambda e: e.occurred_at)
        return events

    def parse_webhook(self, headers: dict, body: bytes) -> list[tuple[str, TrackingEvent]]:
        key = str(self.credentials.get("api_token", "")).encode()
        expected = hmac.new(key, body, hashlib.sha256).hexdigest()
        given = next(
            (v for k, v in headers.items() if k.lower() == "x-sandbox-signature"), ""
        )
        if not hmac.compare_digest(expected.encode(), str(given).encode()):
            raise CarrierAuthError("bad sandbox webhook signature")
        try:
            items = json.loads(body)["events"]
            out = []
            for it in items:
                if it["status"] not in SHIPMENT_STATUSES:
                    raise CarrierValidationError(f"unknown status {it['status']!r}")
                at = datetime.fromisoformat(it["occurred_at"])
                if at.tzinfo is None:
                    at = at.replace(tzinfo=timezone.utc)
                out.append((it["tracking"], self._event(it["tracking"], it["status"], at)))
            return out
        except (ValueError, KeyError, TypeError) as exc:
            raise CarrierValidationError("malformed sandbox webhook") from exc

    def label_url(self, tracking: str) -> str | None:
        return f"https://sandbox.invalid/labels/{tracking}.pdf"

    @staticmethod
    def _event(tracking: str, status: str, at: datetime) -> TrackingEvent:
        return TrackingEvent(status, status, None, at, f"{tracking}:{status}")
