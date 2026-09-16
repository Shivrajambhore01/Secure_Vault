"""
Integrations, OAuth Connections & Webhooks Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class OAuthConnectionSchema(BaseModel):
    id: str
    userId: str
    provider: str  # GOOGLE | MICROSOFT | APPLE | GITHUB
    providerUserId: str
    email: Optional[str] = None
    connectedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class WebhookSchema(BaseModel):
    id: str
    organizationId: Optional[str] = None
    url: str
    secret: str
    subscribedEvents: List[str] = Field(default_factory=list)  # claim.approved, asset.released, etc.
    isActive: bool = True
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class IntegrationSchema(BaseModel):
    id: str
    userId: str
    integrationType: str  # CLOUD_STORAGE | PASSWORD_MANAGER | LEGAL_TECH
    name: str
    config: Dict[str, Any] = Field(default_factory=dict)
    isEnabled: bool = True
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
