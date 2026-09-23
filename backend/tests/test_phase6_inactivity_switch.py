"""
Phase 06 Inactivity Detection & Dead Man's Switch Tests — SecureVault Enterprise
Tests multi-channel heartbeat recording, staged escalation states,
cooling grace periods, emergency travel pause with PIN, and switch endpoints.
"""

from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.inactivity_service import InactivityService
from app.domain.exceptions import UnauthorizedError, ValidationError
from app.core.database import db
from app.security.hashing import hash_secret
from app.security.tokens import create_access_token


@pytest.mark.asyncio
async def test_manual_heartbeat_reset():
    inactivity_service = InactivityService()
    test_user_id = "test_user_phase6_vigilant"

    # Setup user with lastActive set 50 days in past
    old_time = (datetime.now(timezone.utc) - timedelta(days=50)).isoformat()
    await db["users"].update_one(
        {"id": test_user_id},
        {
            "$set": {
                "id": test_user_id,
                "email": "vigilant@securevault.app",
                "lastActive": old_time,
                "inactivityPeriodDays": 90,
                "coolingPeriodDays": 14,
                "inactivityStage": "WARNING_STAGE_1",
            }
        },
        upsert=True,
    )

    # Record active heartbeat
    res = await inactivity_service.record_heartbeat(
        user_id=test_user_id,
        channel="WEB_PORTAL",
        client_ip="192.168.1.100",
    )
    assert res["success"] is True
    assert res["inactivity_stage"] == "ACTIVE"

    # Verify user state in DB
    user = await db["users"].find_one({"id": test_user_id})
    assert user["lastHeartbeatType"] == "WEB_PORTAL"
    assert user["inactivityStage"] == "ACTIVE"

    # Verify time is recent (within 5 seconds)
    recent_dt = datetime.fromisoformat(user["lastActive"])
    diff = (datetime.now(timezone.utc) - recent_dt).total_seconds()
    assert diff < 5.0


@pytest.mark.asyncio
async def test_switch_status_and_countdown_calculation():
    inactivity_service = InactivityService()
    test_user_id = "test_user_phase6_vigilant"

    # Set lastActive exactly 15 days ago with 60 day threshold
    fifteen_days_ago = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
    await db["users"].update_one(
        {"id": test_user_id},
        {
            "$set": {
                "lastActive": fifteen_days_ago,
                "inactivityPeriodDays": 60,
                "coolingPeriodDays": 14,
                "switchPaused": False,
            }
        },
    )

    status = await inactivity_service.get_switch_status(test_user_id)
    assert status["status"] == "ACTIVE"
    assert status["is_paused"] is False
    assert 14.5 <= status["days_elapsed"] <= 15.5
    assert 44.5 <= status["days_remaining"] <= 45.5
    assert 24.0 <= status["percentage_elapsed"] <= 26.0

    milestones = status["milestones"]
    assert "warning_stage_1" in milestones
    assert "warning_stage_2" in milestones
    assert "cooling_period_start" in milestones
    assert "claim_trigger_date" in milestones


@pytest.mark.asyncio
async def test_staged_escalation_transitions():
    inactivity_service = InactivityService()
    test_user_id = "test_user_phase6_vigilant"

    now = datetime.now(timezone.utc)
    # Standby = 60 days, Cooling = 14 days

    # 1. 35 days elapsed (58% of 60) -> WARNING_STAGE_1
    await db["users"].update_one(
        {"id": test_user_id},
        {"$set": {"lastActive": (now - timedelta(days=35)).isoformat()}}
    )
    s1 = await inactivity_service.evaluate_inactivity_state(test_user_id)
    assert s1 == "WARNING_STAGE_1"

    # 2. 50 days elapsed (83% of 60) -> WARNING_STAGE_2
    await db["users"].update_one(
        {"id": test_user_id},
        {"$set": {"lastActive": (now - timedelta(days=50)).isoformat()}}
    )
    s2 = await inactivity_service.evaluate_inactivity_state(test_user_id)
    assert s2 == "WARNING_STAGE_2"

    # 3. 65 days elapsed (> 60 days, but < 74 days) -> COOLING_PERIOD
    await db["users"].update_one(
        {"id": test_user_id},
        {"$set": {"lastActive": (now - timedelta(days=65)).isoformat()}}
    )
    s3 = await inactivity_service.evaluate_inactivity_state(test_user_id)
    assert s3 == "COOLING_PERIOD"

    # 4. 80 days elapsed (> 74 days) -> SWITCH_TRIGGERED
    await db["users"].update_one(
        {"id": test_user_id},
        {"$set": {"lastActive": (now - timedelta(days=80)).isoformat()}}
    )
    s4 = await inactivity_service.evaluate_inactivity_state(test_user_id)
    assert s4 == "SWITCH_TRIGGERED"


@pytest.mark.asyncio
async def test_emergency_pause_and_resume_with_pin():
    inactivity_service = InactivityService()
    test_user_id = "test_user_phase6_vigilant"

    # Configure user with PIN
    await db["users"].update_one(
        {"id": test_user_id},
        {"$set": {"pin": hash_secret("654321")}},
    )

    # Invalid PIN must fail
    with pytest.raises(UnauthorizedError):
        await inactivity_service.pause_switch(
            user_id=test_user_id,
            pin="000000",
            reason="Off-grid expedition",
        )

    # Valid PIN pause
    resume_target = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    pause_res = await inactivity_service.pause_switch(
        user_id=test_user_id,
        pin="654321",
        reason="Antarctic Research Expedition",
        resume_date=resume_target,
    )
    assert pause_res["is_paused"] is True
    assert pause_res["reason"] == "Antarctic Research Expedition"

    # Check status reports PAUSED
    status = await inactivity_service.get_switch_status(test_user_id)
    assert status["status"] == "PAUSED"
    assert status["is_paused"] is True

    # Resume switch
    resume_res = await inactivity_service.resume_switch(test_user_id)
    assert resume_res["is_paused"] is False

    resumed_status = await inactivity_service.get_switch_status(test_user_id)
    assert resumed_status["status"] == "ACTIVE"
    assert resumed_status["is_paused"] is False


@pytest.mark.asyncio
async def test_v1_vault_switch_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        test_user_id = "test_user_phase6_vigilant"
        token = create_access_token({"userId": test_user_id})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Heartbeat
        hb_res = await ac.post("/api/v1/vault/heartbeat", headers=headers, json={"channel": "MOBILE_CHECKIN"})
        assert hb_res.status_code == 200
        assert hb_res.json()["data"]["channel"] == "MOBILE_CHECKIN"

        # 2. Get status
        status_res = await ac.get("/api/v1/vault/switch/status", headers=headers)
        assert status_res.status_code == 200
        data = status_res.json()["data"]
        assert "days_remaining" in data
        assert "percentage_elapsed" in data
        assert "milestones" in data

        # 3. Update configuration
        cfg_res = await ac.put(
            "/api/v1/vault/switch/config",
            headers=headers,
            json={
                "inactivityPeriodDays": 90,
                "coolingPeriodDays": 21,
                "emergencyContacts": ["trusted.contact@family.org"],
            },
        )
        assert cfg_res.status_code == 200
        assert cfg_res.json()["data"]["inactivity_period_days"] == 90
        assert cfg_res.json()["data"]["cooling_period_days"] == 21
