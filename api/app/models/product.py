from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("store_id", "sku", name="uq_products_store_sku"),
        CheckConstraint("fulfillment IN ('carrier', 'merchant')", name="ck_products_fulfillment"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id: Mapped[UUID | None] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=True, index=True)
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    fulfillment: Mapped[str] = mapped_column(String(20), nullable=False, default="merchant")
    weight_grams: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ProductCarrierLink(Base):
    __tablename__ = "product_carrier_links"
    __table_args__ = (
        UniqueConstraint("product_id", "carrier_account_id", name="uq_product_carrier_links"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    carrier_account_id: Mapped[UUID] = mapped_column(ForeignKey("carrier_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    external_product_id: Mapped[str] = mapped_column(String(100), nullable=False)


class StockLevel(Base):
    """Stock of a product at a carrier warehouse; warehouse_id NULL means the
    merchant's own location."""

    __tablename__ = "stock_levels"
    __table_args__ = (
        UniqueConstraint("product_id", "warehouse_id", name="uq_stock_levels_product_warehouse"),
        Index(
            "uq_stock_levels_product_merchant_location", "product_id", unique=True,
            postgresql_where=text("warehouse_id IS NULL"), sqlite_where=text("warehouse_id IS NULL"),
        ),
        CheckConstraint("on_hand >= 0 AND reserved >= 0 AND inbound >= 0", name="ck_stock_levels_non_negative"),
        CheckConstraint("reserved <= on_hand", name="ck_stock_levels_reserved_le_on_hand"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id: Mapped[UUID | None] = mapped_column(ForeignKey("carrier_warehouses.id", ondelete="CASCADE"), nullable=True)
    on_hand: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reserved: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    inbound: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class StockDeposit(Base):
    __tablename__ = "stock_deposits"
    __table_args__ = (
        CheckConstraint("status IN ('in_transit', 'counting', 'received')", name="ck_stock_deposits_status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    carrier_account_id: Mapped[UUID] = mapped_column(ForeignKey("carrier_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id: Mapped[UUID | None] = mapped_column(ForeignKey("carrier_warehouses.id", ondelete="SET NULL"), nullable=True)
    reference: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="in_transit")
    # [{"sku": str, "quantity": int}]
    lines: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class StockMovement(Base):
    """Append-only ledger; rows are never updated."""

    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint(
            "reason IN ('shipment', 'return', 'deposit', 'adjustment', 'sync')", name="ck_stock_movements_reason"
        ),
        Index("ix_stock_movements_product_occurred", "product_id", "occurred_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    warehouse_id: Mapped[UUID | None] = mapped_column(ForeignKey("carrier_warehouses.id", ondelete="SET NULL"), nullable=True)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(20), nullable=False)
    shipment_id: Mapped[UUID | None] = mapped_column(ForeignKey("shipments.id", ondelete="SET NULL"), nullable=True, index=True)
    deposit_id: Mapped[UUID | None] = mapped_column(ForeignKey("stock_deposits.id", ondelete="SET NULL"), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
