"""
Verification API v1 Router — SecureVault Enterprise
Phase 09: Automated IDV (Persona/Veriff) & e-Notary (DocuSign/Notarize)
Endpoints:
- POST /api/v1/verification/idv/session: Initialize biometric government ID verification
- GET  /api/v1/verification/idv/{session_id}: Check live IDV status & liveness score
- POST /api/v1/verification/notary/session: Initialize remote online notarization (RON) envelope
- GET  /api/v1/verification/notary/{envelope_id}: Get notarization seal and commission metadata
- POST /api/v1/verification/webhooks/idv: Cryptographic HMAC-SHA256 receiver for IDV provider
- POST /api/v1/verification/webhooks/notary: Cryptographic HMAC-SHA256 receiver for e-Notary provider
- GET  /api/v1/verification/fraud-rules: Active fraud rules
"""

import json
from typing import Optional
from fastapi import APIRouter, Request, Header
from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.claim_service import ClaimService
from app.services.identity_notary_service import (
    IdentityNotaryService,
    IDVSessionRequest,
    NotarySessionRequest,
)
from app.api.verification_workflow import (
    router as workflow_router,
)

router = APIRouter(prefix="/verification", tags=["v1 - Verification"])
claim_service = ClaimService()
idv_notary_service = IdentityNotaryService()

# Re-route standard subpaths to legacy verification workflow implementation
router.include_router(workflow_router, prefix="")


@router.get("/fraud-rules")
async def get_fraud_rules():
    """Retrieve active fraud scoring rules, risk factors, and point weights."""
    rules = await claim_service.get_fraud_rules()
    return success_response(data=rules)


# --- Biometric IDV Session Endpoints ---

@router.post("/idv/session")
async def create_idv_session(body: IDVSessionRequest, request: Request):
    """Initialize a biometric government ID inquiry session (Veriff / Persona / Sumsub)."""
    user_id = require_authenticated_user(request)
    session = await idv_notary_service.create_idv_session(user_id=user_id, payload=body)
    return success_response(data=session, status_code=201)


@router.get("/idv/{session_id}")
async def get_idv_session(session_id: str):
    """Retrieve live verification session details and liveness results."""
    session = await idv_notary_service.get_idv_session(session_id)
    return success_response(data=session)


# --- Electronic Notary (RON) Endpoints ---

@router.post("/notary/session")
async def create_notary_session(body: NotarySessionRequest, request: Request):
    """Initialize an electronic remote online notarization envelope."""
    user_id = require_authenticated_user(request)
    envelope = await idv_notary_service.create_notary_session(user_id=user_id, payload=body)
    return success_response(data=envelope, status_code=201)


@router.get("/notary/{envelope_id}")
async def get_notary_envelope(envelope_id: str):
    """Retrieve notarization envelope details and cryptographic commission seal."""
    envelope = await idv_notary_service.get_notary_envelope(envelope_id)
    return success_response(data=envelope)


# --- Cryptographic Inbound Webhooks ---

@router.post("/webhooks/idv")
async def handle_idv_webhook(
    request: Request,
    x_signature_sha256: Optional[str] = Header(None, alias="X-Signature-SHA256"),
):
    """Cryptographic webhook receiver for biometric IDV provider callbacks."""
    raw_body = await request.body()
    payload = json.loads(raw_body.decode("utf-8") or "{}")
    result = await idv_notary_service.process_idv_webhook(
        payload=payload,
        raw_body=raw_body,
        signature_header=x_signature_sha256,
        enforce_signature=True,
    )
    return success_response(data=result)


@router.post("/webhooks/notary")
async def handle_notary_webhook(
    request: Request,
    x_signature_sha256: Optional[str] = Header(None, alias="X-Signature-SHA256"),
):
    """Cryptographic webhook receiver for electronic notary provider callbacks."""
    raw_body = await request.body()
    payload = json.loads(raw_body.decode("utf-8") or "{}")
    result = await idv_notary_service.process_notary_webhook(
        payload=payload,
        raw_body=raw_body,
        signature_header=x_signature_sha256,
        enforce_signature=True,
    )
    return success_response(data=result)
