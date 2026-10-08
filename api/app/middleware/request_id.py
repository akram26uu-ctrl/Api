from __future__ import annotations

import uuid
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class RequestIDMiddleware:
    """Validate or generate a request ID and expose it on state/response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        state = scope.setdefault("state", {})
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        raw_candidate = headers.get(b"x-request-id", b"").decode("latin-1").strip()
        candidate = raw_candidate[:64]

        try:
            parsed = uuid.UUID(candidate)
            request_id = str(parsed) if str(parsed) == candidate else str(uuid.uuid4())
        except (ValueError, AttributeError):
            request_id = str(uuid.uuid4())

        state["request_id"] = request_id

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                raw_headers = list(message.get("headers", []))
                raw_headers = [
                    (key, value)
                    for key, value in raw_headers
                    if key.lower() != b"x-request-id"
                ]
                raw_headers.append((b"x-request-id", request_id.encode("ascii")))
                message["headers"] = raw_headers
            await send(message)

        await self.app(scope, receive, send_wrapper)
