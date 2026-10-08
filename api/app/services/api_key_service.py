import hashlib
import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.api_key import ApiKey
from app.models.merchant import Merchant
from app.repositories.api_key_repository import ApiKeyRepository
from app.schemas.api_key import AVAILABLE_API_KEY_SCOPES


class ApiKeyService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = ApiKeyRepository(db)

    def authenticate(self, raw_key: str) -> ApiKey:
        key_hash = self.hash_key(raw_key)
        api_key = self.repository.get_by_hash(key_hash)

        if api_key is None:
            raise ValueError("Invalid or inactive API key")
        if not api_key.is_active:
            raise ValueError("Invalid or inactive API key")
        if api_key.expires_at is not None:
            expires_at = api_key.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= datetime.now(timezone.utc):
                raise ValueError("Invalid or inactive API key")
        if api_key.merchant is None or api_key.merchant.status.value != "active":
            raise ValueError("Invalid or inactive API key")

        now = datetime.now(timezone.utc)
        last_used_at = api_key.last_used_at
        if last_used_at is not None and last_used_at.tzinfo is None:
            last_used_at = last_used_at.replace(tzinfo=timezone.utc)
        if last_used_at is None or (now - last_used_at).total_seconds() >= 60:
            self.repository.update_last_used(api_key, now=now)
        return api_key

    def create_key(
        self,
        merchant: Merchant,
        name: str,
        environment: str = "live",
        scopes: list[str] | None = None,
        key_kind: str = "customer",
        store_id: UUID | None = None,
    ) -> tuple[ApiKey, str]:
        if environment not in {"live", "test"}:
            raise ValueError("Invalid API key environment")
        if key_kind not in {"customer", "system"}:
            raise ValueError("Invalid API key kind")

        normalized_scopes = list(dict.fromkeys(scopes or ["orders:write", "outcomes:write"]))
        invalid_scopes = set(normalized_scopes) - AVAILABLE_API_KEY_SCOPES
        if not normalized_scopes or invalid_scopes:
            raise ValueError("Invalid API key scopes")

        raw_key = self.generate_key(environment)
        if key_kind == "customer" and store_id is None:
            from app.models.store import Store
            active_stores = (
                self.db.query(Store)
                .filter(Store.merchant_id == merchant.id, Store.is_active.is_(True))
                .order_by(Store.created_at.asc())
                .limit(2)
                .all()
            )
            if len(active_stores) != 1:
                raise ValueError("store_id is required when a merchant has zero or multiple active stores")
            store_id = active_stores[0].id
        if store_id is not None:
            from app.models.store import Store
            store = self.db.query(Store).filter(Store.id == store_id, Store.merchant_id == merchant.id, Store.is_active.is_(True)).first()
            if store is None:
                raise ValueError("Store not found")
        api_key = ApiKey(
            merchant_id=merchant.id,
            store_id=store_id,
            name=name,
            key_hash=self.hash_key(raw_key),
            environment=environment,
            key_kind=key_kind,
            scopes=normalized_scopes,
            is_active=True,
        )
        self.db.add(api_key)
        self.db.flush()
        return api_key, raw_key

    @staticmethod
    def generate_key(environment: str = "live") -> str:
        return f"ordium_{environment}_{secrets.token_urlsafe(32)}"

    @staticmethod
    def hash_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def revoke(self, api_key: ApiKey) -> None:
        api_key.is_active = False
        self.db.flush()
