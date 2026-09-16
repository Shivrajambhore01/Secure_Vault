"""
Approval Requests & Actions Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class ApprovalActionSchema(BaseModel):
    id: str
    requestId: str
    adminId: str
    adminRole: str
    action: str  # APPROVED | REJECTED
    notes: Optional[str] = None
    ipAddress: str = "unknown"
    actionAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ApprovalRequestSchema(BaseModel):
    id: str
    caseId: str
    assetId: Optional[str] = None
    approvalType: str = "DUAL"  # SINGLE | DUAL | MULTI | SUPERVISOR
    status: str = "PENDING"  # PENDING | APPROVED | REJECTED | EXPIRED
    requiredApprovalsCount: int = 2
    currentApprovalsCount: int = 0
    approvedByAdminIds: List[str] = Field(default_factory=list)
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
