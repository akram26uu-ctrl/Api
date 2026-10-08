from __future__ import annotations

import asyncio

from uuid import UUID

from fastapi.testclient import TestClient

from app.main import app
from app.middleware.request_size import RequestSizeLimitMiddleware


client = TestClient(app)


def test_request_id_and_security_headers_are_added():
    response = client.get("/healthz", headers={"X-Request-ID": "not-a-uuid"})

    assert response.status_code == 200
    generated = response.headers["X-Request-ID"]
    UUID(generated)
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Cache-Control"] == "no-store"


def test_valid_request_id_is_preserved():
    request_id = "4b2f4b7e-5377-4fd7-9cc1-6a1e6cfa5b5a"
    response = client.get("/healthz", headers={"X-Request-ID": request_id})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == request_id


def test_request_body_limit_rejects_oversized_declared_body():
    body = b"x" * 1_048_577
    response = client.post("/healthz", content=body)

    assert response.status_code == 413
    assert response.json() == {"detail": "Request body too large"}


def test_request_body_limit_rejects_oversized_chunked_body():
    async def inner(scope, receive, send):
        while True:
            message = await receive()
            if message["type"] != "http.request":
                break
            if not message.get("more_body"):
                break
        await send({
            "type": "http.response.start",
            "status": 200,
            "headers": [[b"content-type", b"application/json"]],
        })
        await send({
            "type": "http.response.body",
            "body": b"{}",
        })

    middleware = RequestSizeLimitMiddleware(inner, max_body_bytes=5)

    async def run():
        messages = [
            {"type": "http.request", "body": b"123", "more_body": True},
            {"type": "http.request", "body": b"456", "more_body": False},
        ]
        sent = []

        async def receive():
            return messages.pop(0)

        async def send(message):
            sent.append(message)

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": [],
            "query_string": b"",
            "path_params": {},
            "root_path": "",
            "scheme": "http",
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
        }
        await middleware(scope, receive, send)
        return sent

    sent = asyncio.run(run())
    assert sent[0]["status"] == 413


def test_cross_cutting_middleware_is_separate_from_main():
    registered = {middleware.cls.__name__ for middleware in app.user_middleware}

    assert "RequestIDMiddleware" in registered
    assert "RequestSizeLimitMiddleware" in registered
    assert "SecurityHeadersMiddleware" in registered
    assert "RequestLoggingMiddleware" in registered
