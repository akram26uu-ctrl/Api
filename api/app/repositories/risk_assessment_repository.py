from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.risk_assessment import RiskAssessment


class RiskAssessmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_latest_for_order(
        self,
        order_id: UUID,
    ) -> RiskAssessment | None:
        statement = (
            select(RiskAssessment)
            .where(RiskAssessment.order_id == order_id)
            .order_by(RiskAssessment.created_at.desc())
            .limit(1)
        )

        return self.db.scalar(statement)

    def create(
        self,
        assessment: RiskAssessment,
    ) -> RiskAssessment:
        self.db.add(assessment)
        self.db.flush()

        return assessment