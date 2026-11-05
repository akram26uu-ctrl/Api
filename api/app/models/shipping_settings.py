from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ShippingSettings(Base):
    """Per-store shipping behaviour (1:1 with the store)."""

    __tablename__ = "shipping_settings"
    __table_args__ = (
        CheckConstraint("dispatch_trigger IN ('after_confirmation', 'on_allow')", name="ck_shipping_settings_trigger"),
        CheckConstraint(
            "out_of_stock_policy IN ('hold', 'backorder', 'other_warehouse')", name="ck_shipping_settings_oos_policy"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id: Mapped[UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, unique=True)
    auto_dispatch: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    dispatch_trigger: Mapped[str] = mapped_column(String(30), nullable=False, default="after_confirmation")
    hold_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    confirmation_timeout_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    retry_max: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    retry_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    fallback_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    out_of_stock_policy: Mapped[str] = mapped_column(String(20), nullable=False, default="hold")
    low_stock_days: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    reserve_on_accept: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    disable_product_when_out: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pickup_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    pickup_wilaya: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pickup_commune: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pickup_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    label_size: Mapped[str] = mapped_column(String(10), nullable=False, default="A6")
    notify_on_hold: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_on_failure: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_on_low_stock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ShippingRoute(Base):
    """Maps wilayas to a carrier (with optional fallback). Empty
    wilaya_codes is the store's default route."""

    __tablename__ = "shipping_routes"
    __table_args__ = (Index("ix_shipping_routes_store_priority", "store_id", "priority"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id: Mapped[UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    wilaya_codes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    carrier_account_id: Mapped[UUID] = mapped_column(ForeignKey("carrier_accounts.id", ondelete="CASCADE"), nullable=False)
    fallback_carrier_account_id: Mapped[UUID | None] = mapped_column(ForeignKey("carrier_accounts.id", ondelete="SET NULL"), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
