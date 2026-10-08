from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ApiKey(Base):
    __tablename__ = "api_keys"
    __table_args__ = (
        CheckConstraint(
            "environment IN ('live', 'test')",
            name="ck_api_key_environment",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    merchant_id: Mapped[UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    store_id: Mapped[UUID | None] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=True, index=True)
    # customer = merchant-managed integration credential; system = internal platform credential
    key_kind: Mapped[str] = mapped_column(String(20), nullable=False, default="customer", index=True)
    key_hash: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True
    )
    environment: Mapped[str] = mapped_column(
        String(10), nullable=False, default="live", index=True
    )
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scopes: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=lambda: [
            "orders:write",
            "outcomes:write",
        ]
    )

    merchant: Mapped["Merchant"] = relationship(back_populates="api_keys")
    store: Mapped["Store | None"] = relationship(back_populates="api_keys")
    idempotency_records: Mapped[list["IdempotencyRecord"]] = relationship(
        back_populates="api_key"
    )
