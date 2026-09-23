"""
Security API v1 Router — SecureVault Enterprise
Sessions, devices, audit logs, and security overview.
"""

import json
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.infrastructure.pagination import PaginationParams
from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.security.rbac import require_permission, Permission
from app.repositories.audit_repository import AuditRepository
from app.services.session_service import SessionService
from app.services.security_siem_service import SecuritySiemService, ContainmentActionRequest, audit_broadcaster
from app.core.database import db

router = APIRouter(prefix="/security", tags=["v1 - Security Operations & SIEM"])
audit_repo = AuditRepository()
session_service = SessionService()
siem_service = SecuritySiemService(db)


class DeviceTrustRequest(BaseModel):
    isTrusted: bool


@router.get("/overview")
async def get_security_overview(request: Request):
    user_id = require_authenticated_user(request)
    user = await db["users"].find_one({"id": user_id}) or {}
    active_sessions = await db["user_sessions"].count_documents({"userId": user_id, "status": "ACTIVE"})
    trusted_devices = await db["devices"].count_documents({"userId": user_id, "isTrusted": True})

    overview = {
        "mfa_enabled": bool(user.get("twoFactorEnabled")),
        "mfa_type": user.get("twoFactorType", "NONE"),
        "secondary_pin_set": bool(user.get("pin")),
        "trusted_devices_count": trusted_devices,
        "active_sessions_count": max(1, active_sessions),
        "recovery_codes_count": len(user.get("recoveryCodes", [])),
        "last_login": user.get("lastActive"),
    }
    return success_response(data=overview)


@router.get("/sessions")
async def list_sessions(request: Request):
    user_id = require_authenticated_user(request)
    current_session_id = request.headers.get("X-Session-ID")
    sessions = await session_service.list_active_sessions(user_id, current_session_id=current_session_id)
    return success_response(data=sessions)


@router.delete("/sessions/{session_id}")
async def terminate_session(session_id: str, request: Request):
    user_id = require_authenticated_user(request)
    await session_service.terminate_session(user_id, session_id)
    return success_response(data={"message": "Session terminated successfully"})


@router.post("/sessions/terminate-others")
async def terminate_all_other_sessions(request: Request):
    user_id = require_authenticated_user(request)
    current_session_id = request.headers.get("X-Session-ID", "")
    terminated = await session_service.terminate_all_other_sessions(user_id, current_session_id)
    return success_response(data={"message": f"Terminated {terminated} other active sessions"})


@router.get("/devices")
async def list_devices(request: Request):
    user_id = require_authenticated_user(request)
    devices = await session_service.list_devices(user_id)
    return success_response(data=devices)


@router.patch("/devices/{device_id}")
async def toggle_device_trust(device_id: str, body: DeviceTrustRequest, request: Request):
    user_id = require_authenticated_user(request)
    await session_service.set_device_trusted(user_id, device_id, body.isTrusted)
    action = "trusted" if body.isTrusted else "untrusted"
    return success_response(data={"message": f"Device marked as {action}"})


@router.get("/audit-logs")
async def get_audit_logs(request: Request, params: PaginationParams = Depends()):
    user_id = require_authenticated_user(request)
    logs, total = await audit_repo.get_user_activity(user_id, params=params)
    return success_response(data=logs, meta={"total": total, "page": params.page})


# --- SOC & SIEM Endpoints ---

@router.get("/soc/events")
async def get_soc_events(
    request: Request,
    page: int = 1,
    limit: int = 50,
    action: Optional[str] = None,
):
    """Retrieve hash-chained audit events for the Security Operations Center."""
    user_id = require_authenticated_user(request)
    result = await siem_service.list_audit_events(
        user_id=user_id,
        limit=limit,
        page=page,
        action=action,
    )
    return success_response(data=result["items"], meta={"total": result["total"], "page": page, "limit": limit})


@router.get("/soc/integrity")
async def verify_soc_integrity(request: Request):
    """Run cryptographic ledger integrity check across all hash-chained blocks."""
    user_id = require_authenticated_user(request)
    report = await siem_service.verify_audit_integrity(user_id=user_id)
    return success_response(data=report)


@router.get("/soc/threats")
async def list_soc_threats(request: Request):
    """List active SIEM threats, impossible travel flags, and anomaly alerts."""
    user_id = require_authenticated_user(request)
    threats = await siem_service.list_active_threats(user_id=user_id)
    return success_response(data=threats)


@router.post("/soc/containment")
async def execute_soc_containment(body: ContainmentActionRequest, request: Request):
    """Execute immediate administrative threat containment (revoke sessions, lock vault)."""
    user_id = require_authenticated_user(request)
    result = await siem_service.execute_containment_action(user_id=user_id, payload=body)
    return success_response(data=result)


@router.get("/soc/stream")
async def stream_soc_audit_events(
    request: Request,
    limit: Optional[int] = None,
    _role = Depends(require_permission(Permission.AUDIT_STREAM)),
):
    """
    Real-time Server-Sent Events (SSE) telemetry stream for SIEM ingestion and SOC monitoring.
    Pushes hash-chained audit events instantly to connected subscribers with heartbeat keepalives.
    """
    async def event_generator():
        queue = audit_broadcaster.subscribe()
        emitted = 0
        try:
            # Initial connection handshake event
            init_msg = json.dumps({
                "type": "CONNECTION_ESTABLISHED",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "status": "STREAMING_ACTIVE",
            })
            yield f"event: connected\ndata: {init_msg}\n\n"
            if limit == 0:
                return

            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Await new audit event from broadcaster or heartbeat after 15 seconds
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    if isinstance(event, dict):
                        clean_event = {k: v for k, v in event.items() if k != "_id"}
                    else:
                        clean_event = event
                    data_str = json.dumps(clean_event)
                    yield f"event: audit_event\ndata: {data_str}\n\n"
                    emitted += 1
                    if limit and emitted >= limit:
                        break
                except asyncio.TimeoutError:
                    heartbeat_msg = json.dumps({
                        "type": "HEARTBEAT",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    yield f"event: heartbeat\ndata: {heartbeat_msg}\n\n"
        finally:
            audit_broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


