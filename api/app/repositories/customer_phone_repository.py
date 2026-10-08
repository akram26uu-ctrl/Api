from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.customer_phone import CustomerPhone


class CustomerPhoneRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(
        self,
        customer_id: UUID,
        phone_identifier_id: UUID,
    ) -> CustomerPhone | None:
        statement = select(CustomerPhone).where(
            CustomerPhone.customer_id == customer_id,
            CustomerPhone.phone_identifier_id == phone_identifier_id,
        )

        return self.db.scalar(statement)

    def get_customers_for_phone(
        self,
        phone_identifier_id: UUID,
    ) -> list[Customer]:
        statement = (
            select(Customer)
            .join(
                CustomerPhone,
                CustomerPhone.customer_id == Customer.id,
            )
            .where(
                CustomerPhone.phone_identifier_id
                == phone_identifier_id,
            )
        )

        return list(self.db.scalars(statement).all())

    def create(
        self,
        link: CustomerPhone,
    ) -> CustomerPhone:
        self.db.add(link)
        self.db.flush()

        return link