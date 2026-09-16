"""
Job Queue, Attempts & Dead Letter Jobs Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class JobAttemptSchema(BaseModel):
    id: str
    jobId: str
    attemptNumber: int
    workerId: str
    status: str  # RUNNING | SUCCEEDED | FAILED
    errorMessage: Optional[str] = None
    durationMs: Optional[float] = None
    startedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completedAt: Optional[str] = None


class DeadLetterJobSchema(BaseModel):
    id: str
    originalJobId: str
    jobType: str
    payload: Dict[str, Any]
    exhaustedAttempts: int
    finalError: str
    movedToDeadLetterAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
