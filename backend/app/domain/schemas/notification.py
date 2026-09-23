"""
Notification Delivery Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class NotificationDeliverySchema(BaseModel):
    id: str
    notificationId: str
    channel: str  # EMAIL | SMS | VOICE | IN_APP
    recipient: str
    provider: str  # GMAIL_SMTP | TWILIO | WEBSOCKET
    providerMessageId: Optional[str] = None
    status: str = "QUEUED"  # QUEUED | SENT | DELIVERED | FAILED | RETRYING
    attemptCount: int = 1
    errorMessage: Optional[str] = None
    deliveredAt: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
