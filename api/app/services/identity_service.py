from dataclasses import dataclass
import re
import unicodedata
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.customer_phone import CustomerPhone
from app.models.merchant_customer import MerchantCustomer
from app.models.phone_identifier import PhoneIdentifier
from app.repositories.customer_phone_repository import (
    CustomerPhoneRepository,
)
from app.repositories.customer_repository import CustomerRepository
from app.repositories.merchant_customer_repository import (
    MerchantCustomerRepository,
)
from app.repositories.phone_identifier_repository import (
    PhoneIdentifierRepository,
)
from app.services.identity_confidence import calculate_identity_confidence


@dataclass
class IdentityResult:
    customer: Customer
    phone_identifier: PhoneIdentifier
    is_new_customer: bool
    is_new_phone: bool
    confidence: int
    match_reasons: tuple[str, ...]


class IdentityService:
    def __init__(self, db: Session):
        self.db = db

        self.customer_repository = CustomerRepository(db)
        self.phone_repository = PhoneIdentifierRepository(db)
        self.customer_phone_repository = CustomerPhoneRepository(db)
        self.merchant_customer_repository = (
            MerchantCustomerRepository(db)
        )

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

        # ---------------------------------------------------------
        # 1. Find or create PhoneIdentifier
        # ---------------------------------------------------------
        phone_identifier = self.phone_repository.get_by_phone(
            phone,
        )

        is_new_phone = phone_identifier is None

        if phone_identifier is None:
            phone_identifier = PhoneIdentifier(
                phone=phone,
            )

            self.phone_repository.create(
                phone_identifier,
            )

        # ---------------------------------------------------------
        # 2. Find customers already linked to this phone
        # ---------------------------------------------------------
        # Identity resolution is merchant-scoped. Cross-merchant reputation is
        # handled separately by the global reputation layer; it must not cause
        # customer records to be silently shared between merchants.
        customer = self.merchant_customer_repository.get_customer_by_phone_and_name(
            merchant_id=merchant_id,
            phone_identifier_id=phone_identifier.id,
            normalized_name=normalized_name,
        )

        is_new_customer = customer is None

        # ---------------------------------------------------------
        # 4. If no exact match, create a new customer
        # ---------------------------------------------------------
        if customer is None:
            customer = Customer(
                first_name=first_name,
                last_name=last_name,
                normalized_name=normalized_name,
            )

            self.customer_repository.create(
                customer,
            )

        # ---------------------------------------------------------
        # 5. Ensure Customer ↔ Phone relationship exists
        # ---------------------------------------------------------
        customer_phone = (
            self.customer_phone_repository.get(
                customer_id=customer.id,
                phone_identifier_id=phone_identifier.id,
            )
        )

        if customer_phone is None:
            customer_phone = CustomerPhone(
                customer_id=customer.id,
                phone_identifier_id=phone_identifier.id,
            )

            self.customer_phone_repository.create(
                customer_phone,
            )

        # ---------------------------------------------------------
        # 6. Ensure Merchant ↔ Customer relationship exists
        # ---------------------------------------------------------
        merchant_customer = (
            self.merchant_customer_repository.get(
                merchant_id=merchant_id,
                customer_id=customer.id,
            )
        )

        if merchant_customer is None:
            merchant_customer = MerchantCustomer(
                merchant_id=merchant_id,
                customer_id=customer.id,
            )

            self.merchant_customer_repository.create(
                merchant_customer,
            )

        confidence = calculate_identity_confidence(
            existing_customer=not is_new_customer,
            exact_phone=not is_new_phone,
            # Name equality is evidence only when the customer was found in
            # historical merchant-scoped data. A newly created row is not a
            # historical match.
            exact_name=(not is_new_customer) and customer.normalized_name == normalized_name,
        )

        self.db.flush()

        return IdentityResult(
            customer=customer,
            phone_identifier=phone_identifier,
            is_new_customer=is_new_customer,
            is_new_phone=is_new_phone,
            confidence=confidence.score,
            match_reasons=confidence.reasons,
        )

    @staticmethod
    def _normalize_name(
        first_name: str,
        last_name: str,
    ) -> str:
        value = unicodedata.normalize("NFKD", f"{first_name} {last_name}").casefold()
        value = "".join(ch for ch in value if not unicodedata.combining(ch))
        value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
        return re.sub(r"\s+", " ", value).strip()
