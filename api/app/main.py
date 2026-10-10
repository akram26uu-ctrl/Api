import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.router import router as api_router
from app.api.internal.router import router as internal_router
from app.core.config import settings
from app.db.database import test_database_connection
from app.middleware import (
    RequestIDMiddleware,
    RequestLoggingMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)

logger = logging.getLogger("ordium")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)

allowed_hosts = [item.strip() for item in settings.allowed_hosts.split(",") if item.strip()]
if allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

allowed_origins = [item.strip() for item in settings.cors_allowed_origins.split(",") if item.strip()]
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-Device-Fingerprint",
            "X-Simulation-IP",
            "X-Ordium-Store-ID",
            "X-Request-ID",
            "X-Ordium-Client-Version",
            "X-Ordium-Environment",
        ],
    )

# Custom middleware is registered in reverse execution order so logging is outermost,
# request IDs are available to downstream handlers, and security headers also cover
# middleware-generated 4xx responses such as oversized request bodies.
app.add_middleware(
    RequestSizeLimitMiddleware,
    max_body_bytes=settings.max_request_body_bytes,
)
app.add_middleware(
    SecurityHeadersMiddleware,
    production=settings.environment.strip().lower() == "production",
)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(RequestLoggingMiddleware)

app.include_router(api_router)
app.include_router(internal_router)


@app.get("/", tags=["System"])
def root():
    return {"message": "Ordium API is running", "version": settings.app_version}


@app.get("/healthz", tags=["System"])
def healthz():
    return {"status": "ok"}


@app.get("/readyz", tags=["System"])
def readyz():
    if not test_database_connection():
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready"},
        )
    return {"status": "ready"}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "detail": "Request validation failed",
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    if settings.debug:
        logger.exception("Unhandled application error request_id=%s", request_id)
    else:
        logger.error("Unhandled application error request_id=%s error_type=%s", request_id, type(exc).__name__)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "request_id": request_id,
        },
    )
