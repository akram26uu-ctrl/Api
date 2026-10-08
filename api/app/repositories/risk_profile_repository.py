from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.risk_profile import RiskProfile


class RiskProfileRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_merchant_id(
        self,
        merchant_id: UUID,
    ) -> RiskProfile | None:
        statement = select(RiskProfile).where(
            RiskProfile.merchant_id == merchant_id,
        )

        return self.db.scalar(statement)

    def create(
        self,
        risk_profile: RiskProfile,
    ) -> RiskProfile:
        self.db.add(risk_profile)
        self.db.flush()

        return risk_profile

    def save(
        self,
        risk_profile: RiskProfile,
    ) -> RiskProfile:
        self.db.add(risk_profile)
        self.db.flush()

        return risk_profile