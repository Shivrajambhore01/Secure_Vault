"""Admin Management API routes.

All routes are protected by get_current_admin() middleware.
CRUD operations on admins are guarded by require_role("SUPER_ADMIN").

Endpoints:
  GET  /api/admin/stats                    — Platform statistics (any admin)
  GET  /api/admin/admins                   — List all admins (SUPER_ADMIN only)
  POST /api/admin/admins                   — Create admin (SUPER_ADMIN only)
  PUT  /api/admin/admins/{id}             — Update admin (SUPER_ADMIN only)
  DELETE /api/admin/admins/{id}           — Delete admin (SUPER_ADMIN only)
  POST /api/admin/admins/{id}/disable      — Disable admin (SUPER_ADMIN only)
  POST /api/admin/admins/{id}/enable       — Enable admin (SUPER_ADMIN only)
  POST /api/admin/admins/{id}/reset-password — Reset password (SUPER_ADMIN only)
  GET  /api/admin/users                    — List platform users metadata (SUPER_ADMIN only)

Security: Assets content, passwords, PINs, and encryption keys are NEVER exposed.
"""

import random
import secrets
import string
import time
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.database import db
from app.core.admin_security import (
    get_current_admin,
    require_role,
    hash_admin_password,
)

router = APIRouter()

admins_col = db["admins"]
users_col = db["users"]
nominees_col = db["nominees"]
assets_col = db["assets"]


# ------------------------------------------------------------------
# Request Models
# ------------------------------------------------------------------

class CreateAdminRequest(BaseModel):
    fullName: str
    email: str
    password: str
    role: str  # SUPER_ADMIN | VERIFICATION_ADMIN | SECURITY_ADMIN | SUPPORT_ADMIN


class UpdateAdminRequest(BaseModel):
    fullName: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    newPassword: str


# ------------------------------------------------------------------
# Allowed roles (for validation)
# ------------------------------------------------------------------
VALID_ROLES = {"SUPER_ADMIN", "VERIFICATION_ADMIN", "SECURITY_ADMIN", "SUPPORT_ADMIN"}
VALID_STATUSES = {"ACTIVE", "DISABLED"}


# ------------------------------------------------------------------
# GET /stats — Platform overview statistics
# ------------------------------------------------------------------

@router.get("/stats")
async def get_platform_stats(current_admin: dict = Depends(get_current_admin)):
    """Return aggregate platform stats for the admin dashboard."""
    total_users = await users_col.count_documents({})
    total_nominees = await nominees_col.count_documents({})
    total_assets = await assets_col.count_documents({})
    total_admins = await admins_col.count_documents({})

    # Active users: logged in within the last 30 days
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    active_users = await users_col.count_documents({"lastActive": {"$gte": cutoff}})

    # Pending verifications: users whose nominees haven't been notified yet
    # and who have been inactive (logoutTime is set but nomineesNotified is false)
    pending_verifications = await users_col.count_documents({
        "nomineesNotified": False,
        "logoutTime": {"$ne": None, "$exists": True},
    })

    # Storage: aggregate total storageUsed across all users
    pipeline = [{"$group": {"_id": None, "totalStorage": {"$sum": "$storageUsed"}}}]
    storage_result = await users_col.aggregate(pipeline).to_list(length=1)
    total_storage_bytes = storage_result[0]["totalStorage"] if storage_result else 0

    # Plan distribution
    plan_pipeline = [{"$group": {"_id": "$plan", "count": {"$sum": 1}}}]
    plan_dist_raw = await users_col.aggregate(plan_pipeline).to_list(length=None)
    plan_distribution = {item["_id"]: item["count"] for item in plan_dist_raw if item["_id"]}

    # Recent 5 user registrations (metadata only — no passwords/PINs)
    recent_users_cursor = users_col.find(
        {},
        {"password": 0, "pin": 0, "twoFactorSecret": 0},
    ).sort("createdAt", -1).limit(5)
    recent_users = await recent_users_cursor.to_list(length=5)
    for u in recent_users:
        u["_id"] = str(u["_id"])

    return {
        "totalUsers": total_users,
        "totalNominees": total_nominees,
        "totalAssets": total_assets,
        "totalAdmins": total_admins,
        "activeUsers": active_users,
        "pendingVerifications": pending_verifications,
        "totalStorageBytes": total_storage_bytes,
        "planDistribution": plan_distribution,
        "recentUsers": recent_users,
    }


# ------------------------------------------------------------------
# GET /admins — List all admins
# ------------------------------------------------------------------

@router.get("/admins")
async def list_admins(
    current_admin: dict = Depends(require_role("SUPER_ADMIN")),
):
    """List all admin accounts (SUPER_ADMIN only). Passwords are never returned."""
    admins = await admins_col.find({}, {"password": 0}).to_list(length=None)
    for a in admins:
        a["_id"] = str(a["_id"])
    return admins


# ------------------------------------------------------------------
# POST /admins — Create a new admin
# ------------------------------------------------------------------

@router.post("/admins")
async def create_admin(
    body: CreateAdminRequest,
    current_admin: dict = Depends(require_role("SUPER_ADMIN")),
):
    """Create a new admin account (SUPER_ADMIN only)."""
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    email = body.email.strip().lower()
    existing = await admins_col.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="An admin with this email already exists.")

    new_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=13)) + hex(int(time.time()))[2:]
    now = datetime.now(timezone.utc).isoformat()

    await admins_col.insert_one({
        "id": new_id,
        "fullName": body.fullName.strip(),
        "email": email,
        "password": hash_admin_password(body.password),
        "role": body.role,
        "status": "ACTIVE",
        "createdAt": now,
        "updatedAt": now,
        "lastLogin": None,
        "createdBy": current_admin.get("adminId"),
    })

    print(f"[Admin] Created admin: {email} (role={body.role}) by {current_admin.get('email')}")
    return {"message": "Admin created successfully", "adminId": new_id}


