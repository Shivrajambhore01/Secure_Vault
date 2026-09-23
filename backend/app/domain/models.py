"""
Domain Schemas & Entities — SecureVault Enterprise
Pydantic v2 domain representations for core entities.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field
from app.domain.value_objects import (
    AdminRole,
    ApprovalType,
    AssetCategory,
    AssetStatus,
    ClaimStatus,
    JobStatus,
    NomineeStatus,
    NomineeType,
    RiskLevel,
    SensitivityLevel,
    VaultState,
)


class UserEntity(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    fullName: str
    phone: Optional[str] = None
    inactivityPeriod: float = 6.0
    lastActive: Optional[str] = None
    logoutTime: Optional[str] = None
    storageUsed: int = 0
    storageLimit: int = 500 * 1024 * 1024
    plan: str = "free"
    createdAt: Optional[str] = None


class AssetEntity(BaseModel):
    id: str
    userId: str
    name: str
    category: AssetCategory = AssetCategory.DOCUMENTS
    subcategory: Optional[str] = None
    description: Optional[str] = None
    sensitivity: SensitivityLevel = SensitivityLevel.MEDIUM
    status: AssetStatus = AssetStatus.ACTIVE
    fileName: Optional[str] = None
    fileSize: int = 0
    mimeType: Optional[str] = None
    isEncrypted: bool = True
    nomineeIds: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    releasePolicyId: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class NomineeEntity(BaseModel):
    id: str
    userId: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    relationship: str
    nomineeType: NomineeType = NomineeType.PRIMARY
    status: NomineeStatus = NomineeStatus.PENDING
    allocatedAssetIds: List[str] = Field(default_factory=list)
    createdAt: Optional[str] = None


class PolicyEntity(BaseModel):
    id: str
    userId: str
    name: str
    description: Optional[str] = None
    trigger: str = "VAULT_INHERITANCE_MODE"
    conditions: List[Dict[str, Any]] = Field(default_factory=list)
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    requiredApprovals: ApprovalType = ApprovalType.SINGLE
    requiresDualApproval: bool = False
    requiresPin: bool = False
    coolingPeriodDays: int = 30
    createdAt: Optional[str] = None


class ClaimCaseEntity(BaseModel):
    id: str
    userId: str
    nomineeId: str
    caseNumber: str
    status: ClaimStatus = ClaimStatus.NEW
    coolingPeriodEnd: Optional[str] = None
    riskScore: int = 0
    riskLevel: RiskLevel = RiskLevel.LOW
    assignedAdminId: Optional[str] = None
    documents: List[Dict[str, Any]] = Field(default_factory=list)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class JobEntity(BaseModel):
    id: str
    jobType: str
    status: JobStatus = JobStatus.QUEUED
    payload: Dict[str, Any] = Field(default_factory=dict)
    attempts: int = 0
    maxAttempts: int = 3
    error: Optional[str] = None
    durationMs: Optional[float] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


# Re-export expanded enterprise collection schemas
from app.domain.schemas import *

