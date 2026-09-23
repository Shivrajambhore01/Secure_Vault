"""
Automated Pytest Suite — Phase 13: Compliance, Legal Archival & GDPR/CCPA Privacy
Tests:
1. GDPR Article 20 data export manifest generation & SHA-256 checksum verification
2. Legal hold imposition blocks Right-to-be-Forgotten erasure (403 Forbidden)
3. Cryptographic zeroization (crypto-shredding) DEK destruction & PII scrubbing
4. Tamper-evident audit ledger hash chain continuity post-erasure
5. Compliance API v1 endpoints integration (/api/v1/compliance/*)
"""

import hashlib
import json
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db
from app.domain.exceptions import ForbiddenError, ValidationError
from app.services.auth_service import AuthService
from app.services.security_siem_service import SecuritySiemService
from app.services.compliance_service import (
    ComplianceService,
    LegalHoldState,
    RightToErasureRequest,
)


@pytest.fixture
def compliance_service():
    return ComplianceService(db=db)


@pytest.fixture
def audit_service():
    return SecuritySiemService(db=db)


@pytest.fixture
def auth_service():
    return AuthService()


@pytest.mark.asyncio
async def test_data_export_manifest_and_sha256_checksum(compliance_service, auth_service):
    email = "export.custodian@securevault.io"
    await auth_service.users_col.delete_many({"email": email})
    reg = await auth_service.register(
        email=email,
        password="ValidPassword@123",
        full_name="Export Custodian",
        pin="123456",
    )
    user_id = reg.get("user_id") or reg.get("id")

    # Insert a sample asset
    await db["vault_assets"].insert_one({
        "id": f"ast_{user_id}",
        "userId": user_id,
        "name": "Estate Will & Trust Agreement",
        "assetType": "DOCUMENT",
        "dekEncrypted": "mock_encrypted_dek",
    })

    export_res = await compliance_service.generate_data_export(user_id=user_id)
    assert export_res["status"] == "READY"
    assert "sha256_checksum" in export_res
    manifest = export_res["download_payload"]
    assert manifest["regulatory_framework"] == "GDPR_ARTICLE_20_AND_CCPA"
    assert manifest["custodian_profile"]["email"] == email
    assert len(manifest["assets_manifest"]["items"]) == 1
    # Checksum verification
    manifest_json = json.dumps(manifest, sort_keys=True, default=str)
    recomputed_hash = hashlib.sha256(manifest_json.encode("utf-8")).hexdigest()
    assert export_res["sha256_checksum"] == recomputed_hash


@pytest.mark.asyncio
async def test_legal_hold_blocks_erasure(compliance_service, auth_service):
    email = "legal.hold.test@securevault.io"
    await auth_service.users_col.delete_many({"email": email})
    reg = await auth_service.register(
        email=email,
        password="ValidPassword@123",
        full_name="Legal Hold Custodian",
        pin="123456",
    )
    user_id = reg.get("user_id") or reg.get("id")

    # 1. Impose legal hold
    hold_res = await compliance_service.set_legal_hold(
        user_id=user_id,
        hold_status=LegalHoldState.ACTIVE,
        reason="Probate Litigation Case #2026-CV-8891",
        officer_id="officer_sarah_jenkins",
    )
    assert hold_res["status"] == "ACTIVE"

    # 2. Verify account is under legal hold
    is_held, details = await compliance_service.is_account_under_legal_hold(user_id)
    assert is_held is True
    assert details["reason"] == "Probate Litigation Case #2026-CV-8891"

    # 3. Attempt Right-to-be-Forgotten erasure -> MUST FAIL
    req = RightToErasureRequest(confirmation_phrase="PERMANENTLY ZEROIZE ALL MY DATA")
    with pytest.raises(ForbiddenError) as exc_info:
        await compliance_service.execute_right_to_erasure(user_id=user_id, payload=req)
    assert "Active legal hold is in place" in str(exc_info.value)

    # 4. Lift legal hold
    lift_res = await compliance_service.set_legal_hold(
        user_id=user_id,
        hold_status=LegalHoldState.RELEASED,
        reason="Probate Litigation Settled",
        officer_id="officer_sarah_jenkins",
    )
    assert lift_res["status"] == "RELEASED"
    is_held_after, _ = await compliance_service.is_account_under_legal_hold(user_id)
    assert is_held_after is False


