from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CarrierAccount(Base):
    """A merchant store's connection to a delivery carrier. Credentials are
    stored encrypted (Fernet, same scheme as webhook secrets)."""

    __tablename__ = "carrier_accounts"
    __table_args__ = (
        CheckConstraint("environment IN ('live', 'test')", name="ck_carrier_account_environment"),
        CheckConstraint("status IN ('active', 'error', 'disabled')", name="ck_carrier_account_status"),
        Index("ix_carrier_accounts_store_env", "store_id", "environment"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    store_id: Mapped[UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    environment: Mapped[str] = mapped_column(String(10), nullable=False, default="test")
    carrier_code: Mapped[str] = mapped_column(String(40), nullable=False)
    display_name: Mapped[str] = mapped_column(String(150), nullable=False)
    credentials_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
