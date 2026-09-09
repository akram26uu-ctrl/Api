from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AddressIdentifier(Base):
    __tablename__ = "address_identifiers"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    normalized_address: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        index=True,
    )

    wilaya: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    commune: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    address_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
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

    orders: Mapped[list["Order"]] = relationship(
        back_populates="address_identifier",
    )