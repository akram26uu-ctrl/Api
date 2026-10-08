from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RiskEvaluation(Base):
    __tablename__ = "risk_evaluations"
    __table_args__ = (
        CheckConstraint(
            "classification IN ('true_positive', 'false_positive', 'true_negative', 'false_negative')",
            name="ck_risk_evaluation_classification",
        ),
        CheckConstraint(
            "environment = 'live'",
            name="ck_risk_evaluation_environment_live",
        ),
        CheckConstraint(
            "data_origin = 'real'",
            name="ck_risk_evaluation_real_data",
        ),
        CheckConstraint(
            "outcome_status IN ('delivered', 'cancelled', 'returned')",
            name="ck_risk_evaluation_outcome_status",
        ),
        Index("ix_risk_evaluations_merchant_created_at", "merchant_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    store_id: Mapped[UUID | None] = mapped_column(ForeignKey("stores.id", ondelete="SET NULL"), nullable=True, index=True)
    merchant_id: Mapped[UUID] = mapped_column(
        ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    risk_assessment_id: Mapped[UUID] = mapped_column(
        ForeignKey("risk_assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    environment: Mapped[str] = mapped_column(String(10), nullable=False, default="live")
    data_origin: Mapped[str] = mapped_column(String(20), nullable=False, default="real")
    predicted_risky: Mapped[bool] = mapped_column(nullable=False)
    actual_bad_outcome: Mapped[bool] = mapped_column(nullable=False)
    outcome_status: Mapped[str] = mapped_column(String(20), nullable=False)
    outcome_occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    classification: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    order: Mapped["Order"] = relationship()
    store: Mapped["Store | None"] = relationship()
    risk_assessment: Mapped["RiskAssessment"] = relationship()
