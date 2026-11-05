"""Sends due shipments to their carrier with retry, back-off and fallback.

Invariants: a held shipment (any non-null ``hold_reason``) is never dispatched,
and the carrier call is idempotent on the shipment id, so a retry after a crash
returns the same tracking number.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.algeria_geo import resolve_wilaya
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.models.order import Order
from app.models.shipment import Shipment, ShipmentEvent
from app.models.shipping_settings import ShippingSettings
from app.services.carrier_account_service import CarrierAccountService
from app.services.carriers.base import (
    CarrierError, CarrierUnavailable, CarrierValidationError, Recipient, ShipmentLine, ShipmentRequest,
)
from app.services.shipping_service import ShippingService
from app.services.shipping_settings_service import ShippingSettingsService
from app.services.webhook_service import WebhookService

logger = logging.getLogger(__name__)

MAX_BACKOFF = timedelta(hours=24)
ERROR_LIMIT = 500


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DispatchService:
    def __init__(self, db: Session, clock: Callable[[], datetime] = utcnow):
        self.db = db
        self.clock = clock
        self.shipping = ShippingService(db)
        self.settings_service = ShippingSettingsService(db)

    # ---- batch --------------------------------------------------------
    def run_batch(self, limit: int = 50, commit: Callable[[], None] | None = None) -> dict[str, int]:
        """``commit`` is called after each shipment so a crash loses at most one."""
        now = self.clock()
        self.shipping.expire_unconfirmed(now)  # re-check hold rules before picking work
        manual_stores = select(ShippingSettings.store_id).where(ShippingSettings.auto_dispatch.is_(False))
        due = self.db.scalars(
            select(Shipment)
            .where(Shipment.status == "pending_dispatch", Shipment.hold_reason.is_(None),
                   Shipment.next_attempt_at <= now, Shipment.store_id.not_in(manual_stores))
            .order_by(Shipment.next_attempt_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
        counts = {"dispatched": 0, "retried": 0, "failed": 0, "fell_back": 0}
        for shipment in due:
            try:
                with self.db.begin_nested():
                    outcome = self.dispatch_one(shipment, source="poll")
            except Exception as exc:
                logger.exception("dispatch failed unexpectedly shipment=%s", shipment.id)
                self._back_off_after_error(shipment, exc)
                outcome = None
            if outcome in counts:
                counts[outcome] += 1
            if commit is not None:
                commit()
        self.db.flush()
        return counts

    def _back_off_after_error(self, shipment: Shipment, exc: Exception) -> None:
        """Unexpected error (possibly after the carrier accepted): retry later, idempotently."""
        try:
            with self.db.begin_nested():
                minutes = 10
                if shipment.store_id is not None:
                    minutes = self.settings_service.get_or_default(shipment.store_id).retry_interval_minutes
                shipment.last_error = f"{exc.__class__.__name__}: {exc}"[:ERROR_LIMIT]
                shipment.next_attempt_at = self.clock() + timedelta(minutes=minutes)
        except Exception:
            logger.exception("could not record dispatch error shipment=%s", shipment.id)

    # ---- one shipment -------------------------------------------------
    def dispatch_one(self, shipment: Shipment, source: str = "poll") -> str:
        """Returns dispatched | retried | failed | fell_back | skipped."""
        if shipment.status != "pending_dispatch" or shipment.hold_reason is not None:
            return "skipped"
        order = self.db.get(Order, shipment.order_id)
        if order is None:
            return self._fail(shipment, "order_not_found")
        account, error = self._account(shipment, order)
        if account is None:
            return self._fail(shipment, error or "no_carrier_route")
        try:
            request = self._request(shipment, order)
            result = CarrierAccountService(self.db).adapter_for(account).create_shipment(request)
        except CarrierUnavailable as exc:
            return self._unavailable(shipment, order, account, str(exc))
        except CarrierError as exc:
            return self._fail(shipment, str(exc) or exc.__class__.__name__)
        self._accept(shipment, order, account, result, source)
        return "dispatched"

    def _switch_carrier(self, shipment: Shipment, order: Order, account: CarrierAccount) -> bool:
        """Move to another carrier. Carrier-held stock is released and re-allocated in that
        carrier's warehouses; returns False when it cannot be (the stock is then released)."""
        shipment.carrier_account_id = account.id
        had_stock = shipment.fulfillment == "carrier" and (
            shipment.warehouse_id is not None or (shipment.meta or {}).get("stock") == "reserved")
        if not had_stock:
            shipment.warehouse_id = None
            return True
        self.shipping.inventory.release(shipment)
        shipment.warehouse_id = None
        self.shipping._quiet = True
        try:
            self.shipping.allocate_and_reserve(shipment, account=account)
        finally:
            self.shipping._quiet = False
        ok = shipment.hold_reason is None and (shipment.meta or {}).get("stock") == "reserved" \
            and shipment.warehouse_id is not None
        if not ok:
            shipment.hold_reason = None  # a failed shipment is not held
            self.shipping._set_meta(shipment, backorder=None)
        return ok

    # ---- helpers ------------------------------------------------------
    def _wilaya_code(self, order: Order) -> str | None:
        address = order.address_identifier
        return resolve_wilaya(address.wilaya) if address is not None else None

    def _route(self, order: Order):
        if order.store_id is None:
            return None, None
        return self.settings_service.resolve_route(order.store_id, order.environment, self._wilaya_code(order))

    def _account(self, shipment: Shipment, order: Order) -> tuple[CarrierAccount | None, str | None]:
        account = self.db.get(CarrierAccount, shipment.carrier_account_id) if shipment.carrier_account_id else None
        if account is not None and account.status == "active":
            return account, None
        primary, _ = self._route(order)
        if primary is None:
            return None, "no_carrier_route"
        if not self._switch_carrier(shipment, order, primary):
            return None, "reroute_no_stock"
        return primary, None

    def _request(self, shipment: Shipment, order: Order) -> ShipmentRequest:
        phone = order.phone_identifier.phone if order.phone_identifier is not None else None
        address = order.address_identifier
        if not phone:
            raise CarrierValidationError("Order has no phone number")
        if address is None or not (address.normalized_address or "").strip():
            raise CarrierValidationError("Order has no delivery address")
        warehouse_external_id = None
        if shipment.fulfillment == "carrier" and shipment.warehouse_id is not None:
            warehouse = self.db.get(CarrierWarehouse, shipment.warehouse_id)
            warehouse_external_id = warehouse.external_id if warehouse is not None else None
        return ShipmentRequest(
            idempotency_key=shipment.idempotency_key,
            recipient=Recipient(first_name=order.first_name, last_name=order.last_name, phone=phone,
                                wilaya=address.wilaya or "", commune=address.commune or "",
                                address=address.normalized_address),
            delivery_type=order.delivery_type or shipment.delivery_type,
            stop_desk_id=order.stop_desk_id,
            cod_amount=order.total_amount,
            lines=[ShipmentLine(sku=i.sku or "", name=i.product_name, quantity=int(i.quantity)) for i in order.items],
            warehouse_external_id=warehouse_external_id,
        )

    def _accept(self, shipment: Shipment, order: Order, account: CarrierAccount, result, source: str) -> None:
        now = self.clock()
        shipment.status = "accepted"
        shipment.tracking_number = result.tracking_number
        shipment.label_url = result.label_url
        shipment.dispatched_at = now
        shipment.next_attempt_at = None
        shipment.last_error = None
        dedupe = f"{result.tracking_number}:accepted"
        if self.db.query(ShipmentEvent.id).filter_by(shipment_id=shipment.id, dedupe_key=dedupe).first() is not None:
            self.db.flush()
            return
        self.db.add(ShipmentEvent(shipment_id=shipment.id, status="accepted", raw_status="accepted",
                                  occurred_at=now, source=source, dedupe_key=dedupe))
        WebhookService(self.db).enqueue(
            shipment.merchant_id, shipment.environment, "order.shipment.updated",
            {"order_id": str(order.id), "external_order_id": order.external_order_id,
             "shipment_id": str(shipment.id), "status": "accepted",
             "tracking_number": result.tracking_number, "carrier_code": account.carrier_code},
            store_id=shipment.store_id)
        self.db.flush()

    def _fail(self, shipment: Shipment, message: str, count_attempt: bool = True) -> str:
        shipment.status = "dispatch_failed"
        shipment.next_attempt_at = None
        if count_attempt:
            shipment.attempts += 1
        shipment.last_error = message[:ERROR_LIMIT]
        self.shipping.inventory.release(shipment)
        if shipment.store_id is None or self.settings_service.get_or_default(shipment.store_id).notify_on_failure:
            self.shipping._notify(shipment, "shipment.dispatch_failed", "Shipment dispatch failed",
                                  shipment.last_error, severity="error")
        self.db.flush()
        return "failed"

    def _unavailable(self, shipment: Shipment, order: Order, account: CarrierAccount, message: str) -> str:
        now = self.clock()
        settings = self.settings_service.get_or_default(order.store_id)
        shipment.attempts += 1
        shipment.last_error = message[:ERROR_LIMIT]
        if shipment.attempts >= settings.retry_max:
            fallback = self._fallback(shipment, order, account) if settings.fallback_enabled else None
            if fallback is None:
                return self._fail(shipment, message, count_attempt=False)
            self.shipping._set_meta(shipment, fell_back=True)
            if not self._switch_carrier(shipment, order, fallback):
                return self._fail(shipment, "fallback_no_stock", count_attempt=False)
            shipment.attempts = 0
            shipment.next_attempt_at = now
            self.db.flush()
            return "fell_back"
        delay = min(MAX_BACKOFF, timedelta(minutes=settings.retry_interval_minutes) * 2 ** (shipment.attempts - 1))
        shipment.next_attempt_at = now + delay
        self.db.flush()
        return "retried"

    def _fallback(self, shipment: Shipment, order: Order, account: CarrierAccount) -> CarrierAccount | None:
        if (shipment.meta or {}).get("fell_back"):
            return None
        primary, fallback = self._route(order)
        if fallback is None or fallback.id == account.id:
            return None
        return fallback
