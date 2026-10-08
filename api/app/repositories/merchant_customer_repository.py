from uuid import UUID

from sqlalchemy import select
from app.models.customer import Customer
from app.models.customer_phone import CustomerPhone
from sqlalchemy.orm import Session

from app.models.merchant_customer import MerchantCustomer


class MerchantCustomerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(
        self,
        merchant_id: UUID,
        customer_id: UUID,
    ) -> MerchantCustomer | None:
        statement = select(MerchantCustomer).where(
            MerchantCustomer.merchant_id == merchant_id,
            MerchantCustomer.customer_id == customer_id,
        )

        return self.db.scalar(statement)


    def get_customer_by_phone_and_name(
        self,
        merchant_id: UUID,
        phone_identifier_id: UUID,
        normalized_name: str,
    ) -> Customer | None:
        statement = (
            select(Customer)
            .join(MerchantCustomer, MerchantCustomer.customer_id == Customer.id)
            .join(CustomerPhone, CustomerPhone.customer_id == Customer.id)
            .where(
                MerchantCustomer.merchant_id == merchant_id,
                CustomerPhone.phone_identifier_id == phone_identifier_id,
                Customer.normalized_name == normalized_name,
            )
            .limit(1)
        )
        return self.db.scalar(statement)

    def create(self, link: MerchantCustomer) -> MerchantCustomer:
        self.db.add(link)
        self.db.flush()

        return link