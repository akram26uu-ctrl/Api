from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.idempotency_record import IdempotencyRecord


class IdempotencyRepository:
    def __init__(self, db: Session):
        self.db = db

    def delete_expired_for_merchant(
        self,
        merchant_id: UUID,
        environment: str,
        now: datetime,
    ) -> int:
        from sqlalchemy import delete

        result = self.db.execute(
            delete(IdempotencyRecord).where(
                IdempotencyRecord.merchant_id == merchant_id,
                IdempotencyRecord.environment == environment,
                IdempotencyRecord.expires_at.is_not(None),
                IdempotencyRecord.expires_at <= now,
            )
        )
        return int(result.rowcount or 0)

    def get(
        self,
        merchant_id: UUID,
        environment: str,
        idempotency_key: str,
    ) -> IdempotencyRecord | None:
        record = self.db.scalar(
            select(IdempotencyRecord).where(
                IdempotencyRecord.merchant_id == merchant_id,
                IdempotencyRecord.environment == environment,
                IdempotencyRecord.idempotency_key == idempotency_key,
            )
        )
        if record is not None and record.expires_at is not None:
            expires_at = record.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= datetime.now(timezone.utc):
                self.db.delete(record)
                self.db.flush()
                return None
        return record

    def create(self, record: IdempotencyRecord) -> IdempotencyRecord:
        self.db.add(record)
        self.db.flush()
        return record
