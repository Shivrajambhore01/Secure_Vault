"""
Immutable Audit Log Service — SecureVault Enterprise

Every state-changing API call is recorded to the 'audit_logs' collection.
Logs are append-only — never updated or deleted once written.

Log schema:
  - requestId       : Unique per-request trace ID (UUID4)
  - timestamp       : UTC ISO-8601 (always UTC, never local)
  - actorType       : USER | NOMINEE | ADMIN | SYSTEM
  - actorId         : MongoDB ObjectId string of the actor
  - actorEmail      : Actor's email at time of action
  - action          : e.g. CLAIM_SUBMITTED, OTP_VERIFIED, VAULT_ACCESSED
  - resourceType    : USER | VAULT | VERIFICATION | DOCUMENT | SESSION
  - resourceId      : ID of the affected resource
  - ipAddress       : Caller IP
  - userAgent       : Raw User-Agent header string
  - country         : Geo-resolved country code (if available)
  - deviceInfo      : Dict with browser, OS, fingerprint hash
  - previousState   : State before the action (for transitions)
  - newState        : State after the action
  - result          : SUCCESS | FAILURE | BLOCKED
  - reason          : Human-readable description or error message
  - metadata        : Any additional structured context
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import Request
from app.core.database import db

logger = logging.getLogger("securevault.audit")

audit_col = db["audit_logs"]

ActorType = Literal["USER", "NOMINEE", "ADMIN", "SYSTEM"]
ResourceType = Literal["USER", "VAULT", "VERIFICATION", "DOCUMENT", "SESSION", "NOMINEE"]
Result = Literal["SUCCESS", "FAILURE", "BLOCKED"]


def _get_client_ip(request: Optional[Request]) -> str:
    if not request:
        return "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_user_agent(request: Optional[Request]) -> str:
    if not request:
        return "unknown"
    return request.headers.get("user-agent", "unknown")


async def write_audit_log(
    action: str,
    result: Result,
    actor_type: ActorType = "SYSTEM",
    actor_id: Optional[str] = None,
    actor_email: Optional[str] = None,
    resource_type: Optional[ResourceType] = None,
    resource_id: Optional[str] = None,
    previous_state: Optional[str] = None,
    new_state: Optional[str] = None,
    reason: Optional[str] = None,
    metadata: Optional[dict] = None,
    request: Optional[Request] = None,
    device_info: Optional[dict] = None,
    # Legacy compatibility — accept positional-style usage from existing code
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    """
    Write an immutable audit log entry to MongoDB.

    This function is backward-compatible with the old write_audit_log() signature.
    New callers should use keyword arguments for clarity.
    """
    # Legacy compat mapping
    if user_id and not actor_id:
        actor_id = user_id
    if status and not result:
        result = "SUCCESS" if status == "success" else "FAILURE"

    ip = ip_address or _get_client_ip(request)
    ua = user_agent or _get_user_agent(request)

    log_entry = {
        "requestId": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "actorType": actor_type,
        "actorId": actor_id,
        "actorEmail": actor_email,
        "action": action,
        "resourceType": resource_type,
        "resourceId": resource_id,
        "ipAddress": ip,
        "userAgent": ua,
        "deviceInfo": device_info or {},
        "previousState": previous_state,
        "newState": new_state,
        "result": result,
        "reason": reason,
        "metadata": metadata or {},
    }

    try:
        # Cryptographic Hash-Chain Computation
        import hashlib, json
        latest_log = await audit_col.find_one(sort=[("timestamp", -1)])
        previous_hash = (latest_log.get("hash") if latest_log else None) or ("0" * 64)
        log_entry["previousHash"] = previous_hash
        
        canonical_payload = json.dumps(log_entry, sort_keys=True).encode("utf-8")
        log_entry["hash"] = hashlib.sha256(canonical_payload + previous_hash.encode("utf-8")).hexdigest()

        await audit_col.insert_one(log_entry)
        logger.info(
            "AUDIT | %s | %s | actor=%s | resource=%s[%s] | ip=%s",
            action,
            result,
            actor_id or "system",
            resource_type,
            resource_id,
            ip,
        )
    except Exception as exc:
        # Never let audit failures crash the main request
        logger.error("Failed to write audit log: %s", exc)


# ─────────────────────────────────────────────────────────────────────
# Convenience wrappers for common actions
# ─────────────────────────────────────────────────────────────────────

async def audit_login(
    user_id: str, email: str, result: Result, request: Request, reason: str = ""
):
    await write_audit_log(
        action="USER_LOGIN",
        result=result,
        actor_type="USER",
        actor_id=user_id,
        actor_email=email,
        resource_type="SESSION",
        reason=reason,
        request=request,
    )


async def audit_admin_login(
    admin_id: str, email: str, result: Result, request: Request
):
    await write_audit_log(
        action="ADMIN_LOGIN",
        result=result,
        actor_type="ADMIN",
        actor_id=admin_id,
        actor_email=email,
        resource_type="SESSION",
        request=request,
    )


async def audit_claim_submitted(
    nominee_id: str, request_id: str, ip: str, ua: str
):
    await write_audit_log(
        action="DEATH_CLAIM_SUBMITTED",
        result="SUCCESS",
        actor_type="NOMINEE",
        actor_id=nominee_id,
        resource_type="VERIFICATION",
        resource_id=request_id,
        ip_address=ip,
        user_agent=ua,
    )


async def audit_document_uploaded(
    nominee_id: str, doc_id: str, doc_type: str, ip: str
):
    await write_audit_log(
        action="DOCUMENT_UPLOADED",
        result="SUCCESS",
        actor_type="NOMINEE",
        actor_id=nominee_id,
        resource_type="DOCUMENT",
        resource_id=doc_id,
        metadata={"documentType": doc_type},
        ip_address=ip,
    )


async def audit_vault_accessed(
    nominee_id: str, vault_token: str, ip: str
):
    await write_audit_log(
        action="VAULT_ACCESSED",
        result="SUCCESS",
        actor_type="NOMINEE",
        actor_id=nominee_id,
        resource_type="VAULT",
        resource_id=vault_token,
        ip_address=ip,
    )


async def audit_admin_decision(
    admin_id: str, request_id: str, action: str, reason: str, request: Request
):
    await write_audit_log(
        action=f"ADMIN_{action}",
        result="SUCCESS",
        actor_type="ADMIN",
        actor_id=admin_id,
        resource_type="VERIFICATION",
        resource_id=request_id,
        reason=reason,
        request=request,
    )
