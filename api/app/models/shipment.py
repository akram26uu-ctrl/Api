from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func, text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

_ACTIVE_WHERE = text("status NOT IN ('cancelled','returned','delivered','dispatch_failed')")


class Shipment(Base):
    __tablename__ = "shipments"
    __table_args__ = (
        Index(
            "uq_shipments_order_active", "order_id", unique=True,
            postgresql_where=_ACTIVE_WHERE, sqlite_where=_ACTIVE_WHERE,
        ),
        CheckConstraint("environment IN ('live', 'test')", name="ck_shipments_environment"),
        CheckConstraint("fulfillment IN ('carrier', 'merchant')", name="ck_shipments_fulfillment"),
        CheckConstraint("delivery_type IN ('home', 'stop_desk')", name="ck_shipments_delivery_type"),
        Index("ix_shipments_status_next_attempt", "status", "next_attempt_at"),
        Index("ix_shipments_tracking_number", "tracking_number"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id: Mapped[UUID | None] = mapped_column(ForeignKey("stores.id", ondelete="SET NULL"), nullable=True, index=True)
    order_id: Mapped[UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    environment: Mapped[str] = mapped_column(String(10), nullable=False, default="test")
    carrier_account_id: Mapped[UUID | None] = mapped_column(ForeignKey("carrier_accounts.id", ondelete="SET NULL"), nullable=True)
    # NULL warehouse means the shipment leaves from the merchant.
    warehouse_id: Mapped[UUID | None] = mapped_column(ForeignKey("carrier_warehouses.id", ondelete="SET NULL"), nullable=True)
    fulfillment: Mapped[str] = mapped_column(String(20), nullable=False, default="carrier")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending_dispatch")
    hold_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    label_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    cod_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    delivery_type: Mapped[str] = mapped_column(String(20), nullable=False, default="home")
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    # [{"product_id": str, "warehouse_id": str|None, "quantity": int}]
    allocations: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # {"backorder": bool, "fell_back": bool}
    meta: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ShipmentEvent(Base):
    __tablename__ = "shipment_events"
    __table_args__ = (
        CheckConstraint("source IN ('webhook', 'poll', 'manual')", name="ck_shipment_events_source"),
        Index("uq_shipment_events_dedupe_key", "dedupe_key", unique=True),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    shipment_id: Mapped[UUID] = mapped_column(ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    raw_status: Mapped[str | None] = mapped_column(String(200), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="webhook")
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False)
