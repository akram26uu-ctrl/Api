from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import RiskDecision


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

    decision: Mapped[RiskDecision] = mapped_column(
        SqlEnum(RiskDecision, name="risk_decision"),
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

    order: Mapped["Order"] = relationship(
        back_populates="risk_assessments",
    )

    events: Mapped[list["RiskEvent"]] = relationship(
        back_populates="risk_assessment",
        cascade="all, delete-orphan",
    )