"""
Risk Assessment & Risk Events Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Any, Dict, List
from pydantic import BaseModel, Field


class RiskEventSchema(BaseModel):
    id: str
    caseId: str
    signalName: str  # TOR_NODE | VPN_DETECTED | IMPOSSIBLE_TRAVEL | OCR_MISMATCH | OTP_BURST
    scoreImpact: int
    reason: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    detectedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RiskAssessmentSchema(BaseModel):
    id: str
    caseId: str
    nomineeId: str
    totalScore: int  # 0 to 100
    riskLabel: str  # LOW | MEDIUM | HIGH | CRITICAL
    subScores: Dict[str, int] = Field(default_factory=dict)  # identity, device, network, document
    requiresEscalation: bool = False
    contributingSignals: List[Dict[str, Any]] = Field(default_factory=list)
    evaluatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
