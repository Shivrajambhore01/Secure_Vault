"""
Nominees API v1 Router — SecureVault Enterprise
Comprehensive beneficiary architecture:
- Tiered relationship management (Primary, Contingent, Executor)
- Cryptographic invitation and onboarding acceptance
- Asset allocation matrix and percentage shares
- Revocation and lifecycle tracking
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Query, Request
from pydantic import BaseModel, EmailStr, Field
from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.nominee_service import NomineeService

router = APIRouter(prefix="/nominees", tags=["v1 - Nominees"])
nominee_service = NomineeService()


class NomineeCreateUpdateRequest(BaseModel):
    name: str
    email: EmailStr
    relationship: str
    phone: Optional[str] = None
    tier: str = "PRIMARY"  # PRIMARY | CONTINGENT | EXECUTOR | GUARDIAN
    notes: Optional[str] = None
    id: Optional[str] = None


class AllocationItem(BaseModel):
    assetId: str
    sharePercentage: float = Field(default=100.0, ge=0.0, le=100.0)
    releaseCondition: str = "IMMEDIATE_ON_CLAIM"


class UpdateAllocationsRequest(BaseModel):
    allocations: List[AllocationItem]


class AcceptInvitationRequest(BaseModel):
    confirmationPhone: Optional[str] = None


class RevokeNomineeRequest(BaseModel):
    reason: Optional[str] = None


@router.get("/matrix")
async def get_allocation_matrix(request: Request):
    """Retrieve full bipartite allocation matrix of Nominees <-> Assets."""
    user_id = require_authenticated_user(request)
    matrix = await nominee_service.get_allocation_matrix(user_id)
    return success_response(data=matrix)


@router.get("")
async def list_nominees(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by status (INVITED, ACCEPTED, VERIFIED, REVOKED)"),
    tier: Optional[str] = Query(None, description="Filter by tier (PRIMARY, CONTINGENT, EXECUTOR)"),
):
    """List all beneficiaries with their tiers, statuses, and allocated asset counts."""
    user_id = require_authenticated_user(request)
    nominees = await nominee_service.list_nominees(user_id, status=status, tier=tier)
    return success_response(data=nominees)


@router.get("/{nominee_id}")
async def get_nominee_detail(nominee_id: str, request: Request):
    """Retrieve detailed beneficiary profile and verification workflow status."""
    user_id = require_authenticated_user(request)
    nominee = await nominee_service.get_nominee(user_id, nominee_id)
    return success_response(data=nominee)


@router.post("")
async def create_or_update_nominee(body: NomineeCreateUpdateRequest, request: Request):
    """Enroll or update a tiered beneficiary and issue an invitation token."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    res = await nominee_service.add_or_update_nominee(
        user_id=user_id,
        name=body.name,
        email=body.email,
        relationship=body.relationship,
        phone=body.phone,
        tier=body.tier,
        notes=body.notes,
        nominee_id=body.id,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=res, status_code=201 if not body.id else 200)


@router.post("/{nominee_id}/allocations")
async def update_nominee_allocations(
    nominee_id: str,
    body: UpdateAllocationsRequest,
    request: Request,
):
    """Assign or modify asset allocations and percentage shares for a nominee."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    alloc_dicts = [a.model_dump() for a in body.allocations]
    res = await nominee_service.update_allocations(
        user_id=user_id,
        nominee_id=nominee_id,
        allocations=alloc_dicts,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=res)


@router.post("/{nominee_id}/invite")
async def resend_invitation(nominee_id: str, request: Request):
    """Regenerate a secure invitation token and renew expiration window."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    res = await nominee_service.resend_invitation(
        user_id=user_id,
        nominee_id=nominee_id,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=res)


@router.post("/{nominee_id}/revoke")
async def revoke_nominee_access(
    nominee_id: str,
    body: RevokeNomineeRequest,
    request: Request,
):
    """Revoke a nominee's entitlement and unbind from all assets."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    res = await nominee_service.revoke_nominee(
        user_id=user_id,
        nominee_id=nominee_id,
        reason=body.reason,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=res)


@router.delete("/{nominee_id}")
async def delete_nominee(nominee_id: str, request: Request):
    """Permanently delete a nominee from the user's vault."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    await nominee_service.delete_nominee(user_id, nominee_id, client_ip=client_ip, user_agent=user_agent)
    return success_response(data={"message": "Nominee removed successfully"})


# Public onboarding endpoint
@router.post("/invitations/{token}/accept")
async def accept_invitation(token: str, body: Optional[AcceptInvitationRequest] = None):
    """Public portal endpoint allowing an invited beneficiary to accept their nomination."""
    phone = body.confirmationPhone if body else None
    res = await nominee_service.accept_invitation(token, confirmation_phone=phone)
    return success_response(data=res)
