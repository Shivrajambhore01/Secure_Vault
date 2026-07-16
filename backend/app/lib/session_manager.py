"""
Enhanced Session Management — SecureVault Enterprise

Provides enterprise-grade session tracking including:
  • Active session inventory per user
  • Concurrent session limits
  • Device-bound sessions
  • Session history
  • Logout from all devices
  • Emergency account lock

Sessions are stored in the 'user_sessions' MongoDB collection.

Session lifecycle:
  LOGIN → session created with device fingerprint
  HEARTBEAT → session lastSeen updated
  REFRESH → new access/refresh token pair issued, session updated
  LOGOUT → session marked TERMINATED
  LOGOUT ALL → all sessions for user marked TERMINATED
  LOCK → all sessions revoked, account locked flag set
"""

import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request
from app.core.database import db

logger = logging.getLogger("securevault.session")
sessions_col = db["user_sessions"]
users_col = db["users"]

MAX_CONCURRENT_SESSIONS = 5  # Max active sessions per user


# ─────────────────────────────────────────────────────────────────────
# Session Creation
# ─────────────────────────────────────────────────────────────────────

async def create_session(
    user_id: str,
    device_info: dict,
    request: Request,
    session_type: str = "USER",   # USER | ADMIN
) -> str:
    """
    Create a new authenticated session record.
    Enforces concurrent session limits by terminating the oldest session
    if the per-user maximum is exceeded.

    Returns the session_id.
    """
    session_id = secrets.token_hex(32)
    now = datetime.now(timezone.utc)

    # Check concurrent session count
    active_count = await sessions_col.count_documents({
        "userId": user_id,
        "status": "ACTIVE",
    })

    if active_count >= MAX_CONCURRENT_SESSIONS:
        # Terminate the oldest session (LRU eviction)
        oldest = await sessions_col.find_one(
            {"userId": user_id, "status": "ACTIVE"},
            sort=[("createdAt", 1)],
        )
        if oldest:
            await sessions_col.update_one(
                {"sessionId": oldest["sessionId"]},
                {"$set": {"status": "TERMINATED", "terminatedAt": now.isoformat(), "terminationReason": "MAX_SESSIONS_EXCEEDED"}},
            )
            logger.info("Session evicted (max concurrent): %s for user=%s", oldest["sessionId"], user_id)

    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    ua = request.headers.get("user-agent", "unknown")

    await sessions_col.insert_one({
        "sessionId": session_id,
        "userId": user_id,
        "sessionType": session_type,
        "status": "ACTIVE",
        "ipAddress": ip,
        "userAgent": ua,
        "fingerprint": device_info.get("fingerprint", ""),
        "browser": device_info.get("browser", "Unknown"),
        "os": device_info.get("os", "Unknown"),
        "country": device_info.get("country", ""),
        "city": device_info.get("city", ""),
        "isVpn": device_info.get("is_vpn", False),
        "isTor": device_info.get("is_tor", False),
        "createdAt": now.isoformat(),
        "lastSeen": now.isoformat(),
        "terminatedAt": None,
        "terminationReason": None,
    })

    logger.info("Session CREATED: session_id=%s user=%s ip=%s", session_id, user_id, ip)
    return session_id


async def update_session_activity(session_id: str):
    """Update the lastSeen timestamp for a session (called on heartbeat)."""
    await sessions_col.update_one(
        {"sessionId": session_id, "status": "ACTIVE"},
        {"$set": {"lastSeen": datetime.now(timezone.utc).isoformat()}},
    )


async def terminate_session(session_id: str, reason: str = "LOGOUT"):
    """Mark a single session as terminated."""
    await sessions_col.update_one(
        {"sessionId": session_id},
        {"$set": {
            "status": "TERMINATED",
            "terminatedAt": datetime.now(timezone.utc).isoformat(),
            "terminationReason": reason,
        }},
    )
    logger.info("Session TERMINATED: %s reason=%s", session_id, reason)


async def terminate_all_sessions(user_id: str, reason: str = "LOGOUT_ALL"):
    """
    Terminate ALL active sessions for a user (logout from all devices).
    Also revokes all refresh tokens in the database.
    """
    now = datetime.now(timezone.utc).isoformat()
    result = await sessions_col.update_many(
        {"userId": user_id, "status": "ACTIVE"},
        {"$set": {"status": "TERMINATED", "terminatedAt": now, "terminationReason": reason}},
    )

    # Also purge refresh tokens
    await db["refresh_tokens"].delete_many({"userId": user_id})

    logger.warning(
        "ALL sessions terminated for user=%s reason=%s count=%d",
        user_id, reason, result.modified_count,
    )
    return result.modified_count


async def emergency_lock_account(user_id: str, locked_by: str = "SYSTEM", reason: str = ""):
    """
    Emergency account lock:
      - Terminates all sessions
      - Sets account locked flag in users collection
      - Logs the lockdown event
    """
    await terminate_all_sessions(user_id, reason="EMERGENCY_LOCK")
    await users_col.update_one(
        {"_id": __import__("bson").ObjectId(user_id)},
        {"$set": {
            "accountLocked": True,
            "lockedAt": datetime.now(timezone.utc).isoformat(),
            "lockedBy": locked_by,
            "lockReason": reason,
        }},
    )
    logger.critical(
        "ACCOUNT LOCKED: user=%s by=%s reason=%s",
        user_id, locked_by, reason,
    )


# ─────────────────────────────────────────────────────────────────────
# Session Queries
# ─────────────────────────────────────────────────────────────────────

async def get_active_sessions(user_id: str) -> list[dict]:
    """Return all currently active sessions for a user."""
    cursor = sessions_col.find(
        {"userId": user_id, "status": "ACTIVE"},
        {"_id": 0},
        sort=[("createdAt", -1)],
    )
    return await cursor.to_list(length=20)


async def get_session_history(user_id: str, limit: int = 50) -> list[dict]:
    """Return the last N sessions (active + terminated) for a user."""
    cursor = sessions_col.find(
        {"userId": user_id},
        {"_id": 0},
        sort=[("createdAt", -1)],
        limit=limit,
    )
    return await cursor.to_list(length=limit)


async def is_session_valid(session_id: str, user_id: str) -> bool:
    """Check whether a session_id is active and belongs to the user."""
    session = await sessions_col.find_one({
        "sessionId": session_id,
        "userId": user_id,
        "status": "ACTIVE",
    })
    return session is not None


# ─────────────────────────────────────────────────────────────────────
# Expired Session Cleanup (called by scheduler)
# ─────────────────────────────────────────────────────────────────────

async def cleanup_expired_sessions(max_age_days: int = 30):
    """
    Prune sessions older than max_age_days from the database.
    This is a maintenance task — called by the background scheduler.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=max_age_days)).isoformat()
    result = await sessions_col.delete_many({
        "status": "TERMINATED",
        "terminatedAt": {"$lt": cutoff},
    })
    logger.info("Session cleanup: removed %d expired sessions", result.deleted_count)
    return result.deleted_count
