"""
Claim Case & Claim Event Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ClaimEventSchema(BaseModel):
    id: str
    caseId: str
    actorId: str
    actorRole: str  # OWNER | NOMINEE | ADMIN | SYSTEM
    eventType: str  # SUBMITTED | HALTED | DOCUMENTS_REQUESTED | APPROVED | REJECTED
    oldState: str
    newState: str
    reason: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ClaimCaseExtendedSchema(BaseModel):
    id: str
    caseNumber: str  # Format: CASE-YYYY-NNNNNN
    vaultId: str
    userId: str
    nomineeId: str
    status: str = "NEW"  # NEW | ASSIGNED | UNDER_REVIEW | WAITING_DOCUMENTS | APPROVED | REJECTED | CLOSED
    riskScore: int = 0
    riskLevel: str = "LOW"
    assignedAdminId: Optional[str] = None
    coolingPeriodDays: int = 30
    coolingPeriodEndsAt: Optional[str] = None
    verificationDocumentIds: List[str] = Field(default_factory=list)
    dualApprovalRequired: bool = False
    rejectionReason: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
