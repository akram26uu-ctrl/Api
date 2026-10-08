from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl, field_validator


class WebhookCreate(BaseModel):
    store_id: str | None = None
    url: HttpUrl
    events: list[str] = Field(default_factory=lambda: ["*"], min_length=1, max_length=10)

    @field_validator("events")
    @classmethod
    def validate_events(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value]
        if any(not item or len(item) > 100 for item in cleaned):
            raise ValueError("Invalid webhook event")
        return cleaned


class WebhookCreateResponse(BaseModel):
    store_id: str | None = None
    environment: str
    id: str
    url: str
    events: list[str]
    signing_secret: str


class WebhookResponse(BaseModel):
    store_id: str | None = None
    environment: str
    id: str
    url: str
    events: list[str]
    is_active: bool
    created_at: datetime
    failure_rate: float = 0.0


class WebhookTestResponse(BaseModel):
    delivery_id: str
    status_code: int | None
    success: bool
    duration_ms: float | None
    error: str | None = None
