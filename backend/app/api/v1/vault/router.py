"""
Vault Overview API v1 Router — SecureVault Enterprise
Aggregates vault metrics, health status, category breakdowns, storage limits,
and houses Dead Man's Switch controls & multi-channel heartbeat endpoints.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Request
from pydantic import BaseModel, Field
from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.core.database import db
from app.services.inactivity_service import InactivityService

router = APIRouter(prefix="/vault", tags=["v1 - Vault"])
inactivity_service = InactivityService()


class HeartbeatRequest(BaseModel):
    channel: str = "WEB_PORTAL"


class SwitchConfigRequest(BaseModel):
    inactivityPeriodDays: int = Field(..., ge=1, le=1825, description="Standby threshold in days")
    coolingPeriodDays: int = Field(default=14, ge=1, le=90, description="Cooling grace period in days")
    emergencyContacts: Optional[List[str]] = Field(default_factory=list)


class PauseSwitchRequest(BaseModel):
    pin: str
    reason: Optional[str] = None
    resumeDate: Optional[str] = None


@router.get("/summary")
async def get_vault_summary(request: Request):
    """Retrieve comprehensive health, metrics, and categorization for the user's digital vault."""
    user_id = require_authenticated_user(request)

    # 1. Total assets and categorization
    assets_col = db["assets"]
    total_assets = await assets_col.count_documents({"userId": user_id})

    # Aggregations for category and sensitivity counts
    category_pipeline = [
        {"$match": {"userId": user_id}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
    ]
    category_cursor = assets_col.aggregate(category_pipeline)
    category_counts = {doc["_id"]: doc["count"] async for doc in category_cursor if doc.get("_id")}

    sensitivity_pipeline = [
        {"$match": {"userId": user_id}},
        {"$group": {"_id": {"$ifNull": ["$sensitivity", "MEDIUM"]}, "count": {"$sum": 1}}},
    ]
    sensitivity_cursor = assets_col.aggregate(sensitivity_pipeline)
    sensitivity_counts = {doc["_id"]: doc["count"] async for doc in sensitivity_cursor}

    # Encrypted assets count
    encrypted_count = await assets_col.count_documents({"userId": user_id, "isEncrypted": True})

    # Nominee assigned assets count
    assigned_count = await assets_col.count_documents({
        "userId": user_id,
        "$or": [
            {"nomineeIds": {"$exists": True, "$ne": []}},
            {"nomineeId": {"$exists": True, "$ne": None}},
        ],
    })

    # 2. Nominees count
    total_nominees = await db["nominees"].count_documents({"userId": user_id})

    # 3. User storage and plan info
    user = await db["users"].find_one({"id": user_id}) or {}
    storage_used = user.get("storageUsed", 0)
    storage_limit = user.get("storageLimit", 500 * 1024 * 1024)
    storage_percentage = round((storage_used / storage_limit) * 100, 2) if storage_limit > 0 else 0

    # 4. Inactivity & verification workflow
    workflow = await db["verification_workflows"].find_one({"userId": user_id}) or {}

    summary = {
        "total_assets": total_assets,
        "total_nominees": total_nominees,
        "encrypted_assets": encrypted_count,
        "nominee_assigned_assets": assigned_count,
        "storage_used": storage_used,
        "storage_limit": storage_limit,
        "storage_percentage": storage_percentage,
        "vault_status": workflow.get("status", "ACTIVE"),
        "inactivity_period": user.get("inactivityPeriod", 6.0),
        "category_breakdown": category_counts,
        "sensitivity_breakdown": sensitivity_counts,
    }
    return success_response(data=summary)


# --------------------------------------------------------------------------
# Dead Man's Switch & Heartbeat Controls
# --------------------------------------------------------------------------

@router.post("/heartbeat")
async def record_heartbeat(request: Request, body: Optional[HeartbeatRequest] = None):
    """Record an active heartbeat, resetting the Dead Man's Switch countdown."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    channel = body.channel if body else "WEB_PORTAL"

    res = await inactivity_service.record_heartbeat(
        user_id=user_id,
        channel=channel,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=res)


@router.get("/switch/status")
async def get_switch_status(request: Request):
    """Retrieve live Dead Man's Switch status, days remaining, stage, and milestones."""
    user_id = require_authenticated_user(request)
    res = await inactivity_service.get_switch_status(user_id)
    return success_response(data=res)


@router.put("/switch/config")
async def configure_switch(body: SwitchConfigRequest, request: Request):
    """Update Dead Man's Switch standby threshold, cooling period, and emergency contacts."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    res = await inactivity_service.configure_switch(
        user_id=user_id,
        inactivity_days=body.inactivityPeriodDays,
        cooling_days=body.coolingPeriodDays,
        emergency_contacts=body.emergencyContacts,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=res)


@router.post("/switch/pause")
async def pause_switch(body: PauseSwitchRequest, request: Request):
    """Pause Dead Man's Switch countdown with secondary PIN verification."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    res = await inactivity_service.pause_switch(
        user_id=user_id,
        pin=body.pin,
        reason=body.reason,
        resume_date=body.resumeDate,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=res)


@router.post("/switch/resume")
async def resume_switch(request: Request):
    """Resume Dead Man's Switch countdown."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    res = await inactivity_service.resume_switch(
        user_id=user_id,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=res)
