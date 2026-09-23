"""
Phase 10: Security Operations, Auditing & SIEM Tests — SecureVault Enterprise
Tests:
- Cryptographic hash-chained audit ledger generation and verification
- Tamper detection when records are retroactively modified
- SIEM anomaly detector: Bulk asset secret decryption velocity (Harvesting flag)
- SIEM anomaly detector: Impossible travel between disparate geographic origins
- Administrative SOC containment: Immediate session revocation and lockdown
- Full API v1 /security/soc endpoints integration
"""

import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db
from app.security.tokens import create_access_token
from app.services.security_siem_service import (
    SecuritySiemService,
    ContainmentActionRequest,
    GENESIS_HASH,
)


@pytest.fixture
def siem_service():
    return SecuritySiemService(db)


@pytest.mark.asyncio
async def test_hash_chained_audit_ledger_integrity(siem_service):
    user_id = f"test_owner_p10_ledger_{uuid.uuid4().hex[:8]}"

    # Record 5 sequential audit events
    events = ["LOGIN", "VIEW_VAULT", "UPDATE_SETTINGS", "INVITE_NOMINEE", "DECRYPT_ASSET"]
    for i, ev in enumerate(events):
        log = await siem_service.record_chained_event(
            user_id=user_id,
            action=ev,
            resource="VAULT",
            resource_id=f"res_{i}",
            metadata={"step": i},
            ip="192.168.1.100",
        )
        assert log["chainIndex"] == i + 1
        if i == 0:
            assert log["prevHash"] == GENESIS_HASH
        assert log["entryHash"] is not None

    # Run integrity verification
    report = await siem_service.verify_audit_integrity(user_id=user_id)
    assert report["is_valid"] is True
    assert report["total_verified"] == 5


@pytest.mark.asyncio
async def test_hash_chain_tamper_detection(siem_service):
    user_id = f"test_owner_p10_tamper_{uuid.uuid4().hex[:8]}"

    # Record 3 events
    for i in range(3):
        await siem_service.record_chained_event(
            user_id=user_id,
            action=f"ACTION_{i}",
            resource="ASSET",
            resource_id=f"ast_{i}",
        )

    # Sanity check: chain is valid initially
    rep1 = await siem_service.verify_audit_integrity(user_id=user_id)
    assert rep1["is_valid"] is True

    # Malicious direct DB modification of block 2 (e.g., hacker altered metadata or action)
    await db.audit_logs.update_one(
        {"userId": user_id, "chainIndex": 2},
        {"$set": {"action": "TAMPERED_MALICIOUS_ACTION"}}
    )

    # Integrity verification must catch tampering
    rep2 = await siem_service.verify_audit_integrity(user_id=user_id)
    assert rep2["is_valid"] is False
    assert rep2["broken_at_index"] == 2
    assert "Tampered record" in rep2["reason"] or "prevHash mismatch" in rep2["reason"]


@pytest.mark.asyncio
async def test_siem_bulk_decrypt_velocity_threat(siem_service):
    user_id = f"test_owner_p10_bulk_{uuid.uuid4().hex[:8]}"

    # Simulate 4 rapid decryptions
    now_iso = datetime.now(timezone.utc).isoformat()
    for i in range(4):
        await db.audit_logs.insert_one({
            "id": f"log_dec_{i}",
            "userId": user_id,
            "action": "DECRYPT_ASSET_SECRET",
            "timestamp": now_iso,
        })

    # 5th decryption within window triggers threat
    eval_result = await siem_service.evaluate_threat_signals(
        user_id=user_id,
        event_type="ASSET_DECRYPT",
        context={"asset_id": "ast_999"},
    )

    assert eval_result["threat_detected"] is True
    assert eval_result["threat_type"] == "BULK_DECRYPT_ANOMALY"
    assert eval_result["severity"] == "CRITICAL"


@pytest.mark.asyncio
async def test_siem_impossible_travel_threat(siem_service):
    user_id = f"test_owner_p10_travel_{uuid.uuid4().hex[:8]}"

    # Record login 2 minutes ago from United States
    two_mins_ago = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
    await db.audit_logs.insert_one({
        "id": "log_login_us",
        "userId": user_id,
        "action": "LOGIN",
        "ip": "203.0.113.1",
        "metadata": {"country": "US", "city": "New York"},
        "timestamp": two_mins_ago,
    })

    # User immediately logs in from Japan (Impossible Travel)
    eval_result = await siem_service.evaluate_threat_signals(
        user_id=user_id,
        event_type="LOGIN_SUCCESS",
        context={"ip": "198.51.100.22", "country": "JP", "city": "Tokyo"},
    )

    assert eval_result["threat_detected"] is True
    assert eval_result["threat_type"] == "IMPOSSIBLE_TRAVEL"
    assert eval_result["severity"] == "HIGH"


@pytest.mark.asyncio
async def test_containment_action_session_eviction(siem_service):
    user_id = f"test_owner_p10_cont_{uuid.uuid4().hex[:8]}"

    # Seed 2 active user sessions
    await db.user_sessions.insert_many([
        {"id": "sess_1", "userId": user_id, "status": "ACTIVE"},
        {"id": "sess_2", "userId": user_id, "status": "ACTIVE"},
    ])

    res = await siem_service.execute_containment_action(
        user_id=user_id,
        payload=ContainmentActionRequest(
            action="REVOKE_ALL_SESSIONS",
            reason="SOC automated containment triggered by SIEM impossible travel alert.",
        ),
    )

    assert res["success"] is True
    assert res["action"] == "REVOKE_ALL_SESSIONS"
    assert res["affectedCount"] == 2

    # Verify sessions are revoked
    revoked_count = await db.user_sessions.count_documents({"userId": user_id, "status": "REVOKED"})
    assert revoked_count == 2


@pytest.mark.asyncio
async def test_v1_security_soc_endpoints_integration():
    user_id = f"test_owner_p10_api_{uuid.uuid4().hex[:8]}"
    token = create_access_token(data={"sub": user_id, "email": "soc_admin@example.com"})
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Seed 1 chained event via service
        service = SecuritySiemService(db)
        await service.record_chained_event(
            user_id=user_id,
            action="SOC_INIT",
            resource="SOC",
            resource_id="soc_1",
            metadata={"source": "api_test"},
        )

        # 1. GET /api/v1/security/soc/events
        events_res = await client.get("/api/v1/security/soc/events", headers=headers)
        assert events_res.status_code == 200
        data = events_res.json()["data"]
        assert len(data) >= 1
        assert "entryHash" in data[0]

        # 2. GET /api/v1/security/soc/integrity
        integ_res = await client.get("/api/v1/security/soc/integrity", headers=headers)
        assert integ_res.status_code == 200
        assert integ_res.json()["data"]["is_valid"] is True

        # 3. GET /api/v1/security/soc/threats
        threats_res = await client.get("/api/v1/security/soc/threats", headers=headers)
        assert threats_res.status_code == 200

        # 4. POST /api/v1/security/soc/containment
        cont_res = await client.post(
            "/api/v1/security/soc/containment",
            headers=headers,
            json={"action": "REVOKE_ALL_SESSIONS", "reason": "API test containment"}
        )
        assert cont_res.status_code == 200
        assert cont_res.json()["data"]["status"] == "CONTAINED"
