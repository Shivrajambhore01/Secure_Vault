"""
Policy Versions & Executions Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Any, Dict, List
from pydantic import BaseModel, Field


class PolicyVersionSchema(BaseModel):
    id: str
    policyId: str
    versionNumber: int
    conditions: List[Dict[str, Any]] = Field(default_factory=list)
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    changeSummary: str
    createdBy: str
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PolicyExecutionSchema(BaseModel):
    id: str
    policyId: str
    vaultId: str
    assetId: str
    nomineeId: str
    triggeredByEvent: str
    resultAllowed: bool
    unfulfilledRequirements: List[str] = Field(default_factory=list)
    executedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
