"""Applies carrier tracking events to shipments (webhook and polling share this path)."""
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.carrier_account import CarrierAccount
from app.models.enums import OrderStatus
from app.models.order import Order
from app.models.shipment import Shipment, ShipmentEvent
from app.services.carrier_account_service import CarrierAccountService
from app.services.carriers.base import STATUS_RANK, TrackingEvent
from app.services.dispatch_service import enqueue_shipment_updated
from app.services.inventory_service import InventoryService
from app.services.outcome_service import OutcomeExists, record_outcome
from app.services.shipping_service import ShippingService
from app.services.shipping_settings_service import ShippingSettingsService

logger = logging.getLogger(__name__)

POLLED_STATUSES = ("accepted", "picked_up", "in_transit", "out_for_delivery",
                   "delivery_attempt_failed", "returning")
ERROR_LIMIT = 500


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class TrackingService:
    def __init__(self, db: Session):
        self.db = db
        self.inventory = InventoryService(db)
        self.shipping = ShippingService(db)

    def apply_events(self, shipment: Shipment, events: list[TrackingEvent], source: str) -> int:
        """Stores new events (deduped per shipment) and advances the status monotonically.
        Returns the number of new events."""
        new = 0
        for event in sorted(events, key=lambda e: _aware(e.occurred_at)):
            exists = self.db.query(ShipmentEvent.id).filter_by(
                shipment_id=shipment.id, dedupe_key=event.dedupe_key).first()
            if exists is not None:
                continue
            self.db.add(ShipmentEvent(
                shipment_id=shipment.id, status=event.status, raw_status=event.raw_status,
                location=event.location, occurred_at=event.occurred_at, source=source,
                dedupe_key=event.dedupe_key))
            self.db.flush()
            new += 1
            if STATUS_RANK.get(event.status, -1) > STATUS_RANK.get(shipment.status, -1):
                self._advance(shipment, event)
        return new

    # ---- transitions --------------------------------------------------
    def _advance(self, shipment: Shipment, event: TrackingEvent) -> None:
        shipment.status = event.status
        order = self.db.get(Order, shipment.order_id)
        if event.status == "picked_up":
            if order is not None and order.status in (OrderStatus.PENDING, OrderStatus.CONFIRMED):
                order.status = OrderStatus.SHIPPED
        elif event.status == "delivered":
            shipment.delivered_at = event.occurred_at
            self.inventory.consume(shipment)
            self._outcome(order, "delivered", event)
        elif event.status == "returned":
            state = (shipment.meta or {}).get("stock")
            if state == "consumed":
                self.inventory.restock(shipment)
            elif state == "reserved":
                self.inventory.release(shipment)
            self._outcome(order, "returned", event, reason="customer_refused")
        elif event.status == "cancelled":
            self.inventory.release(shipment)
        if event.status in ("delivery_attempt_failed", "returned"):
            self._notify_failure(shipment, event.status)
        account = self.db.get(CarrierAccount, shipment.carrier_account_id) if shipment.carrier_account_id else None
        if order is not None:
            enqueue_shipment_updated(self.db, shipment, order, event.status,
                                     account.carrier_code if account else None)
        self.db.flush()

    def _outcome(self, order: Order | None, status: str, event: TrackingEvent, reason: str | None = None) -> None:
        if order is None:
            return
        occurred = max(_aware(event.occurred_at), _aware(order.created_at))
        try:
            record_outcome(self.db, order, status, source="carrier", reason=reason, occurred_at=occurred)
        except OutcomeExists:
            pass

    def _notify_failure(self, shipment: Shipment, status: str) -> None:
        if shipment.store_id is not None and not ShippingSettingsService(self.db).get_or_default(
                shipment.store_id).notify_on_failure:
            return
        self.shipping._notify(shipment, f"shipment.{status}", "Shipment delivery problem",
                              f"The carrier reported: {status}.")

    # ---- polling ------------------------------------------------------
    def sync_active(self, limit: int = 200, commit=None) -> dict[str, int]:
        """Polls carriers for in-flight shipments. One row is claimed at a time."""
        counts = {"polled": 0, "events": 0, "errors": 0}
        seen: set = set()
        for _ in range(limit):
            shipment = self.db.scalars(
                select(Shipment)
                .where(Shipment.status.in_(POLLED_STATUSES), Shipment.tracking_number.is_not(None),
                       Shipment.carrier_account_id.is_not(None), Shipment.id.not_in(seen))
                .order_by(Shipment.updated_at)
                .limit(1)
                .with_for_update(skip_locked=True)
            ).first()
            if shipment is None:
                break
            seen.add(shipment.id)
            account = self.db.get(CarrierAccount, shipment.carrier_account_id)
            try:
                with self.db.begin_nested():
                    adapter = CarrierAccountService(self.db).adapter_for(account)
                    events = adapter.get_tracking(shipment.tracking_number)
                    counts["events"] += self.apply_events(shipment, events, "poll")
                counts["polled"] += 1
            except Exception as exc:
                logger.warning("tracking poll failed shipment=%s: %s", shipment.id, exc)
                counts["errors"] += 1
                if account is not None:
                    account.last_error = f"{exc.__class__.__name__}: {exc}"[:ERROR_LIMIT]
            if commit is not None:
                commit()
        self.db.flush()
        return counts
