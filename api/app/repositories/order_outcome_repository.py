from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order_outcome import OrderOutcome


class OrderOutcomeRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_order_id(
        self,
        order_id: UUID,
    ) -> OrderOutcome | None:
        statement = select(OrderOutcome).where(
            OrderOutcome.order_id == order_id,
        )

        return self.db.scalar(statement)

    def create(
        self,
        outcome: OrderOutcome,
    ) -> OrderOutcome:
        self.db.add(outcome)
        self.db.flush()

        return outcome