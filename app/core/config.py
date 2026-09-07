from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict



class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables.
    """

    database_url: str = Field(alias="DATABASE_URL")
    secret_key: str = Field(alias="SECRET_KEY")
    debug: bool = Field(default=False, alias="DEBUG")

    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    app_name: str = Field(default="Shield API")
    app_version: str = Field(default="1.0.0")

    environment: str = Field(default="development")

    debug: bool = Field(default=False)

    database_url: str

    secret_key: str


@lru_cache
def get_settings() -> Settings:
    """
    Load settings only once.
    """
    return Settings()


settings = get_settings()