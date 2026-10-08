from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator


AVAILABLE_API_KEY_SCOPES = {
    "orders:read",
    "orders:write",
    "outcomes:write",
    "metrics:read",
    "risk_profile:read",
    "risk_profile:write",
    "risk_features:read",
    "keys:manage",
    "webhooks:manage",
    "audit:read",
}


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    environment: str = Field(default="live", pattern="^live$")
    expires_at: datetime | None = None
    store_id: str | None = None
    scopes: list[str] = Field(default_factory=lambda: ["orders:write", "outcomes:write"], max_length=20)

    @field_validator("scopes")
    @classmethod
    def validate_scopes(cls, value: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(scope.strip() for scope in value))
        if not normalized or len(normalized) > 20:
            raise ValueError("At least one scope is required")
        invalid = sorted(set(normalized) - AVAILABLE_API_KEY_SCOPES)
        if invalid:
            raise ValueError(f"Unsupported API key scope: {invalid[0]}")
        return normalized

    @field_validator("expires_at")
    @classmethod
    def validate_expiry(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("expires_at must include timezone information")
        if value <= datetime.now(timezone.utc):
            raise ValueError("expires_at must be in the future")
        return value


class ApiKeyCreateResponse(BaseModel):
    id: str
    name: str
    environment: str
    scopes: list[str]
    api_key: str
    expires_at: datetime | None
    store_id: str | None = None


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    environment: str
    scopes: list[str]
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None
    expires_at: datetime | None
    store_id: str | None = None
