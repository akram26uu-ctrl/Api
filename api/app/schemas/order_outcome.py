from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, Field, field_validator


class OrderOutcomeCreate(BaseModel):
    outcome_status: str
    source: str = Field(default="merchant", max_length=50)
    note: str | None = Field(
        default=None,
        max_length=1000,
    )
    occurred_at: datetime | None = None

    @field_validator("occurred_at")
    @classmethod
    def validate_occurred_at(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return value
        if value.tzinfo is None:
            raise ValueError("occurred_at must include timezone information")
        now = datetime.now(timezone.utc)
        if value > now.replace(microsecond=0) + timedelta(minutes=5):
            raise ValueError("occurred_at cannot be more than 5 minutes in the future")
        return value

    @field_validator("outcome_status")
    @classmethod
    def validate_outcome_status(cls, value: str) -> str:
        value = value.lower().strip()

        allowed = {
            "delivered",
            "cancelled",
            "returned",
        }

        if value not in allowed:
            raise ValueError(
                "outcome_status must be one of: "
                "delivered, cancelled, returned"
            )

        return value


class OrderOutcomeResponse(BaseModel):
    id: str
    order_id: str
    outcome_status: str
    source: str
    note: str | None
    occurred_at: datetime
    created_at: datetime

class OrderOutcomeUpdate(BaseModel):
    outcome_status: str
    source: str | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=1000)
    occurred_at: datetime | None = None

    @field_validator("occurred_at")
    @classmethod
    def validate_update_occurred_at(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return value
        if value.tzinfo is None:
            raise ValueError("occurred_at must include timezone information")
        now = datetime.now(timezone.utc)
        if value > now.replace(microsecond=0) + timedelta(minutes=5):
            raise ValueError("occurred_at cannot be more than 5 minutes in the future")
        return value

    @field_validator("outcome_status")
    @classmethod
    def validate_update_outcome_status(cls, value: str) -> str:
        value = value.lower().strip()
        if value not in {"delivered", "cancelled", "returned"}:
            raise ValueError("outcome_status must be one of: delivered, cancelled, returned")
        return value
