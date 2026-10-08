from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.merchant_rate_limit_bucket import MerchantRateLimitBucket


class MerchantRateLimitRepository:
    def __init__(self, db: Session):
        self.db = db

    def cleanup_before(self, *, merchant_id: UUID, environment: str, cutoff: datetime) -> None:
        self.db.execute(delete(MerchantRateLimitBucket).where(
            MerchantRateLimitBucket.merchant_id == merchant_id,
            MerchantRateLimitBucket.environment == environment,
            MerchantRateLimitBucket.window_start < cutoff,
        ))

    def consume(self, *, merchant_id: UUID, environment: str, window_start: datetime) -> MerchantRateLimitBucket:
        statement = (select(MerchantRateLimitBucket).where(
            MerchantRateLimitBucket.merchant_id == merchant_id,
            MerchantRateLimitBucket.environment == environment,
            MerchantRateLimitBucket.window_start == window_start,
        ).with_for_update())
        bucket = self.db.scalar(statement)
        if bucket is not None:
            bucket.request_count += 1
            self.db.flush()
            return bucket

        bucket = MerchantRateLimitBucket(
            merchant_id=merchant_id, environment=environment,
            window_start=window_start, request_count=1,
        )
        self.db.add(bucket)
        try:
            self.db.flush()
            return bucket
        except IntegrityError:
            self.db.rollback()
            bucket = self.db.scalar(statement)
            if bucket is None:
                raise
            bucket.request_count += 1
            self.db.flush()
            return bucket
