from pydantic import BaseModel, EmailStr, Field


class MerchantProvisionRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    business_type: str | None = Field(default=None, max_length=100)
    secondary_business_categories: list[str] = Field(default_factory=list, max_length=20)


class MerchantProvisionResponse(BaseModel):
    merchant_id: str
    status: str


class MerchantApiKeyRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    environment: str = Field(pattern=r"^(live|test)$")
    scopes: list[str] = Field(min_length=1, max_length=20)


class MerchantApiKeyResponse(BaseModel):
    merchant_id: str
    api_key_id: str
    api_key: str
    environment: str
    scopes: list[str]


class MerchantStoreResponse(BaseModel):
    merchant_id: str
    store_id: str
    name: str
    slug: str
