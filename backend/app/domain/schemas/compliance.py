"""
Consents & Legal Documents Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class ConsentSchema(BaseModel):
    id: str
    userId: str
    consentType: str  # TERMS_OF_SERVICE | PRIVACY_POLICY | INHERITANCE_POWER_OF_ATTORNEY
    version: str = "1.0"
    ipAddress: str = "unknown"
    userAgent: str = "unknown"
    agreedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LegalDocumentSchema(BaseModel):
    id: str
    userId: str
    vaultId: str
    documentType: str  # LAST_WILL_AND_TESTAMENT | DIGITAL_EXECUTOR_APPOINTMENT | POWER_OF_ATTORNEY
    title: str
    fileSizeBytes: int
    isNotarized: bool = False
    jurisdictionCountry: str = "IN"
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
