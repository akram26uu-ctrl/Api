from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_large_api_documents_use_gzip_when_accepted():
    response = client.get("/openapi.json", headers={"Accept-Encoding": "gzip"})

    assert response.status_code == 200
    assert response.headers.get("Content-Encoding") == "gzip"
    assert "application/json" in response.headers["Content-Type"]


def test_gzip_middleware_is_registered():
    registered = {middleware.cls.__name__ for middleware in app.user_middleware}
    assert "GZipMiddleware" in registered


def test_readiness_timeout_returns_not_ready(monkeypatch):
    main_module = importlib.import_module("app.main")

    async def timeout(*args, **kwargs):
        raise TimeoutError

    monkeypatch.setattr(main_module.asyncio, "wait_for", timeout)
    response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json() == {"status": "not_ready"}
