from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.address_identifier import AddressIdentifier


class AddressIdentifierRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, address_identifier_id: UUID) -> AddressIdentifier | None:
        statement = select(AddressIdentifier).where(
            AddressIdentifier.id == address_identifier_id,
        )

        return self.db.scalar(statement)

    def get_by_hash(self, address_hash: str) -> AddressIdentifier | None:
        statement = select(AddressIdentifier).where(
            AddressIdentifier.address_hash == address_hash,
        )

        return self.db.scalar(statement)

    def create(self, address_identifier: AddressIdentifier) -> AddressIdentifier:
        self.db.add(address_identifier)
        self.db.flush()

        return address_identifier