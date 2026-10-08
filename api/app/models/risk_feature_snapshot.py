from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RiskFeatureSnapshot(Base):
    __tablename__ = "risk_feature_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "risk_assessment_id",
            name="uq_risk_feature_snapshot_assessment",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    risk_assessment_id: Mapped[UUID] = mapped_column(
        ForeignKey("risk_assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    schema_version: Mapped[str] = mapped_column(
        String(50), nullable=False, default="features-v1"
    )
    features: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    risk_assessment: Mapped["RiskAssessment"] = relationship(
        back_populates="feature_snapshot"
    )
