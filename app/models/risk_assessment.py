from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    order_id: Mapped[UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    decision: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    model_version: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )