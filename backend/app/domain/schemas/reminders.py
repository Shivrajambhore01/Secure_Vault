"""
Reminders & Life Checks Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class ReminderSchema(BaseModel):
    id: str
    userId: str
    vaultId: str
    reminderType: str  # DOCUMENT_EXPIRY | INSURANCE_RENEWAL | ANNUAL_REVIEW | LIFE_CHECK
    title: str
    description: Optional[str] = None
    dueDate: str
    isCompleted: bool = False
    completedAt: Optional[str] = None
    notificationSent: bool = False
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
