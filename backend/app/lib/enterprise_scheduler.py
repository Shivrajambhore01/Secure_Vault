"""
Enterprise Background Job Scheduler — SecureVault Enterprise

Extends the existing inactivity re-engagement scheduler with additional
maintenance and compliance jobs:

  Job 1 (existing) — Inactivity Re-engagement (every 60s)
  Job 2 (new) — Expired OTP Cleanup          (every 15 min)
  Job 3 (new) — Expired Session Cleanup      (every 1 hour)
  Job 4 (new) — Expired Nominee Token Cleanup (every 6 hours)
  Job 5 (new) — Cooling Period Advance       (every 5 min)
  Job 6 (new) — Notification Retry           (every 30 min)
  Job 7 (new) — Audit Archive                (daily at 03:00 UTC)
  Job 8 (new) — Stale Upload Cleanup         (daily at 04:00 UTC)

All new jobs are additive — they do not modify the existing re-engagement logic.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings
from app.core.database import db

logger = logging.getLogger("securevault.scheduler")
settings = get_settings()

# Collections
otps_col = db["verification_otps"]
sessions_col = db["user_sessions"]
nominees_col = db["nominees"]
requests_col = db["verification_requests"]
status_history_col = db["verification_status_history"]
notifs_col = db["notification_logs"]
docs_col = db["verification_documents"]
audit_col = db["audit_logs"]


# ─────────────────────────────────────────────────────────────────────
# Job 2: Expired OTP Cleanup
# ─────────────────────────────────────────────────────────────────────

async def _cleanup_expired_otps():
    """Delete OTPs whose expiry time has passed."""
    now = datetime.now(timezone.utc).isoformat()
    result = await otps_col.delete_many({"expiresAt": {"$lt": now}})
    if result.deleted_count:
        logger.info("[OTP-CLEANUP] Deleted %d expired OTPs", result.deleted_count)


# ─────────────────────────────────────────────────────────────────────
# Job 3: Expired Session Cleanup
# ─────────────────────────────────────────────────────────────────────

async def _cleanup_expired_sessions():
    """Remove terminated sessions older than 30 days to keep the collection lean."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    result = await sessions_col.delete_many({
        "status": "TERMINATED",
        "terminatedAt": {"$lt": cutoff},
    })
    if result.deleted_count:
        logger.info("[SESSION-CLEANUP] Deleted %d stale sessions", result.deleted_count)


# ─────────────────────────────────────────────────────────────────────
# Job 4: Expired Nominee Token Cleanup
# ─────────────────────────────────────────────────────────────────────

async def _cleanup_expired_nominee_tokens():
    """
    Nullify accessToken on nominees where tokenExpiry has passed.
    This prevents orphaned access links from being used.
    """
    now = datetime.now(timezone.utc).isoformat()
    result = await nominees_col.update_many(
        {
            "tokenExpiry": {"$lt": now},
            "accessToken": {"$ne": None, "$exists": True},
        },
        {"$set": {"accessToken": None, "tokenExpiry": None}},
    )
    if result.modified_count:
        logger.info("[TOKEN-CLEANUP] Expired %d nominee access tokens", result.modified_count)


# ─────────────────────────────────────────────────────────────────────
# Job 5: Cooling Period Advance
# ─────────────────────────────────────────────────────────────────────

async def _advance_cooling_period():
    """
    Check all COOLING_PERIOD requests.
    If the cooling period end date has passed without owner response,
    automatically advance the status to NOMINEE_NOTIFIED.
    
    This decouples cooling period expiry from the frontend polling,
    making it a reliable server-side state machine.
    """
    now = datetime.now(timezone.utc).isoformat()

    expired_cooling = await requests_col.find({
        "status": "COOLING_PERIOD",
        "coolingPeriodEnd": {"$lt": now},
    }).to_list(length=None)

    for req in expired_cooling:
        req_id = req["id"]
        try:
            await requests_col.update_one(
                {"id": req_id},
                {"$set": {"status": "NOMINEE_NOTIFIED", "notifiedAt": now}},
            )
            await status_history_col.insert_one({
                "requestId": req_id,
                "oldStatus": "COOLING_PERIOD",
                "newStatus": "NOMINEE_NOTIFIED",
                "changedBy": "system_scheduler",
                "changedAt": now,
                "remarks": "Cooling period elapsed — no owner response received.",
            })
            logger.info(
                "[COOLING-ADVANCE] Request %s advanced to NOMINEE_NOTIFIED", req_id
            )
        except Exception as exc:
            logger.error("[COOLING-ADVANCE] Failed for request %s: %s", req_id, exc)


# ─────────────────────────────────────────────────────────────────────
# Job 6: Notification Retry
# ─────────────────────────────────────────────────────────────────────

