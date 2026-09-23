"""
Zero-Trust & Hardware Passkey API Router — Phase 22.
Exposes Just-In-Time (JIT) ephemeral privilege elevation and FIDO2/WebAuthn hardware attestation.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.ephemeral_access_service import (
    ephemeral_access_service,
    JitScope,
)

router = APIRouter(prefix="/zerotrust", tags=["v1 - Zero-Trust & Hardware Attestation"])


class RequestGrantBody(BaseModel):
    scope: JitScope
    justification: str = Field(..., description="Operational reason for ephemeral privilege elevation")
    duration_minutes: int = Field(default=15, ge=5, le=60)


class ApproveGrantBody(BaseModel):
    pass


class RevokeGrantBody(BaseModel):
    reason: Optional[str] = "Manual emergency revocation via Zero-Trust console"


class WebAuthnVerifyBody(BaseModel):
    credential_id: str
    public_key_hex: str
    device_name: Optional[str] = "YubiKey 5C NFC"


@router.get("/grants")
async def list_access_grants(request: Request):
    """
    List active, pending, and expired Just-In-Time (JIT) privilege elevation grants.
    """
    _ = require_authenticated_user(request)
    grants = ephemeral_access_service.list_grants()
    return success_response(
        data=[g.model_dump() for g in grants],
        meta={"total": len(grants)}
    )


@router.post("/grants/request")
async def request_access_grant(
    body: RequestGrantBody,
    request: Request,
):
    """
    Submit a time-bounded Just-In-Time (JIT) privilege elevation request.
    """
    user_id = require_authenticated_user(request)
    grant = ephemeral_access_service.request_grant(
        requester_id=user_id,
        scope=body.scope,
        justification=body.justification,
        duration_minutes=body.duration_minutes,
    )
    return success_response(
        data=grant.model_dump(),
        meta={"message": f"JIT grant {grant.grant_id} submitted for security approval."}
    )


@router.post("/grants/{grant_id}/approve")
async def approve_access_grant(
    grant_id: str,
    request: Request,
):
    """
    Approve an ephemeral JIT elevation grant (requires distinct security officer).
    """
    approver_id = require_authenticated_user(request)
    try:
        approved = ephemeral_access_service.approve_grant(
            grant_id=grant_id,
            approver_id=approver_id,
        )
        return success_response(
            data=approved.model_dump(),
            meta={"message": f"Grant {grant_id} activated for {approved.duration_minutes} minutes."}
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/grants/{grant_id}/revoke")
async def revoke_access_grant(
    grant_id: str,
    body: RevokeGrantBody,
    request: Request,
):
    """
    Emergency termination of an active ephemeral grant.
    """
    revoker_id = require_authenticated_user(request)
    try:
        revoked = ephemeral_access_service.revoke_grant(
            grant_id=grant_id,
            revoker_id=revoker_id,
            reason=body.reason or "Emergency revocation",
        )
        return success_response(
            data=revoked.model_dump(),
            meta={"message": f"Grant {grant_id} revoked immediately."}
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/webauthn/challenge")
async def get_webauthn_challenge(request: Request):
    """
    Generate FIDO2 / WebAuthn registration challenge for hardware passkey attestation.
    """
    user_id = require_authenticated_user(request)
    challenge = ephemeral_access_service.generate_webauthn_challenge(user_id=user_id)
    return success_response(data=challenge, meta={"message": "FIDO2 registration challenge issued."})


@router.post("/webauthn/verify")
async def verify_webauthn_registration(
    body: WebAuthnVerifyBody,
    request: Request,
):
    """
    Verify attestation response and enroll hardware security key (FIDO2 / YubiKey).
    """
    user_id = require_authenticated_user(request)
    try:
        cred = ephemeral_access_service.verify_webauthn_registration(
            user_id=user_id,
            credential_id=body.credential_id,
            public_key_hex=body.public_key_hex,
            device_name=body.device_name or "Hardware Passkey",
        )
        return success_response(
            data=cred.model_dump(),
            meta={"message": "Hardware security key enrolled successfully."}
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/webauthn/credentials")
async def list_user_credentials(request: Request):
    """
    List enrolled FIDO2 hardware passkeys and authenticators for current user.
    """
    user_id = require_authenticated_user(request)
    creds = ephemeral_access_service.list_user_credentials(user_id=user_id)
    return success_response(data=[c.model_dump() for c in creds], meta={"total": len(creds)})
