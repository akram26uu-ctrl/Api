from functools import lru_cache
from urllib.parse import urlsplit
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    app_name: str = Field(default="ORDIUM Control Plane", alias="APP_NAME")
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")
    web_database_url: str = Field(alias="WEB_DATABASE_URL")
    ordium_api_url: str = Field(alias="ORDIUM_API_URL")
    ordium_internal_shared_secret: str = Field(alias="ORDIUM_INTERNAL_SHARED_SECRET", min_length=32)
    session_encryption_key: str = Field(alias="SESSION_ENCRYPTION_KEY", min_length=32)
    web_origins: str = Field(default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173", alias="WEB_ORIGINS")
    session_ttl_seconds: int = Field(default=86_400, alias="SESSION_TTL_SECONDS", ge=900, le=2_592_000)
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    require_email_verification: bool = Field(default=True, alias="REQUIRE_EMAIL_VERIFICATION")
    expose_verification_token: bool = Field(default=False, alias="EXPOSE_VERIFICATION_TOKEN")
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT", ge=1, le=65535)
    smtp_username: str | None = Field(default=None, alias="SMTP_USERNAME")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    email_from: str | None = Field(default=None, alias="EMAIL_FROM")
    public_base_url: str = Field(default="http://localhost:3000", alias="PUBLIC_BASE_URL")

    @model_validator(mode="after")
    def validate_production(self):
        env = self.environment.strip().lower()
        if env not in {"development", "test", "staging", "production"}:
            raise ValueError("ENVIRONMENT must be development, test, staging, or production")
        if env == "production":
            if self.debug:
                raise ValueError("DEBUG must be false in production")
            if self.web_database_url.lower().startswith("sqlite"):
                raise ValueError("SQLite is not allowed in production")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
            configured_origins = [item.strip() for item in self.web_origins.split(",") if item.strip()]
            if not configured_origins or "*" in configured_origins:
                raise ValueError("WEB_ORIGINS must contain explicit origins and cannot use a wildcard in production")
            for origin in configured_origins:
                parsed_origin = urlsplit(origin)
                if parsed_origin.scheme != "https" or not parsed_origin.netloc or parsed_origin.path or parsed_origin.query or parsed_origin.fragment:
                    raise ValueError("WEB_ORIGINS must contain HTTPS origins only in production")
            if not self.public_base_url.startswith("https://"):
                raise ValueError("PUBLIC_BASE_URL must use HTTPS in production")
            if not self.require_email_verification:
                raise ValueError("REQUIRE_EMAIL_VERIFICATION must be true in production")
            if self.expose_verification_token:
                raise ValueError("EXPOSE_VERIFICATION_TOKEN must be false in production")
            if len(self.session_encryption_key) < 32:
                raise ValueError("SESSION_ENCRYPTION_KEY is required in production")
            if not all((self.smtp_host, self.smtp_username, self.smtp_password, self.email_from)):
                raise ValueError("SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and EMAIL_FROM are required in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
