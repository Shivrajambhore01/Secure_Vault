"""
Compliance, Legal Archival & GDPR/CCPA Privacy API v1 Router — SecureVault Enterprise
Phase 13:
- POST /api/v1/compliance/export/request: Request GDPR Article 20 signed data manifest
- GET  /api/v1/compliance/export/{id}: Retrieve verifiable export package
- POST /api/v1/compliance/erasure/request: Execute GDPR Article 17 Right-to-be-Forgotten crypto-shredding
- GET  /api/v1/compliance/legal-hold: Retrieve legal hold state
- POST /api/v1/compliance/legal-hold: Impose or lift legal hold
- GET  /api/v1/compliance/privacy-consent: Get user privacy preferences
- PUT  /api/v1/compliance/privacy-consent: Update privacy consent settings
- GET  /api/v1/compliance/status: Overall compliance status
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.compliance_service import (
    ComplianceService,
    RightToErasureRequest,
    LegalHoldState,
    PrivacyConsentModel,
)

router = APIRouter(prefix="/compliance", tags=["v1 - Compliance"])
compliance_service = ComplianceService()


class LegalHoldRequest(BaseModel):
    user_id: str
    status: LegalHoldState
    reason: str = Field(..., min_length=5)


@router.post("/export/request")
async def request_data_export(request: Request):
    """Generate a complete, tamper-evident cryptographic data archive (GDPR Article 20)."""
    user_id = require_authenticated_user(request)
    result = await compliance_service.generate_data_export(user_id=user_id)
    return success_response(data=result, status_code=201)


@router.get("/export/{export_id}")
async def get_export_package(export_id: str, request: Request):
    """Retrieve the generated export package and SHA-256 integrity checksum."""
    user_id = require_authenticated_user(request)
    manifest = await compliance_service.get_export_manifest(export_id=export_id, user_id=user_id)
    return success_response(data=manifest)


@router.post("/erasure/request")
async def execute_erasure(payload: RightToErasureRequest, request: Request):
    """Execute Right-to-be-Forgotten: zeroizes DEKs, destroys shards, and redacts PII."""
    user_id = require_authenticated_user(request)
    result = await compliance_service.execute_right_to_erasure(user_id=user_id, payload=payload)
    return success_response(data=result)


@router.get("/legal-hold")
async def get_legal_hold(request: Request):
    """Retrieve active legal hold status for current user."""
    user_id = require_authenticated_user(request)
    under_hold, hold_info = await compliance_service.is_account_under_legal_hold(user_id=user_id)
    return success_response(data={"is_under_hold": under_hold, "details": hold_info})


@router.post("/legal-hold")
async def set_legal_hold(payload: LegalHoldRequest, request: Request):
    """Compliance officer / Administrator sets or lifts estate litigation legal hold."""
    officer_id = require_authenticated_user(request)
    result = await compliance_service.set_legal_hold(
        user_id=payload.user_id,
        hold_status=payload.status,
        reason=payload.reason,
        officer_id=officer_id,
    )
    return success_response(data=result)


@router.get("/privacy-consent")
async def get_privacy_consent(request: Request):
    """Retrieve privacy consent settings."""
    user_id = require_authenticated_user(request)
    consent = await compliance_service.get_privacy_consent(user_id=user_id)
    return success_response(data=consent)


@router.put("/privacy-consent")
async def update_privacy_consent(payload: PrivacyConsentModel, request: Request):
    """Update privacy consent and data retention settings."""
    user_id = require_authenticated_user(request)
    updated = await compliance_service.update_privacy_consent(user_id=user_id, updates=payload.model_dump())
    return success_response(data=updated)


@router.get("/status")
async def get_compliance_status(request: Request):
    """Comprehensive compliance and regulatory overview."""
    user_id = require_authenticated_user(request)
    status = await compliance_service.get_compliance_status(user_id=user_id)
    return success_response(data=status)
