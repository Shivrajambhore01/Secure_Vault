"""
Admin API v1 Router — SecureVault Enterprise
Multi-role admin operations, system metrics, and case management.
"""

from fastapi import APIRouter, Depends, Request
from app.domain.value_objects import AdminRole
from app.infrastructure.response import success_response
from app.security.permissions import require_admin_role
from app.core.database import db

router = APIRouter(prefix="/admin", tags=["v1 - Admin Command Center"])


@router.get("/metrics")
async def get_system_metrics(request: Request):
    require_admin_role(
        request,
        allowed_roles=[
            AdminRole.SUPER_ADMIN,
            AdminRole.COMPLIANCE_OFFICER,
            AdminRole.SECURITY_ADMIN,
            AdminRole.SUPPORT_ADMIN,
        ],
    )

    total_users = await db["users"].count_documents({})
    total_assets = await db["assets"].count_documents({})
    pending_claims = await db["verification_requests"].count_documents({"status": "UNDER_REVIEW"})
    open_workflows = await db["verification_workflows"].count_documents({"status": {"$ne": "ACTIVE"}})

    metrics = {
        "total_users": total_users,
        "total_assets": total_assets,
        "pending_claims": pending_claims,
        "open_workflows": open_workflows,
        "system_health": "HEALTHY",
    }
    return success_response(data=metrics)
