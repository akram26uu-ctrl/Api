from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import RiskEventType


class RiskEvent(Base):
    __tablename__ = "risk_events"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    risk_assessment_id: Mapped[UUID] = mapped_column(
        ForeignKey("risk_assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[RiskEventType] = mapped_column(
        SqlEnum(RiskEventType, name="risk_event_type"),
        nullable=False,
        index=True,
    )

    score_impact: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    event_data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    risk_assessment: Mapped["RiskAssessment"] = relationship(
        back_populates="events",
    )