"""
Claims API v1 Router — SecureVault Enterprise
Phase 08: Claim Verification & Fraud Detection
Endpoints:
- POST /api/v1/claims: Submit proof of death document with automated fraud scoring
- GET  /api/v1/claims: List inheritance claim cases with filtering
- GET  /api/v1/claims/{case_identifier}: Full case audit and document hash verification
- POST /api/v1/claims/{claim_id}/dispute: Vault owner "I Am Alive" dispute nullification
- POST /api/v1/claims/{claim_id}/adjudicate: Admin / Supervisor claim review & approval
- POST /api/v1/claims/halt: Tokenized emergency halt
"""

from typing import Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from app.infrastructure.pagination import PaginationParams
from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.claim_service import (
    ClaimService,
    ClaimSubmissionRequest,
    ClaimAdjudicationRequest,
)

router = APIRouter(prefix="/claims", tags=["v1 - Claims"])
claim_service = ClaimService()


class EmergencyHaltRequest(BaseModel):
    token: str


class OwnerDisputeRequest(BaseModel):
    reason: Optional[str] = "Owner confirmed alive; dispute filed"


@router.post("")
async def submit_claim(body: ClaimSubmissionRequest, request: Request):
    """Submit a death/incapacitation claim with document fingerprinting & risk evaluation."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    claim = await claim_service.submit_claim(
        claimant_id=user_id,
        payload=body,
        context={"ip": client_ip},
    )
    return success_response(data=claim, status_code=201)


@router.get("")
async def list_claims(
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    params: PaginationParams = Depends(),
):
    """List claims with optional status and risk level filtering."""
    paginated = await claim_service.list_cases(status=status, risk_level=risk_level, params=params)
    return success_response(data=paginated.items, meta=paginated.meta.model_dump())


@router.get("/{case_identifier}")
async def get_claim(case_identifier: str):
    """Retrieve full claim details, certificate fingerprint, and risk evaluation."""
    case = await claim_service.get_case_by_id_or_number(case_identifier)
    return success_response(data=case)


@router.post("/{claim_id}/dispute")
async def dispute_claim(claim_id: str, body: OwnerDisputeRequest, request: Request):
    """Vault owner 1-click 'I Am Alive' action that instantly invalidates the claim."""
    user_id = require_authenticated_user(request)
    result = await claim_service.owner_dispute_claim(
        user_id=user_id,
        claim_id=claim_id,
        reason=body.reason or "Owner verified alive; fraudulent claim nullified.",
    )
    return success_response(data=result)


@router.post("/{claim_id}/adjudicate")
async def adjudicate_claim(claim_id: str, body: ClaimAdjudicationRequest, request: Request):
    """Admin / Supervisor adjudication (APPROVE / REJECT / REQUIRE_NOTARY)."""
    admin_id = require_authenticated_user(request)
    result = await claim_service.adjudicate_claim(
        admin_id=admin_id,
        claim_id=claim_id,
        payload=body,
    )
    return success_response(data=result)


@router.post("/halt")
async def emergency_halt(body: EmergencyHaltRequest, request: Request):
    """Emergency halt trigger using one-time token."""
    client_ip = request.client.host if request.client else "unknown"
    res = await claim_service.trigger_emergency_halt(body.token, client_ip=client_ip)
    return success_response(data=res)
