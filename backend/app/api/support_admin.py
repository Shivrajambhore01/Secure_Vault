"""Support Admin API endpoints — SecureVault Enterprise.

Provides customer-support functionality: user search, profile inspection
(read-only metadata), credential resets, account lock/unlock, 2FA recovery,
and verification-email resends.

RBAC: Only SUPPORT_ADMIN or SUPER_ADMIN can access these routes.
No decrypted asset content is ever returned.
Every mutating action is audit-logged.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.database import db
from app.core.admin_security import get_current_admin, require_role
from app.core.security import hash_password, revoke_all_user_refresh_tokens
from app.lib.audit import write_audit_log

router = APIRouter()
settings = get_settings()

# Collections
users_col = db["users"]
assets_col = db["assets"]
nominees_col = db["nominees"]
sessions_col = db["sessions"]
audit_col = db["audit_logs"]

# ------------------------------------------------------------------
# Request Models
# ------------------------------------------------------------------

class ResetPasswordRequest(BaseModel):
    newPassword: str

class ResetPinRequest(BaseModel):
    newPin: str

class LockUserRequest(BaseModel):
    reason: str = "Locked by Support Admin"

# ------------------------------------------------------------------
# Helpers — email (reuses the same SMTP logic from auth.py)
# ------------------------------------------------------------------

async def _send_email(to: str, subject: str, html: str):
    """Send an email via Gmail SMTP. Falls back to console log in dev."""
    if settings.EMAIL_USER and settings.EMAIL_PASS:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart("alternative")
        msg["From"] = settings.EMAIL_USER
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))

        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.EMAIL_USER,
            password=settings.EMAIL_PASS,
        )
    else:
        print(f"[DEV MODE] Would send email to {to}: {subject}")


async def _send_verification_email(email: str, token: str, full_name: str):
    frontend_url = settings.FRONTEND_URL
    verification_url = f"{frontend_url}/verify?token={token}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #3b82f6;">Email Verification — SecureVault</h2>
        <p>Hello {full_name},</p>
        <p>A support administrator has requested a new verification email for your account. Please click the button below to verify your email address.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{verification_url}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify Email Address</a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #64748b;">{verification_url}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 12px; color: #64748b;">This link will expire in 24 hours.</p>
    </div>
    """
    await _send_email(email, "Verify your Email - SecureVault", html)


# ------------------------------------------------------------------
# GET /stats — Support dashboard overview
# ------------------------------------------------------------------
@router.get("/stats")
async def get_support_stats(
    current_admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN"))
):
    total_users = await users_col.count_documents({})
    verified_users = await users_col.count_documents({"isVerified": True})
    unverified_users = total_users - verified_users

    locked_accounts = await users_col.count_documents({
        "$or": [
            {"accountLocked": True},
            {"lockedUntil": {"$gt": datetime.now(timezone.utc).isoformat()}}
        ]
    })

    # Users inactive > 30 days
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    inactive_users = await users_col.count_documents({
        "lastActive": {"$lt": cutoff}
    })

    # 2FA enabled users
    twofa_users = await users_col.count_documents({"isTwoFactorEnabled": True})

    # Recent support actions (last 24 hours)
    day_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent_support_actions = await audit_col.count_documents({
        "action": {"$regex": "SUPPORT|RESET|UNLOCK|RESEND|DISABLE_2FA", "$options": "i"},
        "actorType": "ADMIN",
        "timestamp": {"$gte": day_ago}
    })

    return {
        "totalUsers": total_users,
        "verifiedUsers": verified_users,
        "unverifiedUsers": unverified_users,
        "lockedAccounts": locked_accounts,
        "inactiveUsers": inactive_users,
        "twofaUsers": twofa_users,
        "recentSupportActions": recent_support_actions,
    }


# ------------------------------------------------------------------
# GET /users — User search (paginated)
# ------------------------------------------------------------------
@router.get("/users")
async def search_users(
    current_admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
):
    safe_projection = {
        "password": 0,
        "pin": 0,
        "twoFactorSecret": 0,
        "tempTwoFactorSecret": 0,
    }

    query = {}
    if search:
        s = search.strip()
        query["$or"] = [
            {"email": {"$regex": s, "$options": "i"}},
            {"fullName": {"$regex": s, "$options": "i"}},
        ]
        try:
            query["$or"].append({"_id": ObjectId(s)})
        except Exception:
            pass

    users = await users_col.find(query, safe_projection).sort("createdAt", -1).skip(skip).limit(limit).to_list(length=limit)
    total = await users_col.count_documents(query)

    for u in users:
        u["_id"] = str(u["_id"])

    return {"users": users, "total": total, "skip": skip, "limit": limit}