@pytest.mark.asyncio
async def test_crypto_shredding_zeroization(compliance_service, auth_service):
    email = "shred.target@securevault.io"
    await auth_service.users_col.delete_many({"email": email})
    reg = await auth_service.register(
        email=email,
        password="ValidPassword@123",
        full_name="Shred Target User",
        pin="123456",
    )
    user_id = reg.get("user_id") or reg.get("id")

    # Insert assets and recovery config
    await db["vault_assets"].insert_many([
        {"id": f"a1_{user_id}", "userId": user_id, "name": "Secret Key", "dekEncrypted": "xyz"},
        {"id": f"a2_{user_id}", "userId": user_id, "name": "Swiss Bank Details", "dekEncrypted": "abc"},
    ])
    await db["social_recovery_configs"].insert_one({"userId": user_id, "threshold_k": 3, "total_shards_n": 5})

    # Test invalid confirmation phrase rejected
    with pytest.raises(ValidationError):
        await compliance_service.execute_right_to_erasure(
            user_id=user_id,
            payload=RightToErasureRequest(confirmation_phrase="wrong phrase"),
        )

    # Execute valid erasure
    res = await compliance_service.execute_right_to_erasure(
        user_id=user_id,
        payload=RightToErasureRequest(confirmation_phrase="PERMANENTLY ZEROIZE ALL MY DATA"),
    )
    assert res["status"] == "PURGED_FORGOTTEN"
    assert res["shredded_assets"] == 2

    # Verify assets completely purged
    remaining_assets = await db["vault_assets"].count_documents({"userId": user_id})
    assert remaining_assets == 0

    # Verify user record is zeroized
    from bson import ObjectId
    user_q = {"$or": [{"_id": ObjectId(user_id)}, {"id": user_id}]} if ObjectId.is_valid(user_id) else {"id": user_id}
    purged_user = await db["users"].find_one(user_q)
    assert purged_user["status"] == "PURGED_FORGOTTEN"
    assert "ZEROIZED" in purged_user["password_hash"]
    assert "purged_" in purged_user["email"]


@pytest.mark.asyncio
async def test_audit_chain_continuity_post_redaction(compliance_service, audit_service, auth_service):
    email = "audit.redact@securevault.io"
    await auth_service.users_col.delete_many({"email": email})
    reg = await auth_service.register(
        email=email,
        password="ValidPassword@123",
        full_name="Audit Redaction Test",
        pin="123456",
    )
    user_id = reg.get("user_id") or reg.get("id")

    # Add sample audit events
    await audit_service.record_chained_event(
        user_id=user_id, action="LOGIN_ATTEMPT", resource="auth", ip="192.168.1.100"
    )
    await audit_service.record_chained_event(
        user_id=user_id, action="SECRET_DECRYPT", resource="vault", ip="192.168.1.100"
    )

    # Verify chain before
    before_status = await audit_service.verify_audit_integrity(user_id=user_id)
    assert before_status["is_valid"] is True

    # Execute erasure (which redacts IP / userAgent in audit records)
    await compliance_service.execute_right_to_erasure(
        user_id=user_id,
        payload=RightToErasureRequest(confirmation_phrase="PERMANENTLY ZEROIZE ALL MY DATA"),
    )

    # Verify audit chain integrity still holds
    post_status = await audit_service.verify_audit_integrity(user_id=user_id)
    assert post_status["is_valid"] is True
    assert post_status["total_verified"] >= 3


@pytest.mark.asyncio
async def test_v1_compliance_api_endpoints(auth_service):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        email = "compliance.api.tester@securevault.io"
        await auth_service.users_col.delete_many({"email": email})
        reg = await auth_service.register(
            email=email,
            password="EnterprisePassword123!",
            full_name="Compliance Tester",
            pin="123456",
        )
        if "email_verification_token" in reg:
            await auth_service.verify_email(reg["email_verification_token"])
        login = await auth_service.login(email=email, password="EnterprisePassword123!")
        token = login["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. POST /api/v1/compliance/export/request
        exp_resp = await ac.post("/api/v1/compliance/export/request", headers=headers)
        assert exp_resp.status_code == 201
        exp_data = exp_resp.json()["data"]
        export_id = exp_data["export_id"]
        assert exp_data["status"] == "READY"
        assert "sha256_checksum" in exp_data

        # 2. GET /api/v1/compliance/export/{export_id}
        pkg_resp = await ac.get(f"/api/v1/compliance/export/{export_id}", headers=headers)
        assert pkg_resp.status_code == 200
        assert pkg_resp.json()["data"]["id"] == export_id

        # 3. GET /api/v1/compliance/privacy-consent
        consent_resp = await ac.get("/api/v1/compliance/privacy-consent", headers=headers)
        assert consent_resp.status_code == 200
        assert "idv_data_retention_days" in consent_resp.json()["data"]

        # 4. PUT /api/v1/compliance/privacy-consent
        upd_consent_resp = await ac.put(
            "/api/v1/compliance/privacy-consent",
            json={
                "telemetry_sharing": False,
                "idv_data_retention_days": 60,
                "marketing_opt_in": False,
                "third_party_notary_share": True,
                "cookie_analytics": False,
            },
            headers=headers,
        )
        assert upd_consent_resp.status_code == 200
        assert upd_consent_resp.json()["data"]["idv_data_retention_days"] == 60

        # 5. GET /api/v1/compliance/status
        status_resp = await ac.get("/api/v1/compliance/status", headers=headers)
        assert status_resp.status_code == 200
        status_data = status_resp.json()["data"]
        assert status_data["legal_hold"]["is_active"] is False
        assert "GDPR" in status_data["regulatory_framework"]
