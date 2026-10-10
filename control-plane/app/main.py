import logging
from urllib.parse import urlsplit
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.api.dashboard_proxy import router as dashboard_router
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
app = FastAPI(title=settings.app_name, version=settings.app_version)

origins = [x.strip() for x in settings.web_origins.split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "X-Request-ID", "X-Ordium-Environment", "Idempotency-Key", "X-Device-Fingerprint", "X-Simulation-IP", "X-Ordium-Client-Version", "X-Ordium-Store-ID"])
app.include_router(auth_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")

@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.middleware("http")
async def enforce_allowed_origin_for_mutations(request: Request, call_next):
    """Reject cross-origin browser mutations while allowing clients without Origin."""
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin:
            normalized_origin = origin.rstrip("/")
            parsed = urlsplit(normalized_origin)
            valid_origin = bool(parsed.scheme and parsed.netloc and parsed.path == "" and not parsed.query and not parsed.fragment)
            allowed = {item.rstrip("/") for item in origins}
            if not valid_origin or normalized_origin not in allowed:
                return JSONResponse(status_code=403, content={"detail": "Request origin is not allowed"})
    return await call_next(request)
