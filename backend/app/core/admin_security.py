"""Admin JWT and auth utilities — completely separate from user security.py.

This module uses ADMIN_JWT_SECRET (different from user JWT_SECRET) which means:
- A stolen user access token cannot be used on any admin endpoint.
- Admin cookies have different names (adminAccessToken / adminRefreshToken)
  so there is zero cross-contamination with user sessions.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Request, HTTPException, Response

from app.core.config import get_settings
from app.core.database import db

settings = get_settings()

# Bcrypt context — shared algorithm, isolated instance
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ------------------------------------------------------------------
# Password Hashing (Admin passwords)
# ------------------------------------------------------------------

def hash_admin_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_admin_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


# ------------------------------------------------------------------
# Admin JWT — uses ADMIN_JWT_SECRET, NOT JWT_SECRET
# ------------------------------------------------------------------

def generate_admin_access_token(admin_id: str, email: str, role: str) -> str:
    """Generate a short-lived admin access token signed with ADMIN_JWT_SECRET."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ADMIN_JWT_EXPIRY_MINUTES
    )
    payload = {
        "adminId": admin_id,
        "email": email,
        "role": role,
        "type": "admin_access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.ADMIN_JWT_SECRET, algorithm="HS256")


async def generate_admin_refresh_token(admin_id: str, email: str, role: str) -> str:
    """Generate a 7-day admin refresh token and store its jti in MongoDB."""
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    jti = secrets.token_hex(16)
    payload = {
        "adminId": admin_id,
        "email": email,
        "role": role,
        "type": "admin_refresh",
        "jti": jti,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.ADMIN_JWT_SECRET, algorithm="HS256")
    await db["admin_refresh_tokens"].insert_one({
        "_id": jti,
        "adminId": admin_id,
        "expiresAt": expire,
    })
    return token


def decode_admin_token(token: str) -> dict:
    """Decode and verify a token using ADMIN_JWT_SECRET."""
    return jwt.decode(token, settings.ADMIN_JWT_SECRET, algorithms=["HS256"])


async def verify_and_consume_admin_refresh_token(token: str) -> dict:
    """Verify and atomically consume an admin refresh token."""
    decoded = decode_admin_token(token)
    if decoded.get("type") != "admin_refresh" or not decoded.get("jti"):
        raise JWTError("Invalid admin token type")

    jti = decoded["jti"]
    result = await db["admin_refresh_tokens"].find_one_and_delete({"_id": jti})
    if not result:
        raise JWTError("Admin token has been revoked or already used")

    return decoded


async def revoke_all_admin_refresh_tokens(admin_id: str):
    await db["admin_refresh_tokens"].delete_many({"adminId": admin_id})


# ------------------------------------------------------------------
# Admin Cookie Helpers
# ------------------------------------------------------------------

def set_admin_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set HttpOnly admin cookies using DIFFERENT names from user cookies."""
    is_production = (
        settings.NODE_ENV == "production"
        or "onrender.com" in settings.FRONTEND_URL
        or "vercel.app" in settings.FRONTEND_URL
    )
    samesite = "none" if is_production else "lax"
    secure = is_production

    response.set_cookie(
        key="adminAccessToken",          # Different from user "accessToken"
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.ADMIN_JWT_EXPIRY_MINUTES * 60,
    )
    response.set_cookie(
        key="adminRefreshToken",         # Different from user "refreshToken"
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=7 * 24 * 60 * 60,
    )


def delete_admin_auth_cookies(response: Response):
    """Clear admin cookies."""
    is_production = (
        settings.NODE_ENV == "production"
        or "onrender.com" in settings.FRONTEND_URL
        or "vercel.app" in settings.FRONTEND_URL
    )
    samesite = "none" if is_production else "lax"
    secure = is_production

    response.delete_cookie("adminAccessToken", secure=secure, samesite=samesite)
    response.delete_cookie("adminRefreshToken", secure=secure, samesite=samesite)


# ------------------------------------------------------------------
# Auth Dependency: get_current_admin
# ------------------------------------------------------------------

async def get_current_admin(request: Request) -> dict:
    """FastAPI dependency — reads adminAccessToken cookie (not user accessToken).

    Returns the decoded admin payload: { adminId, email, role, ... }
    Raises HTTP 401 if missing or invalid.
    """
    token = request.cookies.get("adminAccessToken")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Admin access denied. No admin token provided.",
        )
    try:
        decoded = decode_admin_token(token)
        # Extra guard: ensure this is genuinely an admin token
        if decoded.get("type") != "admin_access":
            raise JWTError("Not an admin access token")

        # Verify the admin still exists and is ACTIVE in the DB
        admin = await db["admins"].find_one({"id": decoded.get("adminId")})
        if not admin or admin.get("status") != "ACTIVE":
            raise HTTPException(status_code=401, detail="Admin account inactive or not found.")

        return decoded
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token.")


# ------------------------------------------------------------------
# RBAC Dependency Factory: require_role
# ------------------------------------------------------------------

def require_role(*allowed_roles: str):
    """Returns a FastAPI dependency that enforces role-based access.

    Usage:
        @router.get("/admins", dependencies=[Depends(require_role("SUPER_ADMIN"))])
    """
    async def _check(request: Request):
        admin = await get_current_admin(request)
        if admin.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}.",
            )
        return admin
    return _check
