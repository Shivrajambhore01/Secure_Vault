"""
Notifications & Communication API v1 Router — SecureVault Enterprise
Phase 12:
- POST /api/v1/notifications/dispatch: Dispatch message across Email/SMS/Voice
- GET  /api/v1/notifications/history: Notification audit log
- GET  /api/v1/notifications/preferences: Get user communication channel preferences
- PUT  /api/v1/notifications/preferences: Update notification preferences
- POST /api/v1/notifications/webhooks/twilio: Twilio delivery status callback handler
- POST /api/v1/notifications/webhooks/twiml/voice: Twilio Voice TwiML responder
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.notification_service import (
    NotificationService,
    NotificationDispatchPayload,
    NotificationChannel,
    NotificationPriority,
    generate_twiml_voice_xml,
)

router = APIRouter(prefix="/notifications", tags=["v1 - Notifications"])
notification_service = NotificationService()


class UpdatePreferencesRequest(BaseModel):
    email_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    voice_enabled: Optional[bool] = None
    heartbeat_alerts: Optional[bool] = None
    security_alerts: Optional[bool] = None
    claim_alerts: Optional[bool] = None
    escrow_alerts: Optional[bool] = None
    phone_number: Optional[str] = None


@router.post("/dispatch")
async def dispatch_notification(payload: NotificationDispatchPayload, request: Request):
    """Dispatch a transactional notification across Email, Twilio SMS, or Twilio Voice."""
    user_id = require_authenticated_user(request)
    result = await notification_service.dispatch(payload=payload, user_id=user_id)
    return success_response(data=result, status_code=201)


@router.get("/history")
async def get_notification_history(
    request: Request,
    limit: int = 50,
    skip: int = 0,
    channel: Optional[str] = None,
):
    """Retrieve audit ledger of dispatched notifications for the authenticated user."""
    user_id = require_authenticated_user(request)
    items, total = await notification_service.get_notification_history(
        user_id=user_id, limit=limit, skip=skip, channel=channel
    )
    return success_response(
        data={
            "items": items,
            "total": total,
            "limit": limit,
            "skip": skip,
        }
    )


@router.get("/preferences")
async def get_preferences(request: Request):
    """Retrieve user's communication channel and event alert preferences."""
    user_id = require_authenticated_user(request)
    prefs = await notification_service.get_user_preferences(user_id)
    return success_response(data=prefs.model_dump())


@router.put("/preferences")
async def update_preferences(body: UpdatePreferencesRequest, request: Request):
    """Update user's communication preferences (SMS/Email/Voice opt-ins)."""
    user_id = require_authenticated_user(request)
    updates = body.model_dump(exclude_unset=True)
    updated_prefs = await notification_service.update_user_preferences(user_id, updates)
    return success_response(data=updated_prefs.model_dump())


@router.post("/webhooks/twilio")
async def twilio_status_callback(request: Request):
    """Receive Twilio delivery status callbacks for SMS and Voice calls."""
    # Twilio sends Form data or JSON
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form_data = await request.form()
        payload = dict(form_data)

    result = await notification_service.process_twilio_status_webhook(payload)
    return success_response(data=result)


@router.post("/webhooks/twiml/voice")
async def twilio_voice_twiml(request: Request):
    """Return TwiML XML payload for Twilio Programmable Voice calls."""
    form_data = await request.form()
    message = form_data.get("message") or "Alert from SecureVault. An urgent life event check-in is pending."
    twiml_xml = generate_twiml_voice_xml(message)
    return Response(content=twiml_xml, media_type="application/xml")