async def _retry_failed_notifications():
    """
    Retry notifications that are stuck in FAILED status.
    Attempts a maximum of 3 retries before marking as PERMANENTLY_FAILED.
    """
    failed = await notifs_col.find({
        "status": "FAILED",
        "retryCount": {"$lt": 3},
    }).to_list(length=20)

    for notif in failed:
        retry_count = notif.get("retryCount", 0)
        try:
            # Re-attempt send (currently just marks for retry — full impl ties to notification service)
            await notifs_col.update_one(
                {"id": notif["id"]},
                {"$inc": {"retryCount": 1}, "$set": {"lastRetryAt": datetime.now(timezone.utc).isoformat()}},
            )
            logger.info("[NOTIF-RETRY] Retrying notification %s (attempt %d)", notif["id"], retry_count + 1)
        except Exception as exc:
            logger.error("[NOTIF-RETRY] Failed to retry notification %s: %s", notif["id"], exc)

    # Mark as permanently failed after 3 retries
    await notifs_col.update_many(
        {"status": "FAILED", "retryCount": {"$gte": 3}},
        {"$set": {"status": "PERMANENTLY_FAILED"}},
    )


# ─────────────────────────────────────────────────────────────────────
# Job 7: Audit Log Archive
# ─────────────────────────────────────────────────────────────────────

async def _archive_old_audit_logs():
    """
    Move audit log entries older than 90 days to an 'audit_archive' collection.
    This keeps the primary audit_logs collection fast while retaining compliance history.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    old_logs = await audit_col.find({"timestamp": {"$lt": cutoff}}).to_list(length=500)

    if not old_logs:
        return

    archive_col = db["audit_archive"]
    await archive_col.insert_many(old_logs)

    ids = [log["_id"] for log in old_logs]
    result = await audit_col.delete_many({"_id": {"$in": ids}})
    logger.info("[AUDIT-ARCHIVE] Archived %d log entries older than 90 days", result.deleted_count)


# ─────────────────────────────────────────────────────────────────────
# Job 8: Stale Verification Document Cleanup
# ─────────────────────────────────────────────────────────────────────

async def _cleanup_orphaned_documents():
    """
    Delete verification_documents entries that have no associated
    verification_request (orphaned after a rejected/halted claim).
    """
    all_request_ids = await requests_col.distinct("id")
    all_request_ids_set = set(all_request_ids)

    orphaned = await docs_col.find(
        {"requestId": {"$nin": list(all_request_ids_set)}},
        {"_id": 1, "id": 1},
    ).to_list(length=None)

    if orphaned:
        ids = [o["_id"] for o in orphaned]
        result = await docs_col.delete_many({"_id": {"$in": ids}})
        logger.info("[DOC-CLEANUP] Removed %d orphaned documents", result.deleted_count)


# ─────────────────────────────────────────────────────────────────────
# Import and extend original scheduler
# ─────────────────────────────────────────────────────────────────────

def start_inactivity_scheduler():
    """
    Start the APScheduler with ALL jobs — original re-engagement + new enterprise jobs.
    Replaces the original start_inactivity_scheduler() from scheduler.py.
    """
    from app.lib.scheduler import _run_inactivity_check

    test_mode = settings.INACTIVITY_TEST_MODE
    logger.info(
        "[SCHEDULER] Starting enterprise scheduler. Inactivity mode: %s",
        "TEST" if test_mode else "PROD",
    )

    scheduler = AsyncIOScheduler(timezone="UTC")

    # ── Job 1: Original re-engagement (every 60 seconds) ──────────────
    scheduler.add_job(
        _run_inactivity_check,
        "interval",
        seconds=60,
        id="inactivity_reengagement",
        name="Inactivity Re-Engagement Monitor",
        misfire_grace_time=30,
    )

    # ── Job 2: OTP Cleanup (every 15 minutes) ─────────────────────────
    scheduler.add_job(
        _cleanup_expired_otps,
        "interval",
        minutes=15,
        id="otp_cleanup",
        name="Expired OTP Cleanup",
    )

    # ── Job 3: Session Cleanup (every hour) ───────────────────────────
    scheduler.add_job(
        _cleanup_expired_sessions,
        "interval",
        hours=1,
        id="session_cleanup",
        name="Expired Session Cleanup",
    )

    # ── Job 4: Nominee Token Cleanup (every 6 hours) ──────────────────
    scheduler.add_job(
        _cleanup_expired_nominee_tokens,
        "interval",
        hours=6,
        id="nominee_token_cleanup",
        name="Expired Nominee Token Cleanup",
    )

    # ── Job 5: Cooling Period Advance (every 5 minutes) ───────────────
    scheduler.add_job(
        _advance_cooling_period,
        "interval",
        minutes=5,
        id="cooling_advance",
        name="Cooling Period State Advance",
    )

    # ── Job 6: Notification Retry (every 30 minutes) ──────────────────
    scheduler.add_job(
        _retry_failed_notifications,
        "interval",
        minutes=30,
        id="notif_retry",
        name="Failed Notification Retry",
    )

    # ── Job 7: Audit Archive (daily at 03:00 UTC) ─────────────────────
    scheduler.add_job(
        _archive_old_audit_logs,
        "cron",
        hour=3,
        minute=0,
        id="audit_archive",
        name="Daily Audit Log Archive",
    )

    # ── Job 8: Orphaned Doc Cleanup (daily at 04:00 UTC) ──────────────
    scheduler.add_job(
        _cleanup_orphaned_documents,
        "cron",
        hour=4,
        minute=0,
        id="doc_cleanup",
        name="Orphaned Document Cleanup",
    )

    scheduler.start()
    logger.info("[SCHEDULER] Enterprise scheduler started with %d jobs.", len(scheduler.get_jobs()))
    return scheduler
