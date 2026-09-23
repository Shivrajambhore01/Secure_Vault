"""
Nominee Verification Domain Schemas — SecureVault Enterprise
Multi-factor verification tracking for designated heirs.
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class NomineeVerificationSchema(BaseModel):
    id: str
    nomineeId: str
    vaultId: str
    emailOtpVerified: bool = False
    emailOtpVerifiedAt: Optional[str] = None
    smsOtpVerified: bool = False
    smsOtpVerifiedAt: Optional[str] = None
    govIdUploaded: bool = False
    govIdDocumentId: Optional[str] = None
    deathCertUploaded: bool = False
    deathCertDocumentId: Optional[str] = None
    overallStatus: str = "PENDING"  # PENDING | IN_REVIEW | VERIFIED | REJECTED
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
