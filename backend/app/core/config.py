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
    ADMIN_JWT_SECRET: str = Field(default="admin_jwt_secret_key_change_in_production_98765", description="Admin JWT signing secret")
    ADMIN_JWT_EXPIRY_MINUTES: int = 120  # 2 hours

    # Inactivity
    INACTIVITY_TEST_MODE: bool = False

    # Death Verification Workflow
    # Set COOLING_PERIOD_DAYS=0 in .env for instant testing (skips 30-day wait)
    COOLING_PERIOD_DAYS: int = 30
    VERIFICATION_OTP_MAX_ATTEMPTS: int = 3
    VERIFICATION_OTP_EXPIRY_MINUTES: int = 10

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Object Storage Backend
    # Options: 'mongodb' (default), 'local' (dev filesystem), 'minio', 's3'
    # MongoDB is the current production backend — no extra services needed.
    # Switch to 'minio' or 's3' when file volume requires dedicated object storage.
    STORAGE_BACKEND: str = "mongodb"
    STORAGE_BUCKET: str = "securevault-documents"

    # MinIO / S3 Credentials (used when STORAGE_BACKEND=minio or s3)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False

    # Redis (used for rate limiting and caching when available)
    REDIS_URL: str = ""

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    OTP_RATE_LIMIT_PER_HOUR: int = 5

    # Security Headers
    ENABLE_SECURITY_HEADERS: bool = True

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
