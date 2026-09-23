"""
Custodian Governance & Air-Gap Handshake API Router — Phase 21.
Exposes multi-custodian M-of-N threshold voting, time-lock execution,
owner veto mechanisms, and cold-storage air-gapped QR challenges.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.custodian_consensus_service import (
    custodian_consensus_service,
    ProposalAction,
)

router = APIRouter(prefix="/governance", tags=["v1 - Custodian Governance & Air-Gap"])


class CreateProposalRequest(BaseModel):
    vault_id: str
    action: ProposalAction
    description: str
    threshold_required: int = Field(default=3, ge=1, le=10)
    total_custodians: int = Field(default=5, ge=1, le=20)
    timelock_seconds: int = Field(default=0, ge=0)


class SignProposalRequest(BaseModel):
    custodian_id: str
    signature_hex: str
    public_key: Optional[str] = "pub_custodian_default"


class VetoProposalRequest(BaseModel):
    reason: Optional[str] = "Vault owner emergency veto exercised"


class AirGapChallengeRequest(BaseModel):
    payload: Dict[str, Any]


class AirGapVerifyRequest(BaseModel):
    challenge_id: str
    public_key_hex: str
    signature_hex: str


@router.get("/proposals")
async def list_governance_proposals(vault_id: Optional[str] = None):
    """
    List active, pending, or historical custodian consensus proposals.
    """
    proposals = custodian_consensus_service.list_proposals(vault_id=vault_id)
    return success_response(
        data=[p.model_dump() for p in proposals],
        meta={"total": len(proposals)}
    )


@router.post("/proposals")
async def create_governance_proposal(
    body: CreateProposalRequest,
    request: Request,
):
    """
    Create a new multi-custodian governance proposal requiring M-of-N threshold signatures.
    """
    _ = require_authenticated_user(request)
    proposal = custodian_consensus_service.create_proposal(
        vault_id=body.vault_id,
        action=body.action,
        description=body.description,
        threshold_required=body.threshold_required,
        total_custodians=body.total_custodians,
        timelock_seconds=body.timelock_seconds,
    )
    return success_response(
        data=proposal.model_dump(),
        meta={"message": f"Proposal {proposal.proposal_id} created."}
    )


@router.post("/proposals/{proposal_id}/sign")
async def sign_governance_proposal(
    proposal_id: str,
    body: SignProposalRequest,
    request: Request,
):
    """
    Append custodian signature to proposal and advance quorum state.
    """
    _ = require_authenticated_user(request)
    try:
        updated = custodian_consensus_service.sign_proposal(
            proposal_id=proposal_id,
            custodian_id=body.custodian_id,
            signature_hex=body.signature_hex,
            public_key=body.public_key or "pub_custodian_default",
        )
        return success_response(
            data=updated.model_dump(),
            meta={"message": f"Proposal {proposal_id} signed by {body.custodian_id}."}
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/proposals/{proposal_id}/execute")
async def execute_governance_proposal(
    proposal_id: str,
    request: Request,
):
    """
    Execute an approved governance proposal whose timelock delay has elapsed.
    """
    _ = require_authenticated_user(request)
    try:
        executed = custodian_consensus_service.execute_proposal(proposal_id=proposal_id)
        return success_response(
            data=executed.model_dump(),
            meta={"message": f"Proposal {proposal_id} successfully executed."}
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/proposals/{proposal_id}/veto")
async def veto_governance_proposal(
    proposal_id: str,
    body: VetoProposalRequest,
    request: Request,
):
    """
    Vault owner emergency veto: immediately halts and cancels a pending proposal.
    """
    owner_id = require_authenticated_user(request)
    try:
        vetoed = custodian_consensus_service.owner_veto_proposal(
            proposal_id=proposal_id,
            owner_id=owner_id,
            reason=body.reason or "Owner emergency veto",
        )
        return success_response(
            data=vetoed.model_dump(),
            meta={"message": f"Proposal {proposal_id} vetoed and cancelled."}
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/airgap/challenge")
async def generate_airgap_challenge(
    body: AirGapChallengeRequest,
    request: Request,
):
    """
    Generate an offline air-gapped QR signing challenge.
    """
    _ = require_authenticated_user(request)
    envelope = custodian_consensus_service.generate_airgap_challenge(payload=body.payload)
    return success_response(
        data=envelope.model_dump(),
        meta={"message": "Air-gap offline signing challenge generated."}
    )


@router.post("/airgap/verify")
async def verify_airgap_signature(
    body: AirGapVerifyRequest,
    request: Request,
):
    """
    Verify cold-storage air-gap signature scanned back from offline hardware.
    """
    _ = require_authenticated_user(request)
    is_valid = custodian_consensus_service.verify_airgap_signature(
        challenge_id=body.challenge_id,
        public_key_hex=body.public_key_hex,
        signature_hex=body.signature_hex,
    )
    return success_response(
        data={"is_valid": is_valid, "challenge_id": body.challenge_id},
        meta={"message": "Air-gap signature evaluated."}
    )
