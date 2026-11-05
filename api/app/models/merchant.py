from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import MerchantStatus
from app.models.order import Order


def _quota_period_default() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )

    primary_business_category: Mapped[str] = mapped_column(
        String(100), nullable=False, default="other", server_default="other", index=True
    )
    secondary_business_categories: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )

    plan_code: Mapped[str] = mapped_column(
        String(50), nullable=False, default="free", server_default="free", index=True
    )

    monthly_order_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1000, server_default="1000"
    )

    quota_period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_quota_period_default, server_default=func.date_trunc("month", func.now())
    )

    beta_access: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Shadow mode: True = observe-only (rejections are logged as review),
    # False = active blocking. Persisted by migration c6e1a9f3b8d4.
    is_shadow_mode_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Automatic WhatsApp order confirmation (Ordium-managed number). Off by default.
    whatsapp_confirmation_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Comma-separated risk decisions that trigger a confirmation message.
    whatsapp_confirmation_decisions: Mapped[str] = mapped_column(
        String(50), nullable=False, default="allow,review", server_default="allow,review"
    )
    # When true, a customer's button reply moves the order to CONFIRMED/CANCELLED.
    whatsapp_auto_update_status: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    status: Mapped[MerchantStatus] = mapped_column(
        SqlEnum(
            MerchantStatus,
            name="merchant_status",
            values_callable=lambda enum: [
                item.value for item in enum
            ],
        ),
        nullable=False,
        default=MerchantStatus.PENDING,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    api_keys: Mapped[list["ApiKey"]] = relationship(
        back_populates="merchant",
        cascade="all, delete-orphan",
    )

    orders: Mapped[list["Order"]] = relationship(
        back_populates="merchant",
    )

    customer_links: Mapped[list["MerchantCustomer"]] = relationship(
        back_populates="merchant",
        cascade="all, delete-orphan",
    )

    risk_profile: Mapped["RiskProfile | None"] = relationship(
        back_populates="merchant",
        uselist=False,
        cascade="all, delete-orphan",
    )
