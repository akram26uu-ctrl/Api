from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, HttpUrl, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    organization_name: str = Field(min_length=2, max_length=255)
    country: str = Field(default="Algeria", min_length=2, max_length=100)
    wilaya: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    website_url: HttpUrl | None = None
    ecommerce_platform: str | None = Field(default=None, max_length=100)
    business_type: str | None = Field(default=None, max_length=100)
    primary_market: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=32)
    monthly_orders: str | None = Field(default=None, max_length=64)

    @field_validator("first_name", "last_name", "organization_name", "country")
    @classmethod
    def reject_blank_required_fields(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field must not be blank")
        return normalized

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if not any(c.isupper() for c in value) or not any(c.islower() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain upper, lower, and numeric characters")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AccountSettingsUpdateRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    organization_name: str = Field(min_length=2, max_length=255)
    country: str = Field(min_length=2, max_length=100)
    wilaya: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    website_url: HttpUrl | None = None
    ecommerce_platform: str | None = Field(default=None, max_length=100)
    business_type: str | None = Field(default=None, max_length=100)
    primary_market: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=32)
    monthly_orders: str | None = Field(default=None, max_length=64)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if not any(c.isupper() for c in value) or not any(c.islower() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain upper, lower, and numeric characters")
        return value


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    status: str


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    merchant_id: UUID | None
    country: str
    wilaya: str | None
    city: str | None
    website_url: str | None
    ecommerce_platform: str | None
    business_type: str | None
    primary_market: str | None
    phone: str | None
    monthly_orders: str | None


class SessionResponse(BaseModel):
    user: UserResponse
    organization: OrganizationResponse
    role: str
    initial_test_api_key: str | None = None


class RegisterResponse(BaseModel):
    user: UserResponse | None = None
    organization: OrganizationResponse | None = None
    role: str | None = None
    initial_test_api_key: str | None = None
    verification_required: bool = False
    verification_token: str | None = None


class SessionInfo(BaseModel):
    id: UUID
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    current: bool = False
