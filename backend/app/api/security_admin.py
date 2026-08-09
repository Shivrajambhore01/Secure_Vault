"""Security & Audit Admin API endpoints — SecureVault Enterprise.

Enforces RBAC: Only SECURITY_ADMIN or SUPER_ADMIN can access.
No raw or decrypted asset access is ever permitted here.
All admin modifications are audit-logged.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.core.database import db
from app.core.admin_security import get_current_admin, require_role
from app.lib.audit import write_audit_log
from app.core.security import revoke_all_user_refresh_tokens, revoke_refresh_token

router = APIRouter()

# Collections
users_col = db["users"]
audit_col = db["audit_logs"]
sessions_col = db["sessions"]
refresh_tokens_col = db["refresh_tokens"]

class LockUserRequest(BaseModel):
    reason: str

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def parse_date(date_str: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except Exception:
        return None

# ------------------------------------------------------------------
# GET /stats — Security & Audit Overview Dashboard Stats
# ------------------------------------------------------------------
@router.get("/stats")
async def get_security_stats(current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN"))):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Logins today (successful)
    logins_today = await audit_col.count_documents({
        "action": {"$in": ["LOGIN", "USER_LOGIN", "ADMIN_LOGIN", "GOOGLE_LOGIN", "LOGIN_2FA"]},
        "result": "SUCCESS",
        "timestamp": {"$gte": today_start}
    })

    # Failed login attempts today
    failed_logins_today = await audit_col.count_documents({
        "action": {"$in": ["LOGIN", "USER_LOGIN", "ADMIN_LOGIN", "GOOGLE_LOGIN", "LOGIN_2FA"]},
        "result": "FAILURE",
        "timestamp": {"$gte": today_start}
    })

    # Active user sessions
    active_sessions = await sessions_col.count_documents({})

    # Locked user accounts
    locked_accounts = await users_col.count_documents({
        "$or": [
            {"accountLocked": True},
            {"lockedUntil": {"$gt": now.isoformat()}}
        ]
    })

    # OTP requests today
    otp_requests_today = await audit_col.count_documents({
        "action": {"$in": ["SEND_OTP", "OTP_VERIFY"]},
        "timestamp": {"$gte": today_start}
    })

    # Recent security alerts count
    alerts_count = await audit_col.count_documents({
        "action": {"$in": ["ACCOUNT_LOCKOUT", "SUSPICIOUS_LOGIN"]},
        "timestamp": {"$gte": today_start}
    })

    return {
        "loginsToday": logins_today,
        "failedLoginsToday": failed_logins_today,
        "activeSessions": active_sessions,
        "lockedAccounts": locked_accounts,
        "otpRequestsToday": otp_requests_today,
        "alertsCount": alerts_count
    }

# ------------------------------------------------------------------
# GET /login-history — Paginated & searchable login logs
# ------------------------------------------------------------------
@router.get("/login-history")
async def get_login_history(
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN")),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    query = {
        "action": {"$in": ["LOGIN", "USER_LOGIN", "ADMIN_LOGIN", "GOOGLE_LOGIN", "LOGIN_2FA"]}
    }

    if search:
        s = search.strip()
        query["$or"] = [
            {"actorEmail": {"$regex": s, "$options": "i"}},
            {"ipAddress": {"$regex": s, "$options": "i"}},
            {"actorId": {"$regex": s, "$options": "i"}},
            {"reason": {"$regex": s, "$options": "i"}}
        ]

    cursor = audit_col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    total = await audit_col.count_documents(query)

    for log in logs:
        log["_id"] = str(log["_id"])

    return {"logs": logs, "total": total, "skip": skip, "limit": limit}

# ------------------------------------------------------------------
# GET /failed-logins — Paginated failed logins only
# ------------------------------------------------------------------
@router.get("/failed-logins")
async def get_failed_logins(
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN")),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    query = {
        "action": {"$in": ["LOGIN", "USER_LOGIN", "ADMIN_LOGIN", "GOOGLE_LOGIN", "LOGIN_2FA"]},
        "result": "FAILURE"
    }

    if search:
        s = search.strip()
        query["$or"] = [
            {"actorEmail": {"$regex": s, "$options": "i"}},
            {"ipAddress": {"$regex": s, "$options": "i"}},
            {"reason": {"$regex": s, "$options": "i"}}
        ]

    cursor = audit_col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    total = await audit_col.count_documents(query)

    for log in logs:
        log["_id"] = str(log["_id"])

    return {"logs": logs, "total": total, "skip": skip, "limit": limit}

# ------------------------------------------------------------------
# GET /otp-logs — Paginated OTP actions
# ------------------------------------------------------------------
@router.get("/otp-logs")
async def get_otp_logs(
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN")),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    query = {
        "action": {"$in": ["SEND_OTP", "OTP_VERIFY", "OTP_VERIFIED", "SEND_EMAIL_OTP", "VERIFY_EMAIL_OTP"]}
    }

    if search:
        s = search.strip()
        query["$or"] = [
            {"actorEmail": {"$regex": s, "$options": "i"}},
            {"ipAddress": {"$regex": s, "$options": "i"}},
            {"actorId": {"$regex": s, "$options": "i"}}
        ]

    cursor = audit_col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    total = await audit_col.count_documents(query)

    for log in logs:
        log["_id"] = str(log["_id"])

    return {"logs": logs, "total": total, "skip": skip, "limit": limit}

# ------------------------------------------------------------------
# GET /user-activity — Paginated user actions
# ------------------------------------------------------------------
@router.get("/user-activity")
async def get_user_activity(
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN")),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    query = {
        "actorType": "USER"
    }

    if search:
        s = search.strip()
        query["$or"] = [
            {"actorEmail": {"$regex": s, "$options": "i"}},
            {"action": {"$regex": s, "$options": "i"}},
            {"ipAddress": {"$regex": s, "$options": "i"}},
            {"reason": {"$regex": s, "$options": "i"}}
        ]

    cursor = audit_col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    total = await audit_col.count_documents(query)

    for log in logs:
        log["_id"] = str(log["_id"])

    return {"logs": logs, "total": total, "skip": skip, "limit": limit}

# ------------------------------------------------------------------
# GET /admin-activity — Paginated admin actions (excluding asset decryption)
# ------------------------------------------------------------------
@router.get("/admin-activity")
async def get_admin_activity(
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN")),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    query = {
        "actorType": "ADMIN"
    }

    if search:
        s = search.strip()
        query["$or"] = [
            {"actorEmail": {"$regex": s, "$options": "i"}},
            {"action": {"$regex": s, "$options": "i"}},
            {"ipAddress": {"$regex": s, "$options": "i"}},
            {"reason": {"$regex": s, "$options": "i"}}
        ]

    cursor = audit_col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    total = await audit_col.count_documents(query)

    for log in logs:
        log["_id"] = str(log["_id"])

    return {"logs": logs, "total": total, "skip": skip, "limit": limit}

# ------------------------------------------------------------------
# GET /asset-access-logs — Paginated metadata-only asset logs
# ------------------------------------------------------------------
@router.get("/asset-access-logs")
async def get_asset_access_logs(
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN")),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    # Vault accessed, asset uploaded/downloaded/deleted
    query = {
        "action": {"$regex": "ASSET|VAULT|DOCUMENT|DECRYPTION", "$options": "i"}
    }

    if search:
        s = search.strip()
        query["$or"] = [
            {"actorEmail": {"$regex": s, "$options": "i"}},
            {"action": {"$regex": s, "$options": "i"}},
            {"resourceId": {"$regex": s, "$options": "i"}}
        ]

    # Project to EXCLUDE any possible actual asset/document bytes or keys
    projection = {
        "metadata.fileData": 0,
        "metadata.cipherText": 0,
        "metadata.decryptedKey": 0,
        "metadata.encryptedKey": 0
    }

    cursor = audit_col.find(query, projection).sort("timestamp", -1).skip(skip).limit(limit)
    logs = await cursor.to_list(length=limit)
    total = await audit_col.count_documents(query)

    for log in logs:
        log["_id"] = str(log["_id"])

    return {"logs": logs, "total": total, "skip": skip, "limit": limit}

# ------------------------------------------------------------------
# GET /sessions — View all active user sessions
# ------------------------------------------------------------------
@router.get("/sessions")
async def get_active_sessions(
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN")),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    query = {}

    if search:
        # Search by userId, IP, or user agent
        s = search.strip()
        query["$or"] = [
            {"userId": {"$regex": s, "$options": "i"}},
            {"ipAddress": {"$regex": s, "$options": "i"}},
            {"userAgent": {"$regex": s, "$options": "i"}}
        ]

    cursor = sessions_col.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    sessions = await cursor.to_list(length=limit)
    total = await sessions_col.count_documents(query)

    # Hydrate user emails
    user_ids = [s["userId"] for s in sessions if s.get("userId")]
    users = await users_col.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids]}}).to_list(length=len(user_ids))
    user_map = {str(u["_id"]): u.get("email") for u in users}

    for s in sessions:
        s["_id"] = str(s["_id"])
        s["email"] = user_map.get(s["userId"], "Unknown User")

    return {"sessions": sessions, "total": total, "skip": skip, "limit": limit}

# ------------------------------------------------------------------
# POST /sessions/{refreshTokenId}/terminate — Terminate active session
# ------------------------------------------------------------------
@router.post("/sessions/{refreshTokenId}/terminate")
async def terminate_session(
    refreshTokenId: str,
    request: Request,
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN"))
):
    # Find the session
    session = await sessions_col.find_one({"refreshTokenId": refreshTokenId})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    user_id = session["userId"]
    
    # Hydrate email
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    user_email = user.get("email") if user else "Unknown User"

    # Revoke from refresh_tokens & delete session entry
    await revoke_refresh_token(refreshTokenId)
    await sessions_col.delete_one({"refreshTokenId": refreshTokenId})

    # Log admin action
    await write_audit_log(
        action="SESSION_REVOKED_BY_ADMIN",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=current_admin.get("adminId"),
        actor_email=current_admin.get("email"),
        resource_type="SESSION",
        resource_id=refreshTokenId,
        reason=f"Admin forced logout for session of {user_email}",
        request=request
    )

    return {"message": "Session terminated successfully."}

# ------------------------------------------------------------------
# POST /users/{user_id}/lock — Lock account
# ------------------------------------------------------------------
@router.post("/users/{user_id}/lock")
async def lock_user_account(
    user_id: str,
    body: LockUserRequest,
    request: Request,
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN"))
):
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    now = datetime.now(timezone.utc).isoformat()
    # Update user lock status
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "accountLocked": True,
            "lockedAt": now,
            "lockedBy": current_admin.get("adminId"),
            "lockReason": body.reason
        }}
    )

    # Force logout from all devices
    await revoke_all_user_refresh_tokens(user_id)
    await sessions_col.delete_many({"userId": user_id})

    # Write audit logs
    await write_audit_log(
        action="ACCOUNT_LOCKED_BY_ADMIN",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=current_admin.get("adminId"),
        actor_email=current_admin.get("email"),
        resource_type="USER",
        resource_id=user_id,
        reason=body.reason,
        request=request
    )

    return {"message": "User account locked and all sessions revoked."}

# ------------------------------------------------------------------
# POST /users/{user_id}/unlock — Unlock account
# ------------------------------------------------------------------
@router.post("/users/{user_id}/unlock")
async def unlock_user_account(
    user_id: str,
    request: Request,
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN"))
):
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Reset lock fields
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "accountLocked": False,
            "lockedAt": None,
            "lockedBy": None,
            "lockReason": None,
            "failedLoginAttempts": 0,
            "lockedUntil": None
        }}
    )

    # Write audit log
    await write_audit_log(
        action="ACCOUNT_UNLOCKED_BY_ADMIN",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=current_admin.get("adminId"),
        actor_email=current_admin.get("email"),
        resource_type="USER",
        resource_id=user_id,
        reason="Admin manually unlocked user account",
        request=request
    )

    return {"message": "User account unlocked successfully."}

# ------------------------------------------------------------------
# GET /alerts — Security Alerts Feed
# ------------------------------------------------------------------
@router.get("/alerts")
async def get_security_alerts(
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN")),
    skip: int = 0,
    limit: int = 50
):
    # Fetch account lockout events or actions labeled with lockouts/failures
    query = {
        "action": {"$in": ["ACCOUNT_LOCKOUT", "ACCOUNT_LOCKED_BY_ADMIN", "SUSPICIOUS_LOGIN"]}
    }

    cursor = audit_col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    alerts = await cursor.to_list(length=limit)
    total = await audit_col.count_documents(query)

    for alert in alerts:
        alert["_id"] = str(alert["_id"])

    return {"alerts": alerts, "total": total, "skip": skip, "limit": limit}

# ------------------------------------------------------------------
# GET /recent-activity — Combined activity feed
# ------------------------------------------------------------------
@router.get("/recent-activity")
async def get_recent_activity(
    current_admin: dict = Depends(require_role("SECURITY_ADMIN", "SUPER_ADMIN"))
):
    cursor = audit_col.find({}).sort("timestamp", -1).limit(10)
    activity = await cursor.to_list(length=10)

    for act in activity:
        act["_id"] = str(act["_id"])

    return activity
