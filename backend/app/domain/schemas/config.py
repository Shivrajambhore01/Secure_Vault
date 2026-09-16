"""
Feature Flags & System Configuration Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Any, Dict, List
from pydantic import BaseModel, Field


class FeatureFlagSchema(BaseModel):
    id: str
    key: str  # e.g., "AI_OCR_AUTO_TRIGGER", "ENFORCE_COOLING_PERIOD"
    description: str
    isEnabled: bool = False
    enabledForRoles: List[str] = Field(default_factory=list)
    enabledForUserIds: List[str] = Field(default_factory=list)
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SystemConfigSchema(BaseModel):
    id: str
    key: str
    value: Any
    category: str = "SYSTEM"  # SECURITY | STORAGE | NOTIFICATION | COMPLIANCE
    description: str
    updatedBy: str = "system"
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
