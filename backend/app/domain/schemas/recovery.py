"""
Emergency Access & Recovery Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class EmergencyAccessSchema(BaseModel):
    id: str
    vaultId: str
    userId: str  # Owner
    requesterEmail: str
    requesterName: str
    status: str = "PENDING"  # PENDING | GRANTED | REJECTED | EXPIRED | HALTED
    accessDurationHours: int = 24
    coolingPeriodHours: int = 48
    accessEndsAt: Optional[str] = None
    emergencyToken: str
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RecoveryRequestSchema(BaseModel):
    id: str
    userId: str
    recoveryType: str  # PASSWORD | PIN | LOST_MFA | COMPROMISED_ACCOUNT
    status: str = "INITIATED"  # INITIATED | VERIFYING | APPROVED | COMPLETED | REJECTED
    verificationMethod: str  # EMAIL_AND_RECOVERY_CODES | COMPLIANCE_INTERVIEW
    recoveryToken: str
    expiresAt: str
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
