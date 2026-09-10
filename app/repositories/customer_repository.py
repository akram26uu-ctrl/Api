from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer


class CustomerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, customer_id: UUID) -> Customer | None:
        statement = select(Customer).where(
            Customer.id == customer_id,
        )

        return self.db.scalar(statement)

    def get_by_normalized_name(
        self,
        normalized_name: str,
    ) -> Customer | None:
        statement = select(Customer).where(
            Customer.normalized_name == normalized_name,
        )

        return self.db.scalar(statement)

    def create(self, customer: Customer) -> Customer:
        self.db.add(customer)
        self.db.flush()

        return customer