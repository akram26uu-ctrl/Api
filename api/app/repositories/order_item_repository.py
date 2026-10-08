from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select

from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.enums import OrderStatus


class OrderItemRepository:
    def __init__(self, db):
        self.db = db

    def create_many(self, items: list[OrderItem]) -> None:
        self.db.add_all(items)

    def _origins(self, environment: str):
        return ("real",) if environment == "live" else ("test", "synthetic")

    def _base(self, merchant_id: UUID, environment: str, exclude_order_id: UUID | None, since: datetime | None = None):
        statement = (
            select(OrderItem.order_id, func.max(Order.created_at).label("order_created_at"),
                   func.sum(OrderItem.quantity).label("quantity"),
                   func.sum(OrderItem.quantity * OrderItem.unit_price).label("value"))
            .join(Order, Order.id == OrderItem.order_id)
            .where(
                Order.merchant_id == merchant_id,
                Order.environment == environment,
                Order.data_origin.in_(self._origins(environment)),
                Order.status == OrderStatus.DELIVERED,
            )
            .group_by(OrderItem.order_id)
            .order_by(func.max(Order.created_at).desc())
            .limit(500)
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        if since is not None:
            statement = statement.where(Order.created_at >= since)
        return statement


    def sku_quantity_samples(self, merchant_id, environment, sku, exclude_order_id=None, since=None):
        statement = self._base(merchant_id, environment, exclude_order_id, since).where(
            func.lower(func.trim(OrderItem.sku)) == sku.casefold().strip()
        )
        return [int(row.quantity or 0) for row in self.db.execute(statement).all() if row.quantity is not None]

    def sku_value_samples(self, merchant_id, environment, sku, exclude_order_id=None, since=None):
        statement = self._base(merchant_id, environment, exclude_order_id, since).where(
            func.lower(func.trim(OrderItem.sku)) == sku.casefold().strip()
        )
        return [row.value for row in self.db.execute(statement).all() if row.value is not None]

    def category_quantity_samples(self, merchant_id, environment, category, exclude_order_id=None, since=None):
        statement = self._base(merchant_id, environment, exclude_order_id, since).where(
            OrderItem.product_category_normalized == category
        )
        return [int(row.quantity or 0) for row in self.db.execute(statement).all() if row.quantity is not None]

    def category_value_samples(self, merchant_id, environment, category, exclude_order_id=None, since=None):
        statement = self._base(merchant_id, environment, exclude_order_id, since).where(
            OrderItem.product_category_normalized == category
        )
        return [row.value for row in self.db.execute(statement).all() if row.value is not None]

    def merchant_quantity_samples(self, merchant_id, environment, exclude_order_id=None, since=None):
        statement = self._base(merchant_id, environment, exclude_order_id, since)
        return [int(row.quantity or 0) for row in self.db.execute(statement).all() if row.quantity is not None]

    def merchant_value_samples(self, merchant_id, environment, exclude_order_id=None, since=None):
        statement = self._base(merchant_id, environment, exclude_order_id, since)
        return [row.value for row in self.db.execute(statement).all() if row.value is not None]

    def merchant_order_timestamps(self, merchant_id, environment, exclude_order_id=None, since=None, limit=2000):
        statement = (
            select(Order.id, Order.created_at)
            .where(
                Order.merchant_id == merchant_id,
                Order.environment == environment,
                Order.data_origin.in_(self._origins(environment)),
                Order.status == OrderStatus.DELIVERED,
            )
            .order_by(Order.created_at.desc())
            .limit(limit)
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        if since is not None:
            statement = statement.where(Order.created_at >= since)
        return [row.created_at for row in self.db.execute(statement).all() if row.created_at is not None]
