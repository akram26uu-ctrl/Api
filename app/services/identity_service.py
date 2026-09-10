from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.customer_phone import CustomerPhone
from app.models.merchant_customer import MerchantCustomer
from app.models.phone_identifier import PhoneIdentifier
from app.repositories.customer_repository import CustomerRepository
from app.repositories.phone_identifier_repository import PhoneIdentifierRepository


@dataclass
class IdentityResult:
    customer: Customer
    phone_identifier: PhoneIdentifier
    is_new_customer: bool
    is_new_phone: bool


class IdentityService:
    def __init__(self, db: Session):
        self.db = db

        self.customer_repository = CustomerRepository(db)
        self.phone_repository = PhoneIdentifierRepository(db)

    def resolve_customer(
        self,
        merchant_id: UUID,
        first_name: str,
        last_name: str,
        phone: str,
    ) -> IdentityResult:

        normalized_name = self._normalize_name(
            first_name,
            last_name,
        )

        phone_identifier = self.phone_repository.get_by_phone(phone)

        is_new_phone = phone_identifier is None

        if phone_identifier is None:
            phone_identifier = PhoneIdentifier(
                phone=phone,
            )

            self.phone_repository.create(phone_identifier)

        customer = self.customer_repository.get_by_normalized_name(
            normalized_name,
        )

        is_new_customer = customer is None

        if customer is None:
            customer = Customer(
                first_name=first_name,
                last_name=last_name,
                normalized_name=normalized_name,
            )

            self.customer_repository.create(customer)

        customer_phone = CustomerPhone(
            customer_id=customer.id,
            phone_identifier_id=phone_identifier.id,
        )

        self.db.add(customer_phone)

        merchant_customer = MerchantCustomer(
            merchant_id=merchant_id,
            customer_id=customer.id,
        )

        self.db.add(merchant_customer)

        self.db.flush()

        return IdentityResult(
            customer=customer,
            phone_identifier=phone_identifier,
            is_new_customer=is_new_customer,
            is_new_phone=is_new_phone,
        )

    @staticmethod
    def _normalize_name(
        first_name: str,
        last_name: str,
    ) -> str:
        return " ".join(
            f"{first_name} {last_name}".lower().split()
        )