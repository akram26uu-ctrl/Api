import atexit
import os
import shutil
import tempfile
import pytest
from pathlib import Path

# Tests must never inherit the application's real DATABASE_URL.
_test_dir = Path(tempfile.mkdtemp(prefix="ordium-pytest-"))
_test_db = _test_dir / "ordium.sqlite3"

os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{_test_db}"
os.environ["SECRET_KEY"] = "pytest-only-secret-key-that-is-long-enough-123"
os.environ["ORDIUM_INTERNAL_SHARED_SECRET"] = "pytest-internal-shared-secret-that-is-long-enough-123"
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DEBUG", "false")

from app.db.base import Base  # noqa: E402
import app.models  # noqa: E402,F401
from app.db.database import engine, SessionLocal  # noqa: E402


Base.metadata.create_all(engine)


def _cleanup() -> None:
    try:
        engine.dispose()
    finally:
        shutil.rmtree(_test_dir, ignore_errors=True)


atexit.register(_cleanup)


@pytest.fixture(autouse=True)
def _legacy_store_compatibility(monkeypatch):
    from app.services.api_key_service import ApiKeyService
    from app.models.store import Store
    original = ApiKeyService.create_key

    def create_key_with_test_store(self, merchant, name, environment="live", scopes=None, key_kind="customer", store_id=None):
        if key_kind == "customer" and store_id is None:
            store = self.db.query(Store).filter(Store.merchant_id == merchant.id, Store.is_active.is_(True)).order_by(Store.created_at.asc()).first()
            if store is None:
                store = Store(merchant_id=merchant.id, name="Test Store", slug=f"test-{merchant.id.hex[:12]}", is_active=True)
                self.db.add(store)
                self.db.flush()
            store_id = store.id
        return original(self, merchant, name, environment, scopes, key_kind, store_id)

    monkeypatch.setattr(ApiKeyService, "create_key", create_key_with_test_store)
