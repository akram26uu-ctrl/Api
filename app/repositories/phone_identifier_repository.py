from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.phone_identifier import PhoneIdentifier


class PhoneIdentifierRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, phone_identifier_id: UUID) -> PhoneIdentifier | None:
        statement = select(PhoneIdentifier).where(
            PhoneIdentifier.id == phone_identifier_id,
        )

        return self.db.scalar(statement)

    def get_by_phone(self, phone: str) -> PhoneIdentifier | None:
        statement = select(PhoneIdentifier).where(
            PhoneIdentifier.phone == phone,
        )

        return self.db.scalar(statement)

    def create(self, phone_identifier: PhoneIdentifier) -> PhoneIdentifier:
        self.db.add(phone_identifier)
        self.db.flush()

        return phone_identifier