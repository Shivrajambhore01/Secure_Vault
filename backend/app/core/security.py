"""JWT and password hashing utilities."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Request, HTTPException, Response

from app.core.config import get_settings

settings = get_settings()

# Password hashing context — bcrypt only
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ------------------------------------------------------------------
# Password Hashing
# ------------------------------------------------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash.
    Handles both $2a$ and $2b$ prefixes.
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def is_bcrypt_hash(value: str) -> bool:
    """Check if a string is a bcrypt hash."""
    return value.startswith("$2a$") or value.startswith("$2b$")


# ------------------------------------------------------------------
# JWT Token Handling
# ------------------------------------------------------------------

def generate_access_token(user_id: str, email: Optional[str] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRY_MINUTES)
    payload = {"userId": user_id, "exp": expire}
    if email:
        payload["email"] = email
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


async def generate_refresh_token(user_id: str, email: Optional[str] = None) -> str:
    import secrets
    from app.core.database import db
    
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRY_DAYS)
    jti = secrets.token_hex(16)
    payload = {"userId": user_id, "type": "refresh", "exp": expire, "jti": jti}
    if email:
        payload["email"] = email
        
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    
    # Store token in MongoDB
    await db["refresh_tokens"].insert_one({
        "_id": jti,
        "userId": user_id,
        "expiresAt": expire
    })
    return token


async def revoke_refresh_token(jti: str):
    from app.core.database import db
    await db["refresh_tokens"].delete_one({"_id": jti})


async def revoke_all_user_refresh_tokens(user_id: str):
    from app.core.database import db
    await db["refresh_tokens"].delete_many({"userId": user_id})


async def verify_and_consume_refresh_token(token: str) -> dict:
    from app.core.database import db
    
    decoded = decode_token(token)
    if decoded.get("type") != "refresh" or not decoded.get("jti"):
        raise JWTError("Invalid token type or missing jti")
        
    jti = decoded["jti"]
    # Atomically verify and consume the token
    result = await db["refresh_tokens"].find_one_and_delete({"_id": jti})
    if not result:
        raise JWTError("Token has been revoked or already used")
        
    return decoded


def generate_reset_token(user_id: str, token_type: str) -> str:
    """Generate a short-lived JWT for password/PIN reset."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    payload = {"userId": user_id, "type": token_type, "purpose": "reset", "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


# ------------------------------------------------------------------
# Cookie Helpers
# ------------------------------------------------------------------

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set HttpOnly auth cookies on the response."""
    is_production = settings.NODE_ENV == "production"

    response.set_cookie(
        key="accessToken",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="strict",
        max_age=settings.ACCESS_TOKEN_EXPIRY_MINUTES * 60,
    )
    response.set_cookie(
        key="refreshToken",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="strict",
        max_age=7 * 24 * 60 * 60,  # 7 days
    )


# ------------------------------------------------------------------
# Auth Middleware (Dependency)
# ------------------------------------------------------------------

async def get_current_user(request: Request) -> dict:
    """FastAPI dependency to extract and validate the JWT from cookies."""
    token = request.cookies.get("accessToken")
    if not token:
        raise HTTPException(status_code=401, detail="Access denied. No token provided.")

    try:
        decoded = decode_token(token)
        print(f"[Auth] Decoded Token UserId: {decoded.get('userId')}")
        return decoded
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
