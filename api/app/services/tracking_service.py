"""Applies carrier tracking events to shipments (webhook and polling share this path)."""
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.carrier_account import CarrierAccount
from app.models.enums import OrderStatus
from app.models.order import Order
from app.models.shipment import Shipment, ShipmentEvent
from app.services.carrier_account_service import CarrierAccountService
from app.services.carriers.base import STATUS_RANK, TrackingEvent
from app.services.dispatch_service import enqueue_shipment_updated
from app.services.inventory_service import InventoryService
from app.services.outcome_service import STATUS_MAP, OutcomeExists, record_outcome
from app.repositories.order_outcome_repository import OrderOutcomeRepository
from app.repositories.risk_assessment_repository import RiskAssessmentRepository
from app.services.risk_evaluation_service import RiskEvaluationService
from app.services.shipping_service import ShippingService
from app.services.shipping_settings_service import ShippingSettingsService

logger = logging.getLogger(__name__)

POLLED_STATUSES = ("accepted", "picked_up", "in_transit", "out_for_delivery",
                   "delivery_attempt_failed", "returning")


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
            try:
                with self.db.begin_nested():
                    self.db.add(ShipmentEvent(
                        shipment_id=shipment.id, status=event.status, raw_status=event.raw_status,
                        location=event.location, occurred_at=event.occurred_at, source=source,
                        dedupe_key=event.dedupe_key))
            except IntegrityError:
                continue  # inserted concurrently: a duplicate
            new += 1
            if self._advances(shipment.status, event.status):
                self._advance(shipment, event)
        return new

    @staticmethod
    def _advances(current: str, new: str) -> bool:
        if STATUS_RANK.get(new, -1) > STATUS_RANK.get(current, -1):
            return True
        # Carriers correct a "delivered" parcel that was actually refused.
        return current == "delivered" and new in ("returning", "returned")

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
            self._outcome(order, "returned", event, reason="customer_refused", correct=True)
        elif event.status == "cancelled":
            self.inventory.release(shipment)
        if event.status in ("delivery_attempt_failed", "returned"):
            self._notify_failure(shipment, event.status)
        account = self.db.get(CarrierAccount, shipment.carrier_account_id) if shipment.carrier_account_id else None
        if order is not None:
            enqueue_shipment_updated(self.db, shipment, order, event.status,
                                     account.carrier_code if account else None)
        self.db.flush()

    def _outcome(self, order: Order | None, status: str, event: TrackingEvent, reason: str | None = None,
                 correct: bool = False) -> None:
        if order is None:
            return
        occurred = max(_aware(event.occurred_at), _aware(order.created_at))
        try:
            record_outcome(self.db, order, status, source="carrier", reason=reason, occurred_at=occurred)
        except OutcomeExists:
            if correct:
                self._correct_outcome(order, status, reason, occurred)

    def _correct_outcome(self, order: Order, status: str, reason: str | None, occurred: datetime) -> None:
        """Delivered turned out to be refused: flip a carrier-written outcome (never another source)."""
        outcome = OrderOutcomeRepository(self.db).get_by_order_id(order.id)
        if outcome is None or outcome.source != "carrier" or outcome.outcome_status == status:
            return
        outcome.outcome_status, outcome.reason, outcome.occurred_at = status, reason, occurred
        order.status = STATUS_MAP[status]
        self.db.flush()
        assessment = RiskAssessmentRepository(self.db).get_latest_for_order(order.id)
        RiskEvaluationService(self.db).record_from_outcome(order=order, assessment=assessment, outcome=outcome)

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
                .order_by(Shipment.last_polled_at.asc().nulls_first(), Shipment.id)
                .limit(1)
                .with_for_update(skip_locked=True)
                .execution_options(populate_existing=True)
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
            shipment.last_polled_at = datetime.now(timezone.utc)  # failing rows go to the back too
            self.db.flush()
            if commit is not None:
                commit()
        self.db.flush()
        return counts
