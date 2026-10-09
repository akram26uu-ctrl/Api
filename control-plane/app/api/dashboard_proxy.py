from __future__ import annotations

import re
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.auth import get_current_session, _decrypt_dashboard_key
from app.core.config import settings
from app.db import get_db

router = APIRouter(prefix="/dashboard", tags=["Dashboard Proxy"])

_ALLOWED = (
    re.compile(r"^/orders(?:/[0-9a-fA-F-]{36})?(?:/outcome|/confirmation-attempts)?$"),
    re.compile(r"^/order-confirmations/metrics$"),
    re.compile(r"^/metrics/(summary|risk-performance|risk-calibration|risk-attribution|risk-backtest|risk-quality)$"),
    re.compile(r"^/api-keys(?:/[0-9a-fA-F-]{36}/(?:revoke|rotate))?$"),
    re.compile(r"^/stores(?:/[0-9a-fA-F-]{36})?$") ,
    re.compile(r"^/webhooks(?:/[0-9a-fA-F-]{36}/(?:disable|test))?$"),
    re.compile(r"^/risk-profile$"),
    re.compile(r"^/usage$"),
    re.compile(r"^/risk-features$"),
    re.compile(r"^/identity-graph$"),
    re.compile(r"^/notifications$"),
    re.compile(r"^/notifications/[0-9a-fA-F-]{36}/read$"),
    re.compile(r"^/notifications/read-all$"),
    re.compile(r"^/audit-logs$"),
)

def _allowed(path: str) -> bool:
    return any(pattern.fullmatch(path) for pattern in _ALLOWED)

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
async def proxy_dashboard(path: str, request: Request, response: Response, session_data=Depends(get_current_session), db: Session = Depends(get_db)):
    session, _user, _membership = session_data
    path = "/" + path.lstrip("/")
    if not _allowed(path):
        raise HTTPException(status_code=404, detail="Dashboard endpoint not found")

    environment = request.headers.get("X-Ordium-Environment", "live").strip().lower()
    if environment not in {"test", "live"}:
        raise HTTPException(status_code=400, detail="Invalid dashboard environment")
    raw_key = _decrypt_dashboard_key(session.ordium_live_api_key_encrypted if environment == "live" else session.ordium_api_key_encrypted)
    if not raw_key:
        raise HTTPException(status_code=401, detail="Dashboard credential is unavailable")

    query = request.url.query
    store_header = request.headers.get("X-Ordium-Store-ID")
    if store_header and "store_id=" not in query and (
        path.startswith("/notifications/")
        or path.startswith("/orders/")
        or path.startswith("/api-keys/")
        or path.startswith("/webhooks/")
    ):
        from urllib.parse import parse_qsl, urlencode
        params = parse_qsl(query, keep_blank_values=True)
        params.append(("store_id", store_header))
        query = urlencode(params)
    url = f"{settings.ordium_api_url.rstrip('/')}/api/v1{path}" + (f"?{query}" if query else "")
    body = await request.body()
    headers = {
        "Authorization": f"Bearer {raw_key}",
        "Content-Type": request.headers.get("content-type", "application/json"),
        "X-Ordium-Client-Version": request.headers.get("X-Ordium-Client-Version", "1.5.2-web"),
    }
    for name in ("Idempotency-Key", "X-Device-Fingerprint", "X-Simulation-IP", "X-Request-ID", "X-Ordium-Store-ID"):
        value = request.headers.get(name)
        if value:
            headers[name] = value

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
            upstream = await client.request(request.method, url, headers=headers, content=body)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail="ORDIUM API is temporarily unavailable") from exc

    for name in ("X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After", "X-Merchant-RateLimit-Limit", "X-Merchant-RateLimit-Remaining"):
        if name in upstream.headers:
            response.headers[name] = upstream.headers[name]
    media_type = upstream.headers.get("content-type", "application/json")
    response.status_code = upstream.status_code
    return Response(content=upstream.content, status_code=upstream.status_code, media_type=media_type, headers={k:v for k,v in response.headers.items()})
