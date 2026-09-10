from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order import Order


class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, order_id: UUID) -> Order | None:
        statement = select(Order).where(Order.id == order_id)

        return self.db.scalar(statement)

    def get_by_external_id(
        self,
        merchant_id: UUID,
        external_order_id: str,
    ) -> Order | None:
        statement = select(Order).where(
            Order.merchant_id == merchant_id,
            Order.external_order_id == external_order_id,
        )

        return self.db.scalar(statement)

    def create(self, order: Order) -> Order:
        self.db.add(order)
        self.db.flush()

        return order