from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, JSON, Float, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import RiskDecision


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    __table_args__ = (
        CheckConstraint(
            "score >= 0 AND score <= 100",
            name="ck_risk_assessment_score_range",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    order_id: Mapped[UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    decision: Mapped[RiskDecision] = mapped_column(
        SqlEnum(
            RiskDecision,
            name="risk_decision",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
        index=True,
    )
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    rules_version: Mapped[str] = mapped_column(String(100), nullable=False)
    risk_profile_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    execution_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    identity_confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    identity_match_reasons: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )

    order: Mapped["Order"] = relationship(back_populates="risk_assessments")
    events: Mapped[list["RiskEvent"]] = relationship(
        back_populates="risk_assessment", cascade="all, delete-orphan"
    )
    feature_snapshot: Mapped["RiskFeatureSnapshot | None"] = relationship(
        back_populates="risk_assessment",
        uselist=False,
        cascade="all, delete-orphan",
    )