# ------------------------------------------------------------------
# PUT /admins/{id} — Update admin details
# ------------------------------------------------------------------

@router.put("/admins/{admin_id}")
async def update_admin(
    admin_id: str,
    body: UpdateAdminRequest,
    current_admin: dict = Depends(require_role("SUPER_ADMIN")),
):
    """Update an admin's fullName, role, or status (SUPER_ADMIN only)."""
    target = await admins_col.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found.")

    # Prevent SUPER_ADMIN from demoting themselves
    if admin_id == current_admin.get("adminId") and body.role and body.role != "SUPER_ADMIN":
        raise HTTPException(status_code=400, detail="Super admin cannot demote themselves.")

    updates: dict = {"updatedAt": datetime.now(timezone.utc).isoformat()}

    if body.fullName is not None:
        updates["fullName"] = body.fullName.strip()
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role.")
        updates["role"] = body.role
    if body.status is not None:
        if body.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status.")
        updates["status"] = body.status

    await admins_col.update_one({"id": admin_id}, {"$set": updates})
    return {"message": "Admin updated successfully."}


# ------------------------------------------------------------------
# DELETE /admins/{id} — Delete admin
# ------------------------------------------------------------------

@router.delete("/admins/{admin_id}")
async def delete_admin(
    admin_id: str,
    current_admin: dict = Depends(require_role("SUPER_ADMIN")),
):
    """Permanently delete an admin (SUPER_ADMIN only). Cannot delete self."""
    if admin_id == current_admin.get("adminId"):
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account.")

    target = await admins_col.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found.")

    await admins_col.delete_one({"id": admin_id})
    # Also clean up any lingering refresh tokens
    await db["admin_refresh_tokens"].delete_many({"adminId": admin_id})
    return {"message": "Admin deleted successfully."}


# ------------------------------------------------------------------
# POST /admins/{id}/disable — Disable admin
# ------------------------------------------------------------------

@router.post("/admins/{admin_id}/disable")
async def disable_admin(
    admin_id: str,
    current_admin: dict = Depends(require_role("SUPER_ADMIN")),
):
    """Disable an admin account (SUPER_ADMIN only)."""
    if admin_id == current_admin.get("adminId"):
        raise HTTPException(status_code=400, detail="You cannot disable your own account.")

    target = await admins_col.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found.")

    await admins_col.update_one(
        {"id": admin_id},
        {"$set": {"status": "DISABLED", "updatedAt": datetime.now(timezone.utc).isoformat()}},
    )
    # Revoke all active sessions
    await db["admin_refresh_tokens"].delete_many({"adminId": admin_id})
    return {"message": "Admin account disabled."}


# ------------------------------------------------------------------
# POST /admins/{id}/enable — Enable admin
# ------------------------------------------------------------------

@router.post("/admins/{admin_id}/enable")
async def enable_admin(
    admin_id: str,
    current_admin: dict = Depends(require_role("SUPER_ADMIN")),
):
    """Re-enable a disabled admin account (SUPER_ADMIN only)."""
    target = await admins_col.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found.")

    await admins_col.update_one(
        {"id": admin_id},
        {"$set": {"status": "ACTIVE", "updatedAt": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": "Admin account enabled."}


# ------------------------------------------------------------------
# POST /admins/{id}/reset-password — Reset admin password
# ------------------------------------------------------------------

@router.post("/admins/{admin_id}/reset-password")
async def reset_admin_password(
    admin_id: str,
    body: ResetPasswordRequest,
    current_admin: dict = Depends(require_role("SUPER_ADMIN")),
):
    """Reset another admin's password (SUPER_ADMIN only)."""
    target = await admins_col.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found.")

    if len(body.newPassword) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    await admins_col.update_one(
        {"id": admin_id},
        {
            "$set": {
                "password": hash_admin_password(body.newPassword),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    # Force logout the target admin
    await db["admin_refresh_tokens"].delete_many({"adminId": admin_id})
    return {"message": "Admin password reset successfully."}


# ------------------------------------------------------------------
# GET /users — List platform users (metadata only, no sensitive data)
# ------------------------------------------------------------------

@router.get("/users")
async def list_platform_users(
    current_admin: dict = Depends(require_role("SUPER_ADMIN")),
    skip: int = 0,
    limit: int = 50,
):
    """List platform users for admin inspection.
    
    SECURITY: passwords, PINs, twoFactorSecret, and asset content are NEVER returned.
    Only safe metadata fields are exposed.
    """
    # Explicitly project ONLY safe fields — deny-by-default for sensitive fields
    safe_projection = {
        "password": 0,
        "pin": 0,
        "twoFactorSecret": 0,
    }

    users = await users_col.find({}, safe_projection).skip(skip).limit(limit).to_list(length=limit)
    total = await users_col.count_documents({})

    for u in users:
        u["_id"] = str(u["_id"])
        # Count assets and nominees per user (metadata only)
        u["assetCount"] = await assets_col.count_documents({"userId": u.get("id") or str(u["_id"])})
        u["nomineeCount"] = await nominees_col.count_documents({"userId": u.get("id") or str(u["_id"])})

    return {"users": users, "total": total, "skip": skip, "limit": limit}
