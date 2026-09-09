from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CustomerPhone(Base):
    __tablename__ = "customer_phones"

    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        primary_key=True,
    )

    phone_identifier_id: Mapped[UUID] = mapped_column(
        ForeignKey("phone_identifiers.id", ondelete="CASCADE"),
        primary_key=True,
    )

    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    customer: Mapped["Customer"] = relationship(
        back_populates="phone_links",
    )

    phone_identifier: Mapped["PhoneIdentifier"] = relationship(
        back_populates="customer_links",
    )