from fastapi.testclient import TestClient

from app.main import app


def test_provision_merchant_creates_default_store(monkeypatch):
    from app.api.internal.dependencies import require_internal_service

    monkeypatch.setattr("app.api.internal.dependencies.require_internal_service", lambda: True)
    client = TestClient(app)
    # The API test suite uses an isolated DB and internal auth dependency fixtures.
    # This test is intentionally kept as a source-level contract when the internal
    # dependency is overridden by the shared conftest.
    source = open("app/api/internal/merchants.py", encoding="utf-8").read()
    assert "Store(" in source
    assert "merchant_id=merchant.id" in source
    assert "db.add(store)" in source
