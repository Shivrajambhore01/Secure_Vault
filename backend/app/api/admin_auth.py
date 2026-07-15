"""Admin Authentication API routes.

Endpoints:
  POST /api/admin/auth/login          — Admin login (email + password)
  POST /api/admin/auth/logout         — Admin logout (clears cookies)
  POST /api/admin/auth/refresh        — Refresh admin access token
  GET  /api/admin/auth/me             — Get current logged-in admin profile

These routes are COMPLETELY SEPARATE from user auth (/api/auth/*).
They use adminAccessToken / adminRefreshToken cookies, not the user cookies.
"""

import random
import string
import time
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel

from app.core.database import db
from app.core.admin_security import (
    hash_admin_password,
    verify_admin_password,
    generate_admin_access_token,
    generate_admin_refresh_token,
    verify_and_consume_admin_refresh_token,
    revoke_all_admin_refresh_tokens,
    set_admin_auth_cookies,
    delete_admin_auth_cookies,
    get_current_admin,
    decode_admin_token,
)
from jose import JWTError

router = APIRouter()
admins_col = db["admins"]


# ------------------------------------------------------------------
# Request Models
# ------------------------------------------------------------------

class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


# ------------------------------------------------------------------
# POST /login
# ------------------------------------------------------------------

@router.post("/login")
async def admin_login(body: AdminLoginRequest, response: Response, request: Request):
    """Authenticate an admin. Sets adminAccessToken + adminRefreshToken cookies."""
    email = body.email.strip().lower()

    admin = await admins_col.find_one({"email": email})
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    if admin.get("status") != "ACTIVE":
        raise HTTPException(status_code=403, detail="Admin account is disabled.")

    if not verify_admin_password(body.password, admin["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    admin_id = admin["id"]
    role = admin["role"]

    # Generate tokens
    access_token = generate_admin_access_token(admin_id, email, role)
    refresh_token = await generate_admin_refresh_token(admin_id, email, role)

    # Set cookies
    set_admin_auth_cookies(response, access_token, refresh_token)

    # Update lastLogin
    await admins_col.update_one(
        {"id": admin_id},
        {"$set": {"lastLogin": datetime.now(timezone.utc).isoformat()}},
    )

    print(f"[Admin Auth] Admin logged in: {email} (role={role})")
    return {
        "message": "Admin login successful",
        "admin": {
            "id": admin_id,
            "fullName": admin["fullName"],
            "email": admin["email"],
            "role": admin["role"],
            "status": admin["status"],
            "lastLogin": admin.get("lastLogin"),
        },
    }


# ------------------------------------------------------------------
# POST /logout
# ------------------------------------------------------------------

@router.post("/logout")
async def admin_logout(
    request: Request,
    response: Response,
    current_admin: dict = Depends(get_current_admin),
):
    """Log out the current admin. Clears cookies and revokes all refresh tokens."""
    try:
        await revoke_all_admin_refresh_tokens(current_admin.get("adminId"))
    except Exception as e:
        print(f"[Admin Auth] Token revocation warning: {e}")

    delete_admin_auth_cookies(response)
    print(f"[Admin Auth] Admin logged out: {current_admin.get('email')}")
    return {"message": "Admin logged out successfully"}


# ------------------------------------------------------------------
# POST /refresh
# ------------------------------------------------------------------

@router.post("/refresh")
async def admin_refresh_token(request: Request, response: Response):
    """Refresh the admin access token using the adminRefreshToken cookie."""
    refresh_token = request.cookies.get("adminRefreshToken")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No admin refresh token found.")

    try:
        decoded = await verify_and_consume_admin_refresh_token(refresh_token)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired admin refresh token: {e}")

    admin_id = decoded.get("adminId")
    email = decoded.get("email")
    role = decoded.get("role")

    # Verify admin is still active
    admin = await admins_col.find_one({"id": admin_id})
    if not admin or admin.get("status") != "ACTIVE":
        raise HTTPException(status_code=401, detail="Admin account not found or disabled.")

    new_access = generate_admin_access_token(admin_id, email, role)
    new_refresh = await generate_admin_refresh_token(admin_id, email, role)
    set_admin_auth_cookies(response, new_access, new_refresh)

    return {"message": "Admin token refreshed"}


# ------------------------------------------------------------------
# GET /me
# ------------------------------------------------------------------

@router.get("/me")
async def admin_get_me(current_admin: dict = Depends(get_current_admin)):
    """Return the currently authenticated admin's profile."""
    admin = await admins_col.find_one(
        {"id": current_admin.get("adminId")},
        {"password": 0},  # Never return the hashed password
    )
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")

    admin["_id"] = str(admin["_id"])
    return admin


# ------------------------------------------------------------------
# POST /change-password
# ------------------------------------------------------------------

@router.post("/change-password")
async def admin_change_password(
    body: AdminChangePasswordRequest,
    current_admin: dict = Depends(get_current_admin),
):
    """Allow an admin to change their own password."""
    admin = await admins_col.find_one({"id": current_admin.get("adminId")})
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")

    if not verify_admin_password(body.currentPassword, admin["password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")

    if len(body.newPassword) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")

    new_hashed = hash_admin_password(body.newPassword)
    await admins_col.update_one(
        {"id": current_admin.get("adminId")},
        {"$set": {"password": new_hashed, "updatedAt": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": "Password changed successfully."}