# ------------------------------------------------------------------
# GET /users/{user_id} — User profile detail (read-only metadata)
# ------------------------------------------------------------------
@router.get("/users/{user_id}")
async def get_user_profile(
    user_id: str,
    current_admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    user = await users_col.find_one(
        {"_id": ObjectId(user_id)},
        {"password": 0, "pin": 0, "twoFactorSecret": 0, "tempTwoFactorSecret": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user["_id"] = str(user["_id"])

    # Asset metadata (NO decrypted content, NO encryption keys)
    asset_projection = {
        "fileName": 1,
        "fileType": 1,
        "fileSize": 1,
        "category": 1,
        "createdAt": 1,
        "updatedAt": 1,
    }
    assets = await assets_col.find(
        {"userId": user_id}, asset_projection
    ).to_list(length=100)
    for a in assets:
        a["_id"] = str(a["_id"])

    # Nominee metadata
    nominee_projection = {
        "nomineeName": 1,
        "nomineeEmail": 1,
        "relationship": 1,
        "createdAt": 1,
    }
    nominees = await nominees_col.find(
        {"userId": user_id}, nominee_projection
    ).to_list(length=50)
    for n in nominees:
        n["_id"] = str(n["_id"])

    user["assets"] = assets
    user["nominees"] = nominees
    user["assetCount"] = len(assets)
    user["nomineeCount"] = len(nominees)

    return user


# ------------------------------------------------------------------
# POST /users/{user_id}/lock — Lock account
# ------------------------------------------------------------------
@router.post("/users/{user_id}/lock")
async def lock_user(
    user_id: str,
    body: LockUserRequest,
    request: Request,
    current_admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "accountLocked": True,
            "lockedAt": datetime.now(timezone.utc).isoformat(),
            "lockedBy": current_admin.get("adminId"),
            "lockReason": body.reason,
        }}
    )

    # Force logout
    await revoke_all_user_refresh_tokens(user_id)
    await sessions_col.delete_many({"userId": user_id})

    await write_audit_log(
        action="SUPPORT_LOCK_ACCOUNT",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=current_admin.get("adminId"),
        actor_email=current_admin.get("email"),
        resource_type="USER",
        resource_id=user_id,
        reason=body.reason,
        request=request,
    )

    return {"message": "User account locked and all sessions revoked."}


# ------------------------------------------------------------------
# POST /users/{user_id}/unlock — Unlock account
# ------------------------------------------------------------------
@router.post("/users/{user_id}/unlock")
async def unlock_user(
    user_id: str,
    request: Request,
    current_admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "accountLocked": False,
            "lockedAt": None,
            "lockedBy": None,
            "lockReason": None,
            "failedLoginAttempts": 0,
            "lockedUntil": None,
        }}
    )

    await write_audit_log(
        action="SUPPORT_UNLOCK_ACCOUNT",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=current_admin.get("adminId"),
        actor_email=current_admin.get("email"),
        resource_type="USER",
        resource_id=user_id,
        reason="Support admin unlocked user account",
        request=request,
    )

    return {"message": "User account unlocked successfully."}


# ------------------------------------------------------------------
# POST /users/{user_id}/reset-password — Force-reset password
# ------------------------------------------------------------------
@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    body: ResetPasswordRequest,
    request: Request,
    current_admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if len(body.newPassword) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    hashed = hash_password(body.newPassword)
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": hashed, "failedLoginAttempts": 0, "lockedUntil": None}}
    )

    await write_audit_log(
        action="SUPPORT_RESET_PASSWORD",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=current_admin.get("adminId"),
        actor_email=current_admin.get("email"),
        resource_type="USER",
        resource_id=user_id,
        reason="Support admin force-reset user password",
        request=request,
    )

    return {"message": "Password reset successfully."}


# ------------------------------------------------------------------
# POST /users/{user_id}/reset-pin — Force-reset PIN
# ------------------------------------------------------------------
@router.post("/users/{user_id}/reset-pin")
async def reset_user_pin(
    user_id: str,
    body: ResetPinRequest,
    request: Request,
    current_admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if len(body.newPin) < 4:
        raise HTTPException(status_code=400, detail="PIN must be at least 4 digits.")

    hashed = hash_password(body.newPin)
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"pin": hashed}}
    )

    await write_audit_log(
        action="SUPPORT_RESET_PIN",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=current_admin.get("adminId"),
        actor_email=current_admin.get("email"),
        resource_type="USER",
        resource_id=user_id,
        reason="Support admin force-reset user PIN",
        request=request,
    )

    return {"message": "PIN reset successfully."}


# ------------------------------------------------------------------
# POST /users/{user_id}/disable-2fa — Account recovery (disable 2FA)
# ------------------------------------------------------------------
@router.post("/users/{user_id}/disable-2fa")
async def disable_user_2fa(
    user_id: str,
    request: Request,
    current_admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not user.get("isTwoFactorEnabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled for this user.")

    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {"isTwoFactorEnabled": False},
            "$unset": {"twoFactorSecret": "", "tempTwoFactorSecret": ""},
        }
    )

    await write_audit_log(
        action="SUPPORT_DISABLE_2FA",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=current_admin.get("adminId"),
        actor_email=current_admin.get("email"),
        resource_type="USER",
        resource_id=user_id,
        reason="Support admin disabled 2FA for account recovery",
        request=request,
    )

    return {"message": "Two-factor authentication disabled for user."}


# ------------------------------------------------------------------
# POST /users/{user_id}/resend-verification — Re-send activation email
# ------------------------------------------------------------------
@router.post("/users/{user_id}/resend-verification")
async def resend_verification(
    user_id: str,
    request: Request,
    current_admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.get("isVerified"):
        raise HTTPException(status_code=400, detail="User email is already verified.")

    # Generate new verification token
    new_token = secrets.token_hex(32)
    expiry = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"verificationToken": new_token, "verificationTokenExpires": expiry}}
    )

    await _send_verification_email(user["email"], new_token, user.get("fullName", "User"))

    await write_audit_log(
        action="SUPPORT_RESEND_VERIFICATION",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=current_admin.get("adminId"),
        actor_email=current_admin.get("email"),
        resource_type="USER",
        resource_id=user_id,
        reason="Support admin re-sent verification email",
        request=request,
    )

    return {"message": "Verification email sent successfully."}
