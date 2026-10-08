from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.risk_event import RiskEvent


class RiskEventRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_for_assessment(
        self,
        risk_assessment_id: UUID,
    ) -> list[RiskEvent]:
        statement = (
            select(RiskEvent)
            .where(
                RiskEvent.risk_assessment_id == risk_assessment_id,
            )
            .order_by(RiskEvent.created_at.asc())
        )

        return list(self.db.scalars(statement))

    def create(self, event: RiskEvent) -> RiskEvent:
        self.db.add(event)
        self.db.flush()

        return event