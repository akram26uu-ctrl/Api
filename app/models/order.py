from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import OrderStatus


class Order(Base):
    __tablename__ = "orders"

    __table_args__ = (
        UniqueConstraint(
            "merchant_id",
            "external_order_id",
            name="uq_order_merchant_external_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    merchant_id: Mapped[UUID] = mapped_column(
        ForeignKey("merchants.id"),
        nullable=False,
        index=True,
)

    customer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    phone_identifier_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("phone_identifiers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    device_identifier_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("device_identifiers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    address_identifier_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("address_identifiers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    external_order_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    status: Mapped[OrderStatus] = mapped_column(
        SqlEnum(
            OrderStatus,
            name="order_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
        default=OrderStatus.PENDING,
        index=True,
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="DZD",
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        index=True,
    )

    user_agent: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="api",
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    merchant: Mapped["Merchant"] = relationship(
        back_populates="orders",
    )

    customer: Mapped["Customer | None"] = relationship(
        back_populates="orders",
    )

    phone_identifier: Mapped["PhoneIdentifier | None"] = relationship(
        back_populates="orders",
    )

    device_identifier: Mapped["DeviceIdentifier | None"] = relationship(
        back_populates="orders",
    )

    address_identifier: Mapped["AddressIdentifier | None"] = relationship(
        back_populates="orders",
    )

    risk_assessments: Mapped[list["RiskAssessment"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )