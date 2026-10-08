import atexit
import os
import shutil
import tempfile
from pathlib import Path

_test_dir = Path(tempfile.mkdtemp(prefix="ordium-control-plane-pytest-"))
_test_db = _test_dir / "control.sqlite3"
os.environ["WEB_DATABASE_URL"] = f"sqlite+pysqlite:///{_test_db}"
os.environ["ORDIUM_API_URL"] = "http://testserver:8000"
os.environ["ORDIUM_INTERNAL_SHARED_SECRET"] = "pytest-internal-shared-secret-that-is-long-enough-123"
os.environ["SESSION_ENCRYPTION_KEY"] = "pytest-session-encryption-key-that-is-long-enough-123"
os.environ["ENVIRONMENT"] = "test"
os.environ["DEBUG"] = "false"
os.environ["REQUIRE_EMAIL_VERIFICATION"] = "false"

from app.db import Base, engine  # noqa: E402
import app.models  # noqa: F401,E402

Base.metadata.create_all(engine)


def _cleanup() -> None:
    engine.dispose()
    shutil.rmtree(_test_dir, ignore_errors=True)


atexit.register(_cleanup)
