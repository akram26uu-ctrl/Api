from collections.abc import Generator
from threading import Lock
from datetime import datetime, timedelta, timezone
import time

from fastapi import Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal, get_db
from app.models.api_key import ApiKey
from app.models.merchant import Merchant
from app.repositories.api_rate_limit_repository import ApiRateLimitRepository
from app.repositories.merchant_rate_limit_repository import MerchantRateLimitRepository
from app.services.api_key_service import ApiKeyService


bearer_scheme = HTTPBearer(auto_error=False)
_rate_limit_lock = Lock()
_test_rate_windows: dict[tuple[str, str], tuple[datetime, int]] = {}
_test_merchant_rate_windows: dict[tuple[str, str], tuple[datetime, int]] = {}


def get_database() -> Generator[Session, None, None]:
    yield from get_db()


def get_current_api_key(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_database),
) -> ApiKey:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_key = credentials.credentials.strip()
    if len(raw_key) > 255 or not raw_key.startswith("ordium_"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return ApiKeyService(db).authenticate(raw_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_merchant(
    api_key: ApiKey = Depends(get_current_api_key),
) -> Merchant:
    merchant = api_key.merchant
    if merchant is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return merchant


def get_current_rate_limited_api_key(
    response: Response,
    api_key: ApiKey = Depends(get_current_api_key),
) -> ApiKey:
    now = datetime.now(timezone.utc)
    window_start = now.replace(second=0, microsecond=0)
    limit = (
        settings.test_requests_per_minute
        if api_key.environment == "test"
        else settings.live_requests_per_minute
    )

    if settings.database_url.startswith("sqlite"):
        with _rate_limit_lock:
            # Keep the local SQLite/test limiter bounded and discard old minute buckets.
            stale_before = window_start - timedelta(hours=2)
            for old_key, (old_window, _) in list(_test_rate_windows.items()):
                if old_window < stale_before:
                    _test_rate_windows.pop(old_key, None)
            if len(_test_rate_windows) > 20_000:
                _test_rate_windows.clear()
            key = (str(api_key.id), api_key.environment)
            stored = _test_rate_windows.get(key)
            if stored is None or stored[0] != window_start:
                count = 1
                _test_rate_windows[key] = (window_start, count)
            else:
                count = stored[1] + 1
                _test_rate_windows[key] = (window_start, count)
    else:
        with SessionLocal() as rate_db:
            repository = ApiRateLimitRepository(rate_db)
            bucket = repository.consume(
                api_key_id=api_key.id,
                environment=api_key.environment,
                window_start=window_start,
            )
            if bucket.request_count == 1:
                repository.cleanup_before(
                    api_key_id=api_key.id,
                    environment=api_key.environment,
                    cutoff=window_start - timedelta(hours=2),
                )
            rate_db.commit()
        count = bucket.request_count

    merchant_limit = (
        settings.test_requests_per_minute_per_merchant
        if api_key.environment == "test"
        else settings.live_requests_per_minute_per_merchant
    )

    if settings.database_url.startswith("sqlite"):
        with _rate_limit_lock:
            stale_before = window_start - timedelta(hours=2)
            for old_key, (old_window, _) in list(_test_merchant_rate_windows.items()):
                if old_window < stale_before:
                    _test_merchant_rate_windows.pop(old_key, None)
            if len(_test_merchant_rate_windows) > 20_000:
                _test_merchant_rate_windows.clear()
            merchant_key = (str(api_key.merchant_id), api_key.environment)
            stored = _test_merchant_rate_windows.get(merchant_key)
            if stored is None or stored[0] != window_start:
                merchant_count = 1
                _test_merchant_rate_windows[merchant_key] = (window_start, merchant_count)
            else:
                merchant_count = stored[1] + 1
                _test_merchant_rate_windows[merchant_key] = (window_start, merchant_count)
    else:
        with SessionLocal() as rate_db:
            repository = MerchantRateLimitRepository(rate_db)
            merchant_bucket = repository.consume(
                merchant_id=api_key.merchant_id,
                environment=api_key.environment,
                window_start=window_start,
            )
            if merchant_bucket.request_count == 1:
                repository.cleanup_before(
                    merchant_id=api_key.merchant_id,
                    environment=api_key.environment,
                    cutoff=window_start - timedelta(hours=2),
                )
            rate_db.commit()
        merchant_count = merchant_bucket.request_count

    remaining = max(0, limit - count)
    merchant_remaining = max(0, merchant_limit - merchant_count)
    reset_at = int((window_start + timedelta(minutes=1)).timestamp())
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    response.headers["X-RateLimit-Reset"] = str(reset_at)
    response.headers["X-Merchant-RateLimit-Limit"] = str(merchant_limit)
    response.headers["X-Merchant-RateLimit-Remaining"] = str(merchant_remaining)

    if count > limit or merchant_count > merchant_limit:
        retry_after = max(1, reset_at - int(time.time()))
        response.headers["Retry-After"] = str(retry_after)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(retry_after)},
        )

    return api_key


def require_api_scope(scope: str):
    def dependency(api_key: ApiKey = Depends(get_current_rate_limited_api_key)) -> ApiKey:
        scopes = set(api_key.scopes or [])
        if scope not in scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API key scope does not permit this operation",
            )
        return api_key
    return dependency


def get_current_live_api_key(
    api_key: ApiKey = Depends(get_current_rate_limited_api_key),
) -> ApiKey:
    if api_key.environment != "live":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is available only with a live API key",
        )
    return api_key
