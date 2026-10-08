from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    environment: str
    store_id: str | None = None
    notification_type: str
    severity: str
    title: str
    message: str
    resource_type: str | None = None
    resource_id: str | None = None
    metadata: dict | None = None
    read_at: datetime | None = None
    created_at: datetime


class NotificationPage(BaseModel):
    data: list[NotificationResponse]
    unread_count: int
    pagination: dict
