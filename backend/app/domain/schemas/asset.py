"""
Asset Versions, Access Logs & Tags Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class AssetVersionSchema(BaseModel):
    id: str
    assetId: str
    vaultId: str
    versionNumber: int
    storageKey: str
    checksumSha256: str
    fileSizeBytes: int
    mimeType: Optional[str] = None
    changeSummary: Optional[str] = None
    createdBy: str
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AssetAccessSchema(BaseModel):
    id: str
    assetId: str
    userId: str  # Owner or Nominee ID
    accessorType: str  # OWNER | NOMINEE | ADMIN
    action: str  # VIEW | DOWNLOAD | DECRYPT | DELETE
    status: str = "SUCCESS"  # SUCCESS | DENIED | ERROR
    ipAddress: str = "unknown"
    userAgent: str = "unknown"
    accessedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AssetTagSchema(BaseModel):
    id: str
    vaultId: str
    name: str
    colorHex: str = "#7c3aed"
    description: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
