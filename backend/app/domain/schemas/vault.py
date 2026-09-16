"""
Vault & Legacy Plan Domain Schemas — SecureVault Enterprise
Digital Vault containers and automated inheritance legacy plans.
"""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class LegacyPlanSchema(BaseModel):
    id: str
    vaultId: str
    userId: str
    checkInFrequencyDays: int = 30
    escalationSteps: List[dict] = Field(default_factory=list)
    emergencyContactIds: List[str] = Field(default_factory=list)
    coolingPeriodDays: int = 30
    autoReleaseEnabled: bool = False
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class VaultSchema(BaseModel):
    id: str
    userId: str
    organizationId: Optional[str] = None
    name: str = "Primary Digital Vault"
    description: Optional[str] = None
    status: str = "ACTIVE"  # ACTIVE | INACTIVE_WARNING | CLAIM_INITIATED | RELEASED | FROZEN
    legacyPlanId: Optional[str] = None
    isEncrypted: bool = True
    storageLimitBytes: int = 500 * 1024 * 1024
    storageUsedBytes: int = 0
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
