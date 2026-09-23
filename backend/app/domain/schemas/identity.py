"""
Identity & Access Domain Schemas — SecureVault Enterprise
Organizations, Memberships, Sessions, Devices, and Multi-Factor Authentication methods.
"""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class OrganizationSchema(BaseModel):
    id: str
    name: str
    slug: str
    ownerId: str
    tier: str = "ENTERPRISE"
    settings: dict = Field(default_factory=dict)
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MembershipSchema(BaseModel):
    id: str
    organizationId: str
    userId: str
    role: str = "MEMBER"  # OWNER | ADMIN | COMPLIANCE_OFFICER | AUDITOR | MEMBER
    permissions: List[str] = Field(default_factory=list)
    joinedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SessionSchema(BaseModel):
    id: str
    userId: str
    tokenHash: str
    deviceId: Optional[str] = None
    ipAddress: str = "unknown"
    userAgent: str = "unknown"
    isRevoked: bool = False
    revokedAt: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expiresAt: str


class DeviceSchema(BaseModel):
    id: str
    userId: str
    browser: str = "unknown"
    os: str = "unknown"
    ipAddress: str = "unknown"
    isTrusted: bool = False
    trustedAt: Optional[str] = None
    firstSeen: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    lastSeen: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MfaMethodSchema(BaseModel):
    id: str
    userId: str
    methodType: str  # TOTP | SMS | EMAIL | RECOVERY_CODES
    secret: Optional[str] = None  # Encrypted TOTP secret
    phoneNumber: Optional[str] = None
    backupCodes: List[str] = Field(default_factory=list)  # Hashed recovery codes
    isEnabled: bool = False
    enabledAt: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
