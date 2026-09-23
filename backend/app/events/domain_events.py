"""
Domain Events — SecureVault Enterprise
Event classes published across the asynchronous event bus.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class DomainEvent(BaseModel):
    event_name: str
    occurred_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    payload: Dict[str, Any] = Field(default_factory=dict)
    actor_id: Optional[str] = None


class UserRegisteredEvent(DomainEvent):
    event_name: str = "user.registered"


class AssetCreatedEvent(DomainEvent):
    event_name: str = "asset.created"


class NomineeAddedEvent(DomainEvent):
    event_name: str = "nominee.added"


class ClaimSubmittedEvent(DomainEvent):
    event_name: str = "claim.submitted"


class DocumentUploadedEvent(DomainEvent):
    event_name: str = "document.uploaded"


class EmergencyHaltEvent(DomainEvent):
    event_name: str = "vault.emergency_halt"
