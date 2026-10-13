from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    app_name: str = Field(default="ORDIUM API", alias="APP_NAME")
    app_version: str = Field(default="1.5.2", alias="APP_VERSION")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")

    database_url: str = Field(alias="DATABASE_URL")
    secret_key: str = Field(alias="SECRET_KEY", min_length=32)
    network_intelligence_provider: str = Field(default="mock", alias="NETWORK_INTELLIGENCE_PROVIDER")
    ipqs_api_key: str | None = Field(default=None, alias="IPQS_API_KEY")
    ipqs_timeout_seconds: float = Field(default=0.75, alias="IPQS_TIMEOUT_SECONDS", gt=0, le=10)
    ipqs_cache_ttl_seconds: int = Field(default=3600, alias="IPQS_CACHE_TTL_SECONDS", ge=0, le=86400)
    ipqs_cache_max_entries: int = Field(default=10000, alias="IPQS_CACHE_MAX_ENTRIES", ge=100, le=100000)
    ipqs_strictness: int = Field(default=1, alias="IPQS_STRICTNESS", ge=0, le=3)
    ipqs_max_concurrent_lookups: int = Field(default=50, alias="IPQS_MAX_CONCURRENT_LOOKUPS", ge=1, le=200)
    trusted_proxy_networks: str = Field(default="", alias="TRUSTED_PROXY_NETWORKS")
    allowed_hosts: str = Field(default="", alias="ALLOWED_HOSTS")
    enable_docs: bool = Field(default=True, alias="ENABLE_DOCS")
    cors_allowed_origins: str = Field(default="", alias="CORS_ALLOWED_ORIGINS")
    ordium_internal_shared_secret: str = Field(default="", alias="ORDIUM_INTERNAL_SHARED_SECRET")
    shopify_webhook_secret: str = Field(default="", alias="SHOPIFY_WEBHOOK_SECRET")
    shopify_store_map: str = Field(default="", alias="SHOPIFY_STORE_MAP")
    omniterra_webhook_secret: str = Field(default="", alias="OMNITERRA_WEBHOOK_SECRET")
    omniterra_signature_header: str = Field(default="X-Omniterra-Hmac-Sha256", alias="OMNITERRA_SIGNATURE_HEADER")
    omniterra_event_id_header: str = Field(default="X-Omniterra-Webhook-Id", alias="OMNITERRA_EVENT_ID_HEADER")
    omniterra_store_map: str = Field(default="", alias="OMNITERRA_STORE_MAP")
    max_request_body_bytes: int = Field(default=1_048_576, alias="MAX_REQUEST_BODY_BYTES", ge=16_384, le=10_485_760)
    live_requests_per_minute: int = Field(default=120, alias="LIVE_REQUESTS_PER_MINUTE", ge=1, le=100_000)
    test_requests_per_minute: int = Field(default=300, alias="TEST_REQUESTS_PER_MINUTE", ge=1, le=100_000)
    live_requests_per_minute_per_merchant: int = Field(default=600, alias="LIVE_REQUESTS_PER_MINUTE_PER_MERCHANT", ge=1, le=1_000_000)
    test_requests_per_minute_per_merchant: int = Field(default=1500, alias="TEST_REQUESTS_PER_MINUTE_PER_MERCHANT", ge=1, le=1_000_000)
    idempotency_ttl_seconds: int = Field(default=86_400, alias="IDEMPOTENCY_TTL_SECONDS", ge=60, le=604_800)
    db_pool_size: int = Field(default=5, alias="DB_POOL_SIZE", ge=1, le=100)
    db_max_overflow: int = Field(default=10, alias="DB_MAX_OVERFLOW", ge=0, le=100)
    db_pool_timeout_seconds: int = Field(default=10, alias="DB_POOL_TIMEOUT_SECONDS", ge=1, le=120)
    db_pool_recycle_seconds: int = Field(default=1800, alias="DB_POOL_RECYCLE_SECONDS", ge=60, le=86_400)

    @model_validator(mode="after")
    def validate_provider_configuration(self):
        environment = self.environment.strip().lower()
        provider = self.network_intelligence_provider.strip().lower()
        if environment not in {"development", "test", "staging", "production"}:
            raise ValueError("ENVIRONMENT must be development, test, staging, or production")
        if provider == "ipqs" and not self.ipqs_api_key:
            raise ValueError("IPQS_API_KEY is required when NETWORK_INTELLIGENCE_PROVIDER=ipqs")
        if environment == "production":
            if self.debug:
                raise ValueError("DEBUG must be false in production")
            if self.enable_docs:
                raise ValueError("ENABLE_DOCS must be false in production")
            if not self.allowed_hosts.strip():
                raise ValueError("ALLOWED_HOSTS is required in production")
            if self.database_url.lower().startswith("sqlite"):
                raise ValueError("SQLite is not allowed in production")
            if provider == "mock":
                raise ValueError("NETWORK_INTELLIGENCE_PROVIDER=mock is not allowed in production")
            if self.allowed_hosts.strip() == "*":
                raise ValueError("ALLOWED_HOSTS=* is not allowed in production")
            if "*" in {origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()}:
                raise ValueError("Wildcard CORS origin is not allowed in production")
            if len(self.ordium_internal_shared_secret) < 32:
                raise ValueError("ORDIUM_INTERNAL_SHARED_SECRET is required in production")
            self._validate_trusted_proxy_networks()
            self._validate_production_dependency_versions()
        return self


    def _validate_trusted_proxy_networks(self) -> None:
        import ipaddress

        for raw in self.trusted_proxy_networks.split(","):
            raw = raw.strip()
            if not raw:
                continue
            try:
                network = ipaddress.ip_network(raw, strict=False)
            except ValueError as exc:
                raise ValueError(f"Invalid TRUSTED_PROXY_NETWORKS entry: {raw}") from exc
            if network.prefixlen == 0:
                raise ValueError("TRUSTED_PROXY_NETWORKS cannot contain a /0 network")

    @staticmethod
    def _validate_production_dependency_versions() -> None:
        from importlib.metadata import PackageNotFoundError, version
        from packaging.version import Version

        minimums = {
            "fastapi": "0.133.1",
            "starlette": "1.3.1",
            "pydantic-settings": "2.14.2",
            "cryptography": "50.0.0",
        }
        for package, minimum in minimums.items():
            try:
                installed = Version(version(package))
            except PackageNotFoundError as exc:
                raise ValueError(f"Required production dependency is missing: {package}") from exc
            if installed < Version(minimum):
                raise ValueError(
                    f"Insecure production dependency: {package} {installed} < {minimum}"
                )


@lru_cache

def get_settings() -> Settings:
    return Settings()


settings = get_settings()
