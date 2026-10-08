from datetime import datetime
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: str | None
    environment: str | None
    request_id: str | None
    created_at: datetime
    metadata: dict | None = None
