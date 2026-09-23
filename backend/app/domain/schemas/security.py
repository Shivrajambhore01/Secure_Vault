"""
Security Events, Alerts, Incidents & Evidence Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SecurityEventSchema(BaseModel):
    id: str
    userId: Optional[str] = None
    eventType: str  # LOGIN_FAILED | NEW_DEVICE | SUSPICIOUS_IP | LARGE_DOWNLOAD | VAULT_FROZEN
    severity: str = "INFO"  # INFO | LOW | MEDIUM | HIGH | CRITICAL
    ipAddress: str = "unknown"
    userAgent: str = "unknown"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SecurityAlertSchema(BaseModel):
    id: str
    eventId: str
    userId: str
    title: str
    message: str
    severity: str = "HIGH"
    isAcknowledged: bool = False
    acknowledgedAt: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class IncidentSchema(BaseModel):
    id: str
    incidentNumber: str  # INC-YYYY-NNNN
    title: str
    description: str
    affectedUserId: str
    severity: str = "HIGH"  # LOW | MEDIUM | HIGH | CRITICAL
    status: str = "INVESTIGATING"  # INVESTIGATING | CONTAINED | RESOLVED | CLOSED
    assignedInvestigatorId: Optional[str] = None
    containmentActions: List[str] = Field(default_factory=list)  # SESSIONS_REVOKED, VAULT_FROZEN
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    resolvedAt: Optional[str] = None


class IncidentEvidenceSchema(BaseModel):
    id: str
    incidentId: str
    evidenceType: str  # AUDIT_LOG | IP_RECORD | UPLOADED_FILE | SCREENSHOT
    description: str
    fileHash: Optional[str] = None
    collectedBy: str
    collectedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
