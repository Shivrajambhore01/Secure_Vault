"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str

    # Encryption
    ENCRYPTION_KEY: str = "a_very_secret_key_that_is_32_chars!"

    # Server
    PORT: int = 5000

    # Email
    EMAIL_USER: str = ""
    EMAIL_PASS: str = ""

    # Twilio
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FLOW_SID: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Google OAuth
    GOOGLE_CLIENT_ID: str = Field(default="", alias="NEXT_PUBLIC_GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = ""

    # JWT (User)
    JWT_SECRET: str = Field(..., description="JWT signing secret - REQUIRED")
    ACCESS_TOKEN_EXPIRY_MINUTES: int = 60  # 1 hour
    REFRESH_TOKEN_EXPIRY_DAYS: int = 7

    # JWT (Admin) — completely separate secret so user tokens cannot access admin routes
    ADMIN_JWT_SECRET: str = Field(..., description="Admin JWT signing secret - REQUIRED")
    ADMIN_JWT_EXPIRY_MINUTES: int = 120  # 2 hours

    # Inactivity
    INACTIVITY_TEST_MODE: bool = False

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Environment
    NODE_ENV: str = "development"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
