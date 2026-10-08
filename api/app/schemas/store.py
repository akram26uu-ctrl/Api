from datetime import datetime
from pydantic import BaseModel, Field

class StoreCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    slug: str | None = Field(default=None, max_length=100)

class StoreUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    is_active: bool = True

class StoreResponse(BaseModel):
    id: str
    name: str
    slug: str
    is_active: bool
    created_at: datetime
    order_count: int | None = None
