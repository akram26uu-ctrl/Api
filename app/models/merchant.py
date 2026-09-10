from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SqlEnum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import MerchantStatus
from app.models.order import Order


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

    status: Mapped[MerchantStatus] = mapped_column(
        SqlEnum(
            MerchantStatus,
            name="merchant_status",
            values_callable=lambda enum: [item.value for item in enum],
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