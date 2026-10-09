from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OrderConfirmationAttempt(Base):
    __tablename__ = "order_confirmation_attempts"
    __table_args__ = (
        Index("ix_confirmation_attempts_order_created", "order_id", "created_at"),
        Index("ix_confirmation_attempts_merchant_store", "merchant_id", "store_id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    order_id: Mapped[UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    merchant_id: Mapped[UUID] = mapped_column(ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    store_id: Mapped[UUID | None] = mapped_column(ForeignKey("stores.id", ondelete="SET NULL"), nullable=True)
    api_key_id: Mapped[UUID | None] = mapped_column(ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)
    environment: Mapped[str] = mapped_column(String(10), nullable=False)
    channel: Mapped[str] = mapped_column(String(30), nullable=False)
    outcome: Mapped[str] = mapped_column(String(30), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
