"""
Security & Token Service — SecureVault Enterprise
JWT encode/decode, refresh token rotation, and claims extraction.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import jwt
from app.core.config import get_settings
from app.domain.exceptions import UnauthorizedError

settings = get_settings()


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    import uuid
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRY_MINUTES)
    )
    payload.update({"exp": expire, "type": "access", "jti": uuid.uuid4().hex})
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    import uuid
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRY_DAYS)
    )
    payload.update({"exp": expire, "type": "refresh", "jti": uuid.uuid4().hex})
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def create_admin_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=8))
    payload.update({"exp": expire, "type": "admin"})
    return jwt.encode(payload, settings.ADMIN_JWT_SECRET, algorithm="HS256")


def decode_token(token: str, is_admin: bool = False) -> Dict[str, Any]:
    secret = settings.ADMIN_JWT_SECRET if is_admin else settings.JWT_SECRET
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Session has expired. Please log in again.", code="TOKEN_EXPIRED")
    except jwt.InvalidTokenError:
        raise UnauthorizedError("Invalid authentication token.", code="TOKEN_INVALID")
