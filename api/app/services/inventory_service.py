import logging
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Callable
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.models.enums import OrderStatus
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product, ProductCarrierLink, StockDeposit, StockLevel, StockMovement
from app.models.shipment import Shipment
from app.services.carriers.base import CarrierAdapter, StockInfo

def _release_backorders(product_ids: set, db: Session) -> None:
    from app.services.shipping_service import ShippingService
    ShippingService(db).release_backorders(product_ids)


# Called as hook(product_ids, db) after stock goes up; default retries backorders.
on_stock_increased: Callable[[set, Session], None] = _release_backorders

SALES_WINDOW_DAYS = 14
logger = logging.getLogger(__name__)


class InsufficientStock(Exception):
    pass


class AlreadyAllocated(Exception):
    pass


class InventoryService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def normalize_sku(sku: str | None) -> str | None:
        if sku is None:
            return None
        cleaned = re.sub(r"\s+", " ", sku.strip()).casefold()
        return cleaned or None

    # ---- lookup -------------------------------------------------------
    def _products_by_sku(self, store_id: UUID) -> dict[str, Product]:
        result: dict[str, Product] = {}
        for p in self.db.query(Product).filter(Product.store_id == store_id).order_by(Product.created_at.asc()):
            key = self.normalize_sku(p.sku)
            if key and key not in result:
                result[key] = p
        return result

    def find_by_sku(self, store_id: UUID, sku: str | None) -> Product | None:
        key = self.normalize_sku(sku)
        return self._products_by_sku(store_id).get(key) if key else None

    def match_items(self, store_id: UUID, items: list[OrderItem]) -> tuple[list[tuple[OrderItem, Product]], list[OrderItem]]:
        by_sku = self._products_by_sku(store_id)
        matched, unmatched = [], []
        for item in items:
            product = by_sku.get(self.normalize_sku(item.sku) or "")
            (matched if product is not None else unmatched).append((item, product) if product is not None else item)
        return matched, unmatched

    def _level_query(self, product_id: UUID, warehouse_id: UUID | None):
        query = self.db.query(StockLevel).filter(StockLevel.product_id == product_id)
        return query.filter(StockLevel.warehouse_id.is_(None)) if warehouse_id is None else query.filter(
            StockLevel.warehouse_id == warehouse_id)

    def _level(self, product_id: UUID, warehouse_id: UUID | None, create: bool = False) -> StockLevel | None:
        level = self._level_query(product_id, warehouse_id).with_for_update().first()
        if level is None and create:
            level = StockLevel(product_id=product_id, warehouse_id=warehouse_id, on_hand=0, reserved=0, inbound=0)
            self.db.add(level)
            self.db.flush()
        return level

    def available(self, product_id: UUID, warehouse_id: UUID | None, lock: bool = True) -> int:
        """``lock=False`` for read paths (GET endpoints): no row lock is taken."""
        if lock:
            level = self._level(product_id, warehouse_id)
            return 0 if level is None else level.on_hand - level.reserved
        row = self._level_query(product_id, warehouse_id).with_entities(
            StockLevel.on_hand, StockLevel.reserved).first()
        return 0 if row is None else row[0] - row[1]

    def is_tracked(self, product_id: UUID, warehouse_id: UUID | None) -> bool:
        """Merchant-location stock is tracked only when its StockLevel row exists."""
        return self._level_query(product_id, warehouse_id).with_entities(StockLevel.id).first() is not None

    def _move(self, product_id, warehouse_id, delta, reason, shipment_id=None, deposit_id=None) -> None:
        self.db.add(StockMovement(product_id=product_id, warehouse_id=warehouse_id, delta=delta, reason=reason,
                                  shipment_id=shipment_id, deposit_id=deposit_id))

    # ---- carrier import -----------------------------------------------
    def import_carrier_stock(self, account: CarrierAccount, stock: list[StockInfo]) -> None:
        self.db.flush()  # sessions here do not autoflush; warehouses may be pending
        warehouses = {w.external_id: w for w in self.db.query(CarrierWarehouse).filter(
            CarrierWarehouse.carrier_account_id == account.id)}
        links = {l.external_product_id: l for l in self.db.query(ProductCarrierLink).filter(
            ProductCarrierLink.carrier_account_id == account.id)}
        by_sku = self._products_by_sku(account.store_id)
        increased: set = set()
        for info in stock:
            warehouse = warehouses.get(info.warehouse_external_id)
            if warehouse is None:
                continue
            link = links.get(info.external_product_id)
            key = self.normalize_sku(info.sku)
            product = self.db.get(Product, link.product_id) if link else None
            if product is None and key:
                product = by_sku.get(key)
            if product is None:
                product = Product(merchant_id=account.merchant_id, store_id=account.store_id,
                                  sku=(info.sku or info.external_product_id).strip(), name=info.name,
                                  fulfillment="carrier")
                self.db.add(product)
                self.db.flush()
                if key:
                    by_sku[key] = product
            elif product.fulfillment != "carrier":
                product.fulfillment = "carrier"
            if link is None:
                link = ProductCarrierLink(product_id=product.id, carrier_account_id=account.id,
                                          external_product_id=info.external_product_id)
                self.db.add(link)
                links[info.external_product_id] = link
            level = self._level(product.id, warehouse.id, create=True)
            new_on_hand = max(info.on_hand, level.reserved)
            delta = new_on_hand - level.on_hand
            if delta:
                level.on_hand = new_on_hand
                self._move(product.id, warehouse.id, delta, "sync")
                if delta > 0:
                    increased.add(product.id)
        self.db.flush()
        if increased:
            on_stock_increased(increased, self.db)

    def refresh_store(self, store_id: UUID, environment: str, adapter_for: Callable[[CarrierAccount], CarrierAdapter]) -> None:
        from app.services.carriers.base import CarrierError
        accounts = self.db.query(CarrierAccount).filter(
            CarrierAccount.store_id == store_id, CarrierAccount.environment == environment,
            CarrierAccount.status == "active").all()
        for account in accounts:
            try:
                self.import_carrier_stock(account, adapter_for(account).list_stock())
            except CarrierError as exc:
                self._stock_error(account, exc)

    def _stock_error(self, account: CarrierAccount, exc: Exception) -> None:
        logger.warning("carrier stock import failed for account %s: %s", account.id, exc)
        account.last_error = str(exc)[:500]
        self.db.flush()

    def import_for_account(self, account: CarrierAccount, adapter: CarrierAdapter) -> None:
        from app.services.carriers.base import CarrierError
        try:
            stock = adapter.list_stock()
        except CarrierError as exc:
            self._stock_error(account, exc)
            return
        self.import_carrier_stock(account, stock)

    # ---- reservations -------------------------------------------------
    @staticmethod
    def _stock_state(shipment: Shipment) -> str | None:
        return (shipment.meta or {}).get("stock")

    @staticmethod
    def _set_state(shipment: Shipment, state: str) -> None:
        shipment.meta = {**(shipment.meta or {}), "stock": state}

    def reserve(self, shipment: Shipment, allocations: list[tuple[Product, UUID | None, int]]) -> None:
        if self._stock_state(shipment) in ("reserved", "consumed"):
            raise AlreadyAllocated(str(shipment.id))
        merged: dict[tuple, int] = defaultdict(int)
        for product, warehouse_id, qty in allocations:
            if warehouse_id is None and shipment.environment == "test":
                continue  # TEST shipments never reserve merchant-location stock
            merged[(product.id, warehouse_id)] += int(qty)
        for (product_id, warehouse_id), qty in merged.items():
            level = self._level(product_id, warehouse_id)
            if level is None or level.on_hand - level.reserved < qty:
                raise InsufficientStock(str(product_id))
        for (product_id, warehouse_id), qty in merged.items():
            self._level(product_id, warehouse_id).reserved += qty
        shipment.allocations = [
            {"product_id": str(pid), "warehouse_id": str(wid) if wid else None, "quantity": qty}
            for (pid, wid), qty in merged.items()
        ]
        self._set_state(shipment, "reserved")
        self.db.flush()

    @staticmethod
    def _parsed(shipment: Shipment):
        for a in shipment.allocations or []:
            warehouse_id = UUID(a["warehouse_id"]) if a.get("warehouse_id") else None
            if warehouse_id is None and shipment.environment == "test":
                continue  # TEST shipments never move merchant-location stock
            yield UUID(a["product_id"]), warehouse_id, int(a["quantity"])

    def release(self, shipment: Shipment) -> None:
        if self._stock_state(shipment) != "reserved":
            return
        for product_id, warehouse_id, qty in self._parsed(shipment):
            level = self._level(product_id, warehouse_id)
            if level is not None:
                level.reserved = max(0, level.reserved - qty)
        self._set_state(shipment, "released")
        self.db.flush()

    def consume(self, shipment: Shipment) -> None:
        if self._stock_state(shipment) != "reserved":
            return
        for product_id, warehouse_id, qty in self._parsed(shipment):
            level = self._level(product_id, warehouse_id)
            if level is None:
                continue
            level.reserved = max(0, level.reserved - qty)
            level.on_hand = max(level.reserved, level.on_hand - qty)
            self._move(product_id, warehouse_id, -qty, "shipment", shipment_id=shipment.id)
        self._set_state(shipment, "consumed")
        self.db.flush()

    def restock(self, shipment: Shipment) -> None:
        if self._stock_state(shipment) != "consumed":
            return
        increased: set = set()
        for product_id, warehouse_id, qty in self._parsed(shipment):
            self._level(product_id, warehouse_id, create=True).on_hand += qty
            self._move(product_id, warehouse_id, qty, "return", shipment_id=shipment.id)
            increased.add(product_id)
        self._set_state(shipment, "restocked")
        self.db.flush()
        if increased:
            on_stock_increased(increased, self.db)

    # ---- low stock ------------------------------------------------------
    def total_available(self, product_id: UUID) -> int:
        row = self.db.query(func.coalesce(func.sum(StockLevel.on_hand - StockLevel.reserved), 0)).filter(
            StockLevel.product_id == product_id).scalar()
        return int(row or 0)

    def daily_averages(self, store_id: UUID) -> dict[str, float]:
        since = datetime.now(timezone.utc) - timedelta(days=SALES_WINDOW_DAYS)
        rows = self.db.query(OrderItem.sku, OrderItem.quantity).join(Order, Order.id == OrderItem.order_id).filter(
            Order.store_id == store_id, Order.created_at >= since,
            Order.status.in_([OrderStatus.SHIPPED, OrderStatus.DELIVERED])).all()
        totals: dict[str, int] = defaultdict(int)
        for sku, qty in rows:
            key = self.normalize_sku(sku)
            if key:
                totals[key] += qty
        return {k: v / SALES_WINDOW_DAYS for k, v in totals.items()}

    def is_low(self, product: Product, averages: dict[str, float] | None = None) -> bool:
        from app.services.shipping_settings_service import ShippingSettingsService
        if averages is None:
            averages = self.daily_averages(product.store_id)
        avg = averages.get(self.normalize_sku(product.sku) or "", 0)
        if avg <= 0:
            return False
        available = self.total_available(product.id)
        if available <= 0:
            return False
        days = ShippingSettingsService(self.db).get_or_default(product.store_id).low_stock_days
        return available / avg < days

    # ---- deposits -------------------------------------------------------
    def receive_deposit(self, deposit: StockDeposit) -> None:
        # Lock and refresh the row so a concurrent receive sees the final status.
        self.db.query(StockDeposit).filter(StockDeposit.id == deposit.id).with_for_update().populate_existing().first()
        if deposit.status == "received":
            return
        if deposit.warehouse_id is None:
            raise ValueError("warehouse_required")  # deposits only credit a carrier warehouse
        account = self.db.get(CarrierAccount, deposit.carrier_account_id)
        increased: set = set()
        for line in deposit.lines or []:
            qty = int(line.get("quantity") or 0)
            if qty <= 0:
                continue
            product = self.find_by_sku(account.store_id, line.get("sku"))
            if product is None:
                sku = (line.get("sku") or "").strip()
                product = Product(merchant_id=account.merchant_id, store_id=account.store_id, sku=sku, name=sku,
                                  fulfillment="carrier")
                self.db.add(product)
                self.db.flush()
            self._level(product.id, deposit.warehouse_id, create=True).on_hand += qty
            self._move(product.id, deposit.warehouse_id, qty, "deposit", deposit_id=deposit.id)
            increased.add(product.id)
        deposit.status = "received"
        self.db.flush()
        if increased:
            on_stock_increased(increased, self.db)

