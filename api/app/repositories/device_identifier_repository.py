from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.device_identifier import DeviceIdentifier


class DeviceIdentifierRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, device_identifier_id: UUID) -> DeviceIdentifier | None:
        statement = select(DeviceIdentifier).where(
            DeviceIdentifier.id == device_identifier_id,
        )

        return self.db.scalar(statement)

    def get_by_fingerprint(
        self,
        fingerprint: str,
    ) -> DeviceIdentifier | None:
        statement = select(DeviceIdentifier).where(
            DeviceIdentifier.fingerprint == fingerprint,
        )

        return self.db.scalar(statement)

    def create(self, device_identifier: DeviceIdentifier) -> DeviceIdentifier:
        self.db.add(device_identifier)
        self.db.flush()

        return device_identifier