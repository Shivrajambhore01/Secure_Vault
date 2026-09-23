"""
Recovery & Emergency API v1 Router — SecureVault Enterprise
Phase 11: Account Recovery, Emergency Escrow & Shamir Social Recovery
Endpoints:
- POST /api/v1/recovery/forgot-password: Standard email recovery link
- POST /api/v1/recovery/social/setup: Configure k-of-n Shamir's Secret Sharing scheme
- GET  /api/v1/recovery/social/config: Retrieve active recovery configuration & guardian status
- POST /api/v1/recovery/cases/initiate: Initiate emergency recovery case
- POST /api/v1/recovery/cases/{case_id}/submit-shard: Guardian submits recovery shard
- GET  /api/v1/recovery/cases/{case_id}/status: Live recovery case status & timelock countdown
- POST /api/v1/recovery/cases/{case_id}/cancel: Vault owner 1-click recovery abort
- POST /api/v1/recovery/cases/{case_id}/finalize: Finalize recovery after 72-hour timelock
"""

from typing import Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel, EmailStr
from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.social_recovery_service import (
    SocialRecoveryService,
    SocialRecoverySetupRequest,
    RecoveryClaimInitiateRequest,
    SubmitShardRequest,
)

router = APIRouter(prefix="/recovery", tags=["v1 - Recovery"])
social_recovery_service = SocialRecoveryService()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class CancelRecoveryRequest(BaseModel):
    reason: Optional[str] = "Owner aborted unauthorized recovery attempt"


@router.post("/forgot-password")
async def initiate_password_recovery(body: ForgotPasswordRequest):
    return success_response(data={"message": "If an account exists, a recovery link has been dispatched."})


# --- Social Recovery Configuration ---

@router.post("/social/setup")
async def setup_social_recovery(body: SocialRecoverySetupRequest, request: Request):
    """Configure Shamir's Secret Sharing (k-of-n) threshold and assign guardians."""
    user_id = require_authenticated_user(request)
    result = await social_recovery_service.setup_social_recovery(user_id=user_id, payload=body)
    return success_response(data=result, status_code=201)


@router.get("/social/config")
async def get_social_recovery_config(request: Request):
    """Retrieve active social recovery parameters and guardian assignment status."""
    user_id = require_authenticated_user(request)
    config = await social_recovery_service.get_social_recovery_config(user_id=user_id)
    return success_response(data=config)


# --- Recovery Cases & Guardian Shards ---

@router.post("/cases/initiate")
async def initiate_recovery_case(body: RecoveryClaimInitiateRequest):
    """Public or claimant initiation of emergency account recovery."""
    case = await social_recovery_service.initiate_recovery_case(payload=body)
    return success_response(data=case, status_code=201)


@router.post("/cases/{case_id}/submit-shard")
async def submit_recovery_shard(case_id: str, body: SubmitShardRequest):
    """Guardian submits a cryptographic recovery shard towards the threshold."""
    result = await social_recovery_service.submit_recovery_shard(case_id=case_id, payload=body)
    return success_response(data=result)


@router.get("/cases/{case_id}/status")
async def get_recovery_case_status(case_id: str):
    """Retrieve live status, shards collected, and 72-hour timelock countdown."""
    status = await social_recovery_service.get_recovery_case_status(case_id=case_id)
    return success_response(data=status)


@router.post("/cases/{case_id}/cancel")
async def cancel_recovery_case(case_id: str, body: CancelRecoveryRequest, request: Request):
    """Vault owner 1-click abort action that instantly cancels the recovery."""
    user_id = require_authenticated_user(request)
    result = await social_recovery_service.cancel_recovery(
        user_id=user_id,
        case_id=case_id,
        reason=body.reason or "Owner aborted unauthorized recovery",
    )
    return success_response(data=result)


@router.post("/cases/{case_id}/finalize")
async def finalize_recovery_case(case_id: str):
    """Finalize recovery after 72-hour timelock escrow has successfully elapsed."""
    result = await social_recovery_service.finalize_recovery(case_id=case_id)
    return success_response(data=result)
