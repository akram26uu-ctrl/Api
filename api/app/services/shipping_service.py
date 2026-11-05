"""Creates and holds shipments from risk decisions and customer confirmations.

Invariant: a shipment held for ``review`` / ``rejected`` is never dispatchable
(no ``next_attempt_at``) until a merchant explicitly approves it.
"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.algeria_geo import resolve_wilaya
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.models.enums import OrderStatus, RiskDecision
from app.models.merchant import Merchant
from app.models.notification import Notification
from app.models.order import Order
from app.models.product import Product
from app.models.shipment import Shipment
from app.services.audit_service import AuditService
from app.services.carrier_account_service import CarrierAccountService
from app.services.carriers.base import CarrierError
from app.services.inventory_service import AlreadyAllocated, InsufficientStock, InventoryService
from app.services.outcome_service import OutcomeExists, record_outcome
from app.services.shipping_settings_service import ShippingSettingsService

logger = logging.getLogger(__name__)

INACTIVE_STATUSES = ("cancelled", "returned", "delivered", "dispatch_failed")
RISK_HOLDS = ("review", "rejected")
STOCK_HOLDS = ("out_of_stock", "unmapped_product", "mixed_source")


class ShipmentActionRefused(ValueError):
    """The requested action is not valid for the shipment's current state."""


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ShippingService:
    def __init__(self, db: Session):
        self.db = db
        self.settings_service = ShippingSettingsService(db)
        self.inventory = InventoryService(db)
        self._quiet = False  # suppress hold notifications while re-allocating at dispatch time

    # ---- helpers ------------------------------------------------------
    def active_shipment(self, order_id: UUID) -> Shipment | None:
        return self.db.query(Shipment).filter(
            Shipment.order_id == order_id, Shipment.status.notin_(INACTIVE_STATUSES)
        ).first()

    @staticmethod
    def confirmation_applies(merchant: Merchant | None) -> bool:
        if merchant is None or not merchant.whatsapp_confirmation_enabled:
            return False
        return "allow" in (merchant.whatsapp_confirmation_decisions or "").split(",")

    def _due(self, store_id: UUID | None, now: datetime | None = None) -> datetime:
        minutes = self.settings_service.get_or_default(store_id).hold_minutes if store_id else 15
        return (now or _now()) + timedelta(minutes=minutes)

    def _hold(self, shipment: Shipment, reason: str) -> None:
        shipment.hold_reason = reason
        shipment.next_attempt_at = None

    @staticmethod
    def _set_meta(shipment: Shipment, **values) -> None:
        meta = {**(shipment.meta or {}), **values}
        shipment.meta = {k: v for k, v in meta.items() if v is not None}

    def _release_stock_hold(self, shipment: Shipment) -> None:
        """The only way to clear a stock hold: never makes an unconfirmed order due."""
        if (shipment.meta or {}).get("needs_confirmation"):
            self._hold(shipment, "awaiting_confirmation")
        else:
            self._release_hold(shipment)

    def _release_hold(self, shipment: Shipment, now: datetime | None = None) -> None:
        shipment.hold_reason = None
        shipment.next_attempt_at = self._due(shipment.store_id, now)

    def _notify(self, shipment: Shipment, kind: str, title: str, message: str, severity: str = "warning") -> None:
        self.db.add(Notification(
            merchant_id=shipment.merchant_id, store_id=shipment.store_id, environment=shipment.environment,
            notification_type=kind, severity=severity, title=title, message=message,
            resource_type="shipment", resource_id=str(shipment.id),
            metadata_json={"shipment_id": str(shipment.id), "order_id": str(shipment.order_id),
                           "status": shipment.status, "hold_reason": shipment.hold_reason},
        ))

    def _notify_hold(self, shipment: Shipment) -> None:
        if shipment.store_id is None or shipment.hold_reason is None:
            return
        if self.settings_service.get_or_default(shipment.store_id).notify_on_hold:
            self._notify(shipment, "shipment.held", "Shipment on hold",
                         f"A shipment is on hold: {shipment.hold_reason}.")

    def _audit(self, shipment: Shipment, action: str, actor_key, extra: dict | None = None) -> None:
        AuditService(self.db).record(
            action=f"shipment.{action}", resource_type="shipment", resource_id=shipment.id,
            merchant_id=shipment.merchant_id, environment=shipment.environment,
            metadata={"actor": str(actor_key) if actor_key is not None else None,
                      "order_id": str(shipment.order_id), **(extra or {})},
        )

    # ---- creation -----------------------------------------------------
    def on_decision(self, order: Order, merchant: Merchant | None, decision: RiskDecision) -> Shipment | None:
        settings = None
        if order.store_id is None:
            has_account = self.db.query(CarrierAccount.id).filter(
                CarrierAccount.merchant_id == order.merchant_id,
                CarrierAccount.environment == order.environment).first()
            if has_account is None:
                return None
        else:
            first = CarrierAccountService(self.db).first_linked_at(order.store_id, order.environment)
            if first is None or _aware(order.created_at) < _aware(first):
                return None
            settings = self.settings_service.get_or_default(order.store_id)
        existing = self.active_shipment(order.id)
        if existing is not None:
            return existing

        now = _now()
        shipment_id = uuid4()
        shipment = Shipment(
            id=shipment_id, merchant_id=order.merchant_id, store_id=order.store_id, order_id=order.id,
            environment=order.environment, status="pending_dispatch", idempotency_key=str(shipment_id),
            cod_amount=order.total_amount, delivery_type=order.delivery_type or "home",
            allocations=[], meta={}, hold_reason=None, next_attempt_at=None,
        )
        reserve = False
        if decision is RiskDecision.REVIEW:
            shipment.hold_reason = "review"
        elif decision is RiskDecision.REJECT:
            shipment.hold_reason = "rejected"
        elif settings is None:
            shipment.hold_reason = "no_store"
        elif self.confirmation_applies(merchant) and settings.dispatch_trigger == "after_confirmation":
            shipment.hold_reason = "awaiting_confirmation"
            reserve = settings.reserve_on_accept
        else:
            shipment.next_attempt_at = now + timedelta(minutes=settings.hold_minutes)
            reserve = settings.reserve_on_accept
        if shipment.hold_reason == "awaiting_confirmation":
            shipment.meta = {"needs_confirmation": True}
        self.db.add(shipment)
        self.db.flush()
        if shipment.hold_reason in RISK_HOLDS or shipment.hold_reason == "no_store":
            self._notify_hold(shipment)
        if reserve:
            self.allocate_and_reserve(shipment)
        return shipment

    # ---- allocation ---------------------------------------------------
    def _wilaya_code(self, order: Order) -> str | None:
        address = order.address_identifier
        return resolve_wilaya(address.wilaya) if address is not None else None

    def _stock_hold(self, shipment: Shipment, reason: str, backorder: bool = False) -> None:
        if shipment.hold_reason in RISK_HOLDS:
            return  # a risk hold is never replaced by a weaker one
        previous = shipment.hold_reason
        self._hold(shipment, reason)
        if backorder:
            shipment.meta = {**(shipment.meta or {}), "backorder": True}
        if previous != reason and not self._quiet:
            self._notify_hold(shipment)

    def _candidate_warehouses(self, account: CarrierAccount, wilaya: str | None) -> list[CarrierWarehouse]:
        rows = self.db.query(CarrierWarehouse).filter(
            CarrierWarehouse.carrier_account_id == account.id, CarrierWarehouse.is_active.is_(True)).all()
        return sorted(rows, key=lambda w: (0 if wilaya and w.wilaya_code == wilaya else 1, w.name))

    def _find_warehouse(self, account: CarrierAccount, wilaya, needs: dict) -> CarrierWarehouse | None:
        for warehouse in self._candidate_warehouses(account, wilaya):
            if all(self.inventory.available(product.id, warehouse.id) >= qty for product, qty in needs.values()):
                return warehouse
        return None

    def allocate_and_reserve(self, shipment: Shipment, account: CarrierAccount | None = None) -> None:
        """Reserve stock. With ``account`` only that carrier's warehouses are considered (no fallback)."""
        if (shipment.meta or {}).get("stock") == "reserved":
            return
        order = self.db.get(Order, shipment.order_id)
        if order is None or not order.items:
            return
        matched, unmatched = self.inventory.match_items(order.store_id, list(order.items))
        if unmatched:
            self._stock_hold(shipment, "unmapped_product")
            return
        fulfillments = {product.fulfillment for _, product in matched}
        if len(fulfillments) > 1:
            self._stock_hold(shipment, "mixed_source")
            return
        needs: dict = {}
        for item, product in matched:
            current = needs.get(product.id, (product, 0))
            needs[product.id] = (product, current[1] + int(item.quantity))

        settings = self.settings_service.get_or_default(order.store_id)
        if account is not None:
            primary, fallback = account, None
        else:
            primary, fallback = self.settings_service.resolve_route(
                order.store_id, order.environment, self._wilaya_code(order))
        if primary is not None:
            shipment.carrier_account_id = primary.id

        if fulfillments == {"merchant"}:
            shipment.fulfillment, shipment.warehouse_id = "merchant", None
            if all(self.inventory.available(p.id, None) >= q for p, q in needs.values()):
                self._reserve(shipment, needs, None)
                self._clear_stock_hold_if_reserved(shipment)
                return
            self._out_of_stock(shipment, settings, None)
            return

        shipment.fulfillment = "carrier"
        wilaya = self._wilaya_code(order)
        warehouse = self._find_warehouse(primary, wilaya, needs) if primary is not None else None
        chosen = primary
        if warehouse is None and settings.out_of_stock_policy == "other_warehouse" and fallback is not None:
            warehouse = self._find_warehouse(fallback, wilaya, needs)
            chosen = fallback
            if warehouse is not None:
                shipment.meta = {**(shipment.meta or {}), "fell_back": True}
        if warehouse is None:
            self._out_of_stock(shipment, settings, primary)
            return
        shipment.carrier_account_id, shipment.warehouse_id = chosen.id, warehouse.id
        self._reserve(shipment, needs, warehouse.id)
        self._clear_stock_hold_if_reserved(shipment)

    def _clear_stock_hold_if_reserved(self, shipment: Shipment) -> None:
        if (shipment.meta or {}).get("stock") == "reserved" and shipment.hold_reason in STOCK_HOLDS:
            self._release_stock_hold(shipment)

    def _reserve(self, shipment: Shipment, needs: dict, warehouse_id) -> None:
        try:
            self.inventory.reserve(shipment, [(p, warehouse_id, q) for p, q in needs.values()])
        except AlreadyAllocated:
            return
        except InsufficientStock:
            self._stock_hold(shipment, "out_of_stock")

    def _out_of_stock(self, shipment: Shipment, settings, primary) -> None:
        shipment.warehouse_id = None
        self._stock_hold(shipment, "out_of_stock", backorder=settings.out_of_stock_policy == "backorder")

    def release_backorders(self, product_ids: set) -> int:
        """Stock arrived: retry allocation of backordered shipments that need these products."""
        store_ids = {sid for (sid,) in self.db.query(Product.store_id).filter(Product.id.in_(product_ids)).all()}
        if not store_ids:
            return 0
        rows = self.db.query(Shipment).filter(
            Shipment.status == "pending_dispatch", Shipment.hold_reason == "out_of_stock",
            Shipment.store_id.in_(store_ids)).order_by(
            Shipment.created_at.asc()).all()
        released = 0
        for shipment in rows:
            if not (shipment.meta or {}).get("backorder"):
                continue
            order = self.db.get(Order, shipment.order_id)
            if order is None or order.store_id is None:
                continue
            matched, _ = self.inventory.match_items(order.store_id, list(order.items))
            if not any(product.id in product_ids for _, product in matched):
                continue
            self.allocate_and_reserve(shipment)
            if shipment.hold_reason != "out_of_stock":
                released += 1
        if released:
            self.db.flush()
        return released

    # ---- confirmation -------------------------------------------------
    def on_confirmed(self, order: Order) -> Shipment | None:
        shipment = self.active_shipment(order.id)
        if shipment is None or shipment.status != "pending_dispatch":
            return shipment
        self._set_meta(shipment, needs_confirmation=None, no_answer=None)
        if shipment.hold_reason in ("awaiting_confirmation", "no_answer"):
            self._release_hold(shipment)
        self.db.flush()
        return shipment

    def on_cancelled(self, order: Order) -> Shipment | None:
        shipment = self.active_shipment(order.id)
        if shipment is None:
            return None
        if shipment.status == "pending_dispatch":
            self._cancel(shipment)
        elif shipment.status == "accepted":
            account = self.db.get(CarrierAccount, shipment.carrier_account_id) if shipment.carrier_account_id else None
            adapter = CarrierAccountService(self.db).adapter_for(account) if account is not None else None
            if adapter is not None and adapter.capabilities.cancel and shipment.tracking_number:
                try:
                    adapter.cancel_shipment(shipment.tracking_number)
                except CarrierError as exc:
                    shipment.last_error = str(exc)[:500]
                    self._notify(shipment, "shipment.cancel_failed", "Shipment cancellation failed",
                                 "The carrier refused to cancel the shipment; cancel it manually.")
                    self.db.flush()
                    return shipment
            else:
                self._notify(shipment, "shipment.cancel_at_carrier_manually", "Cancel the shipment at the carrier",
                             "The order was cancelled but the carrier cannot cancel automatically; cancel it manually.")
            self._cancel(shipment)
        else:
            self._notify(shipment, "shipment.cancel_after_pickup", "Order cancelled after pickup",
                         "The order was cancelled after the carrier picked up the parcel.")
        self.db.flush()
        return shipment

    def _cancel(self, shipment: Shipment) -> None:
        shipment.status = "cancelled"
        shipment.next_attempt_at = None
        self.inventory.release(shipment)

    def expire_unconfirmed(self, now: datetime | None = None) -> int:
        now = now or _now()
        changed = 0
        rows = self.db.query(Shipment).filter(
            Shipment.status == "pending_dispatch",
            Shipment.hold_reason.in_(("awaiting_confirmation", "no_answer") + STOCK_HOLDS)).all()
        for shipment in rows:
            if shipment.store_id is None or not (shipment.meta or {}).get("needs_confirmation"):
                continue
            settings = self.settings_service.get_or_default(shipment.store_id)
            merchant = self.db.get(Merchant, shipment.merchant_id)
            if not self.confirmation_applies(merchant) or settings.dispatch_trigger == "on_allow":
                self._set_meta(shipment, needs_confirmation=None, no_answer=None)
                if shipment.hold_reason in ("awaiting_confirmation", "no_answer"):
                    self._release_hold(shipment, now)
                changed += 1
            elif shipment.hold_reason == "no_answer" or (shipment.meta or {}).get("no_answer"):
                continue
            elif _aware(shipment.created_at) + timedelta(hours=settings.confirmation_timeout_hours) <= now:
                if shipment.hold_reason == "awaiting_confirmation":
                    self._hold(shipment, "no_answer")
                else:
                    self._set_meta(shipment, no_answer=True)
                changed += 1
        if changed:
            self.db.flush()
        return changed

    # ---- merchant actions --------------------------------------------
    def _require_pending(self, shipment: Shipment) -> None:
        if shipment.status != "pending_dispatch":
            raise ShipmentActionRefused(f"Shipment is {shipment.status}")

    def _open_for_dispatch(self, shipment: Shipment, action: str, actor_key) -> Shipment:
        order = self.db.get(Order, shipment.order_id)
        if order is not None and order.status == OrderStatus.CANCELLED:
            raise ShipmentActionRefused("Order is cancelled")
        self._set_meta(shipment, needs_confirmation=None, no_answer=None)
        self._release_hold(shipment)
        self._audit(shipment, action, actor_key)
        self.db.flush()
        if shipment.store_id is not None and self.settings_service.get_or_default(shipment.store_id).reserve_on_accept:
            self.allocate_and_reserve(shipment)
        return shipment

    def approve(self, shipment: Shipment, actor_key) -> Shipment:
        self._require_pending(shipment)
        if shipment.hold_reason not in RISK_HOLDS:
            raise ShipmentActionRefused("Shipment is not held for review")
        return self._open_for_dispatch(shipment, "approve", actor_key)

    REJECT_REASONS = {
        "review": "risk_decision", "rejected": "risk_decision", "no_answer": "unreachable",
        "unmapped_product": "other", "mixed_source": "other", "no_store": "other",
    }

    def reject(self, shipment: Shipment, actor_key) -> Shipment:
        self._require_pending(shipment)
        reason = self.REJECT_REASONS.get(shipment.hold_reason)
        if reason is None:
            raise ShipmentActionRefused("Shipment cannot be rejected in its current state")
        self._cancel(shipment)
        recorded = True
        order = self.db.get(Order, shipment.order_id)
        if order is not None:
            try:
                record_outcome(self.db, order, "cancelled", source="merchant", reason=reason)
            except OutcomeExists:
                recorded = False
        self._audit(shipment, "reject", actor_key, {"outcome_recorded": recorded, "reason": reason})
        self.db.flush()
        return shipment

    def restore(self, shipment: Shipment, actor_key) -> Shipment:
        self._require_pending(shipment)
        order = self.db.get(Order, shipment.order_id)
        if shipment.hold_reason != "rejected" or (order is not None and order.status == OrderStatus.CANCELLED):
            raise ShipmentActionRefused("Only a rejected, uncancelled order can be restored")
        return self._open_for_dispatch(shipment, "restore", actor_key)

    def archive(self, shipment: Shipment, actor_key) -> Shipment:
        self._require_pending(shipment)
        self._cancel(shipment)
        shipment.meta = {**(shipment.meta or {}), "archived": True}
        self._audit(shipment, "archive", actor_key)
        self.db.flush()
        return shipment

    def dispatch_from(self, shipment: Shipment, warehouse_id: UUID, actor_key) -> Shipment:
        if shipment.hold_reason in RISK_HOLDS:
            raise ShipmentActionRefused("Approve the order before dispatching it")
        self._require_pending(shipment)
        order = self.db.get(Order, shipment.order_id)
        warehouse = self.db.get(CarrierWarehouse, warehouse_id)
        if order is None or warehouse is None or order.store_id is None:
            raise ShipmentActionRefused("Warehouse not found")
        primary, fallback = self.settings_service.resolve_route(
            order.store_id, order.environment, self._wilaya_code(order))
        allowed = {a.id for a in (primary, fallback) if a is not None}
        if warehouse.carrier_account_id not in allowed:
            raise ShipmentActionRefused("Warehouse does not belong to this order's carrier route")
        matched, unmatched = self.inventory.match_items(order.store_id, list(order.items))
        if unmatched or any(p.fulfillment != "carrier" for _, p in matched):
            raise ShipmentActionRefused("Order items cannot be fulfilled from a carrier warehouse")
        needs: dict = {}
        for item, product in matched:
            current = needs.get(product.id, (product, 0))
            needs[product.id] = (product, current[1] + int(item.quantity))
        try:
            with self.db.begin_nested():
                self.inventory.release(shipment)
                self.inventory.reserve(shipment, [(p, warehouse.id, q) for p, q in needs.values()])
        except InsufficientStock as exc:
            raise ShipmentActionRefused("Not enough stock in that warehouse") from exc
        shipment.carrier_account_id, shipment.warehouse_id, shipment.fulfillment = (
            warehouse.carrier_account_id, warehouse.id, "carrier")
        shipment.next_attempt_at = _now()
        shipment.hold_reason = None
        self._set_meta(shipment, needs_confirmation=None, no_answer=None)
        self._audit(shipment, "dispatch_from", actor_key, {"warehouse_id": str(warehouse.id)})
        self.db.flush()
        return shipment
