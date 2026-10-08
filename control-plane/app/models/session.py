from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import DateTime, ForeignKey, String, LargeBinary, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class Session(Base):
    __tablename__ = "web_sessions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ordium_api_key_id: Mapped[UUID | None] = mapped_column(index=True)
    ordium_live_api_key_id: Mapped[UUID | None] = mapped_column(index=True)
    ordium_api_key_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)
    ordium_live_api_key_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary)

    user = relationship("User", back_populates="sessions")
