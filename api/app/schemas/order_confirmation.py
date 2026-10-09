from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


ConfirmationChannel = Literal["whatsapp", "manual_call"]
ConfirmationOutcome = Literal["contact_started", "confirmed", "cancelled", "no_answer", "callback_requested", "needs_review"]


class ConfirmationAttemptCreate(BaseModel):
    channel: ConfirmationChannel
    outcome: ConfirmationOutcome
    notes: str | None = Field(default=None, max_length=1000)


class ConfirmationAttemptResponse(BaseModel):
    id: str
    order_id: str
    channel: str
    outcome: str
    notes: str | None
    created_at: datetime


class ConfirmationAttemptList(BaseModel):
    data: list[ConfirmationAttemptResponse]
    status: str
