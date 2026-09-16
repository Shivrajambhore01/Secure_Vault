"""
Automated Pytest Suite — Phase 12: Notifications, Reminders & Communication Engine
Tests:
1. Email template rendering, variables, and dispatch logging
2. Twilio SMS E.164 phone normalization and delivery tracking
3. Twilio Programmable Voice TwiML XML payload generation
4. Sliding-window recipient rate limiting enforcement
5. Twilio delivery receipt status webhook lifecycle (SENT -> DELIVERED)
6. API v1 notifications endpoints integration (/api/v1/notifications/*)
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db
from app.domain.exceptions import ValidationError
from app.services.auth_service import AuthService
from app.services.notification_service import (
    NotificationService,
    NotificationDispatchPayload,
    NotificationChannel,
    NotificationPriority,
    DeliveryStatus,
    normalize_e164,
    generate_twiml_voice_xml,
    rate_limiter,
)


@pytest.fixture
def notif_service():
    return NotificationService(db=db)


@pytest.fixture
def auth_service():
    return AuthService()


@pytest.mark.asyncio
async def test_email_template_rendering_and_dispatch(notif_service):
    rate_limiter.reset()
    payload = NotificationDispatchPayload(
        recipient="custodian.test@securevault.io",
        channel=NotificationChannel.EMAIL,
        priority=NotificationPriority.HIGH,
        template_id="HEARTBEAT_WARNING",
        variables={
            "user_name": "Alexander Vance",
            "countdown": "36 hours",
            "checkin_url": "https://securevault.io/checkin?token=xyz",
        },
    )

    result = await notif_service.dispatch(payload=payload, user_id="usr_test_12_a")
    assert result["status"] == DeliveryStatus.SENT.value
    assert "Alexander Vance" in result["rendered_preview"]
    assert "⚠️" in result["subject"] or "Heartbeat" in result["subject"]

    # Verify log entry in MongoDB
    saved = await db["notification_logs"].find_one({"id": result["id"]})
    assert saved is not None
    assert saved["channel"] == "EMAIL"
    assert saved["priority"] == "HIGH"
    assert saved["recipient"] == "custodian.test@securevault.io"


@pytest.mark.asyncio
async def test_twilio_sms_dispatch_and_e164_normalization(notif_service):
    rate_limiter.reset()
    # Test valid phone formatting
    assert normalize_e164("(555) 234-5678") == "+15552345678"
    assert normalize_e164("+44 7911 123456") == "+447911123456"
    assert normalize_e164("15551234567") == "+15551234567"

    # Test invalid phone raises ValidationError
    with pytest.raises(ValidationError):
        normalize_e164("invalid_phone_string")

    with pytest.raises(ValidationError):
        normalize_e164("123")

    payload = NotificationDispatchPayload(
        recipient="+1 (555) 987-6543",
        channel=NotificationChannel.SMS,
        priority=NotificationPriority.EMERGENCY,
        template_id="TIMELOCK_ALERT",
        variables={
            "claimant_name": "Dr. Marcus Vance",
            "abort_url": "https://securevault.io/abort?token=abc",
        },
    )

    result = await notif_service.dispatch(payload=payload, user_id="usr_test_12_b")
    assert result["status"] == DeliveryStatus.SENT.value
    assert result["recipient"] == "+15559876543"
    assert "abort_url" not in result["rendered_preview"] or "https://securevault.io/abort" in result["rendered_preview"]


@pytest.mark.asyncio
async def test_twilio_voice_twiml_generation(notif_service):
    rate_limiter.reset()
    message = "Critical: SecureVault Dead Man's Switch escalation countdown active."
    twiml_simple = generate_twiml_voice_xml(message)
    assert '<?xml version="1.0" encoding="UTF-8"?>' in twiml_simple
    assert '<Say voice="Polly.Joanna" language="en-US">' in twiml_simple
    assert message in twiml_simple
    assert "</Response>" in twiml_simple

    # With Gather URL
    twiml_gather = generate_twiml_voice_xml(message, gather_action_url="https://api.securevault.io/voice/ack")
    assert '<Gather numDigits="1" action="https://api.securevault.io/voice/ack"' in twiml_gather


@pytest.mark.asyncio
async def test_recipient_rate_limiting_enforcement(notif_service):
    rate_limiter.reset()
    recipient = "spammer.target@example.com"
    payload = NotificationDispatchPayload(
        recipient=recipient,
        channel=NotificationChannel.EMAIL,
        template_id="GENERIC",
        variables={"message": "Ping attempt"},
    )

    # First 5 dispatches should succeed
    for i in range(5):
        res = await notif_service.dispatch(payload=payload, user_id="usr_limiter")
        assert res["status"] == DeliveryStatus.SENT.value

    # 6th dispatch within same window must be RATE_LIMITED
    blocked = await notif_service.dispatch(payload=payload, user_id="usr_limiter")
    assert blocked["status"] == DeliveryStatus.RATE_LIMITED.value
    assert blocked["retry_after"] > 0
    assert "rate limit" in blocked["message"].lower()
    rate_limiter.reset()


@pytest.mark.asyncio
async def test_twilio_status_webhook_lifecycle(notif_service):
    rate_limiter.reset()
    # Dispatch SMS to create an initial record
    payload = NotificationDispatchPayload(
        recipient="+15553334444",
        channel=NotificationChannel.SMS,
        template_id="SECURITY_ANOMALY",
        variables={"threat_type": "IMPOSSIBLE_TRAVEL", "soc_url": "https://securevault.io/soc"},
    )
    res = await notif_service.dispatch(payload=payload, user_id="usr_webhook_test")
    provider_ref = res["provider_ref"]

    # Simulate Twilio delivery status webhook
    webhook_payload = {
        "MessageSid": provider_ref,
        "MessageStatus": "delivered",
        "To": "+15553334444",
    }
    update_res = await notif_service.process_twilio_status_webhook(webhook_payload)
    assert update_res["updated"] is True
    assert update_res["status"] == DeliveryStatus.DELIVERED.value

    # Verify record in DB has been updated to DELIVERED
    updated_record = await db["notification_logs"].find_one({"providerRef": provider_ref})
    assert updated_record["status"] == DeliveryStatus.DELIVERED.value


@pytest.mark.asyncio
async def test_v1_notifications_api_endpoints(auth_service):
    rate_limiter.reset()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email = "notif.tester@securevault.io"
        await auth_service.users_col.delete_many({"email": email})
        try:
            reg = await auth_service.register(
                email=email,
                password="EnterprisePassword123!",
                full_name="Notification Tester",
                pin="123456",
            )
            if "email_verification_token" in reg:
                await auth_service.verify_email(reg["email_verification_token"])
        except Exception:
            pass
        login = await auth_service.login(
            email=email,
            password="EnterprisePassword123!",
        )
        token = login["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. POST /api/v1/notifications/dispatch
        dispatch_resp = await ac.post(
            "/api/v1/notifications/dispatch",
            json={
                "recipient": "tester.dest@example.com",
                "channel": "EMAIL",
                "priority": "HIGH",
                "template_id": "NOMINEE_INVITE",
                "variables": {
                    "nominee_name": "Elena Vance",
                    "invite_url": "https://securevault.io/nominee/invite?code=123",
                },
            },
            headers=headers,
        )
        assert dispatch_resp.status_code == 201
        data = dispatch_resp.json()["data"]
        assert data["status"] == "SENT"
        assert "Elena Vance" in data["rendered_preview"]

        # 2. GET /api/v1/notifications/history
        hist_resp = await ac.get("/api/v1/notifications/history", headers=headers)
        assert hist_resp.status_code == 200
        hist_data = hist_resp.json()["data"]
        assert hist_data["total"] >= 1

        # 3. GET /api/v1/notifications/preferences
        prefs_resp = await ac.get("/api/v1/notifications/preferences", headers=headers)
        assert prefs_resp.status_code == 200
        assert prefs_resp.json()["data"]["email_enabled"] is True

        # 4. PUT /api/v1/notifications/preferences
        upd_prefs_resp = await ac.put(
            "/api/v1/notifications/preferences",
            json={"sms_enabled": False, "voice_enabled": True, "phone_number": "+15558889999"},
            headers=headers,
        )
        assert upd_prefs_resp.status_code == 200
        upd_data = upd_prefs_resp.json()["data"]
        assert upd_data["sms_enabled"] is False
        assert upd_data["voice_enabled"] is True

        # 5. POST /api/v1/notifications/webhooks/twilio
        webhook_resp = await ac.post(
            "/api/v1/notifications/webhooks/twilio",
            json={"MessageSid": data["provider_ref"], "MessageStatus": "delivered"},
        )
        assert webhook_resp.status_code == 200
        assert webhook_resp.json()["data"]["status"] == "DELIVERED"

        # 6. POST /api/v1/notifications/webhooks/twiml/voice
        twiml_resp = await ac.post(
            "/api/v1/notifications/webhooks/twiml/voice",
            data={"message": "Urgent alert check-in required."},
        )
        assert twiml_resp.status_code == 200
        assert "application/xml" in twiml_resp.headers["content-type"]
        assert "<Response>" in twiml_resp.text
