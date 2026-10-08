from pydantic import BaseModel, ConfigDict, Field, model_validator


class RiskProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    merchant_id: str

    high_cancel_rate_threshold: float
    high_cancel_rate_min_orders: int
    high_cancel_rate_score: int

    phone_reuse_threshold: int
    phone_reuse_score: int

    device_reuse_threshold: int
    device_reuse_score: int

    address_reuse_threshold: int
    address_reuse_score: int

    multiple_customers_same_phone_threshold: int
    multiple_customers_same_phone_score: int

    multiple_phones_same_device_threshold: int
    multiple_phones_same_device_score: int

    high_order_frequency_count: int
    high_order_frequency_window_minutes: int
    high_order_frequency_score: int

    high_ip_frequency_count: int
    high_ip_frequency_window_minutes: int
    high_ip_frequency_score: int

    multiple_customers_same_ip_threshold: int
    multiple_customers_same_ip_score: int

    new_device_customer_min_orders: int
    new_device_score: int

    vpn_score: int
    proxy_score: int

    review_threshold: int
    reject_threshold: int
    max_score: int

    is_active: bool

class RiskProfileUpdate(BaseModel):
    review_threshold: int | None = Field(default=None, ge=0, le=99)
    reject_threshold: int | None = Field(default=None, ge=1, le=100)
    high_cancel_rate_score: int | None = Field(default=None, ge=0, le=100)
    phone_reuse_score: int | None = Field(default=None, ge=0, le=100)
    device_reuse_score: int | None = Field(default=None, ge=0, le=100)
    address_reuse_score: int | None = Field(default=None, ge=0, le=100)
    multiple_customers_same_phone_score: int | None = Field(default=None, ge=0, le=100)
    multiple_phones_same_device_score: int | None = Field(default=None, ge=0, le=100)
    high_order_frequency_score: int | None = Field(default=None, ge=0, le=100)
    high_ip_frequency_score: int | None = Field(default=None, ge=0, le=100)
    multiple_customers_same_ip_score: int | None = Field(default=None, ge=0, le=100)
    new_device_score: int | None = Field(default=None, ge=0, le=100)
    vpn_score: int | None = Field(default=None, ge=0, le=100)
    proxy_score: int | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.review_threshold is not None and self.reject_threshold is not None and self.review_threshold >= self.reject_threshold:
            raise ValueError("review_threshold must be lower than reject_threshold")
        return self
