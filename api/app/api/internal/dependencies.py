import secrets

from fastapi import Header, HTTPException, status

from app.core.config import settings


def require_internal_service(
    x_ordium_internal_key: str | None = Header(default=None, alias="X-ORDIUM-Internal-Key"),
) -> None:
    configured = settings.ordium_internal_shared_secret
    if not configured or not x_ordium_internal_key or not secrets.compare_digest(x_ordium_internal_key, configured):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
