from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.api_key import ApiKey


class ApiKeyRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_hash(self, key_hash: str) -> ApiKey | None:
        statement = select(ApiKey).where(ApiKey.key_hash == key_hash)
        return self.db.scalar(statement)

    def update_last_used(self, api_key: ApiKey, now: datetime | None = None) -> None:
        api_key.last_used_at = now or datetime.now(timezone.utc)
        self.db.flush()
