"""
Phase 22 Verification Test Suite:
Zero-Trust Ephemeral Access Grants, Just-In-Time (JIT) Elevation & Hardware FIDO2/WebAuthn Attestation.

Validates:
1. JIT elevation request lifecycle, parameter validation, and separation-of-duties enforcement.
2. Dynamic time-bounded validity, dual-officer activation, and automatic expiration handling.
3. Emergency administrative revocation immediately nullifying privileges.
4. FIDO2 / WebAuthn cryptographic challenge issuance, attestation registration, and credential inventory.
5. REST API routes under /api/v1/zerotrust/* with token authorization.
"""

import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.security.tokens import create_access_token
from app.services.ephemeral_access_service import (
    ephemeral_access_service,
    GrantStatus,
    JitScope,
)


def test_jit_grant_request_and_attributes():
    """Verify ephemeral JIT elevation request initialization and defaults."""
    grant = ephemeral_access_service.request_grant(
        requester_id="sec_eng_01",
        scope=JitScope.FORENSIC_READ,
        justification="Investigate anomalous egress traffic on cold vault enclave",
        duration_minutes=20,
    )

    assert grant.grant_id.startswith("jit_")
    assert grant.requester_id == "sec_eng_01"
    assert grant.scope == JitScope.FORENSIC_READ
    assert grant.duration_minutes == 20
    assert grant.status == GrantStatus.PENDING_APPROVAL
    assert grant.approver_id is None
    assert grant.expires_at is None
    assert grant.created_at is not None


def test_jit_grant_dual_approval_and_separation_of_duties():
    """Verify dual-control approval and strict separation of duties."""
    grant = ephemeral_access_service.request_grant(
        requester_id="sec_eng_02",
        scope=JitScope.KMS_MAINTENANCE,
        justification="Rotate hardware HSM master wrapping key",
        duration_minutes=15,
    )

    # 1. Requester cannot self-approve
    with pytest.raises(ValueError, match="Separation of duties violation"):
        ephemeral_access_service.approve_grant(
            grant_id=grant.grant_id,
            approver_id="sec_eng_02",
        )

    # 2. Independent security officer approves
    approved = ephemeral_access_service.approve_grant(
        grant_id=grant.grant_id,
        approver_id="ciso_officer_99",
    )

    assert approved.status == GrantStatus.ACTIVE_ELEVATED
    assert approved.approver_id == "ciso_officer_99"
    assert approved.expires_at is not None
    assert ephemeral_access_service.is_grant_valid(grant.grant_id) is True


def test_jit_grant_expiration_logic():
    """Verify automatic expiration when time window elapses."""
    grant = ephemeral_access_service.request_grant(
        requester_id="sec_eng_03",
        scope=JitScope.TENANT_MIGRATION,
        justification="Bulk re-encryption test",
        duration_minutes=10,
    )
    approved = ephemeral_access_service.approve_grant(
        grant_id=grant.grant_id,
        approver_id="ciso_officer_99",
    )

    # Artificially expire the grant
    expired_time = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    approved.expires_at = expired_time

    # is_grant_valid should mark it expired and return False
    assert ephemeral_access_service.is_grant_valid(grant.grant_id) is False
    assert approved.status == GrantStatus.EXPIRED

    # list_grants should reflect expired status
    grants = ephemeral_access_service.list_grants(requester_id="sec_eng_03")
    assert any(g.grant_id == grant.grant_id and g.status == GrantStatus.EXPIRED for g in grants)


def test_jit_grant_emergency_revocation():
    """Verify emergency revocation terminates privileges immediately."""
    grant = ephemeral_access_service.request_grant(
        requester_id="sec_eng_04",
        scope=JitScope.VAULT_EMERGENCY_RECOVERY,
        justification="Emergency asset unfreeze procedure",
        duration_minutes=30,
    )
    ephemeral_access_service.approve_grant(
        grant_id=grant.grant_id,
        approver_id="sec_lead_77",
    )
    assert ephemeral_access_service.is_grant_valid(grant.grant_id) is True

    # Revoke
    revoked = ephemeral_access_service.revoke_grant(
        grant_id=grant.grant_id,
        revoker_id="ciso_officer_99",
        reason="Suspicious outbound connection detected during elevation",
    )

    assert revoked.status == GrantStatus.REVOKED
    assert revoked.revoked_at is not None
    assert ephemeral_access_service.is_grant_valid(grant.grant_id) is False


def test_webauthn_challenge_generation_and_enrollment():
    """Verify FIDO2 / WebAuthn challenge creation, attestation, and passkey registration."""
    user_id = "user_fido2_tester_01"

    # 1. Generate challenge
    challenge = ephemeral_access_service.generate_webauthn_challenge(user_id=user_id)
    assert "challenge" in challenge
    assert challenge["rp"]["name"] == "SecureVault Institutional"
    assert challenge["user"]["id"] == user_id
    assert len(challenge["pubKeyCredParams"]) >= 2

    # 2. Complete registration
    cred = ephemeral_access_service.verify_webauthn_registration(
        user_id=user_id,
        credential_id="cred_hardware_yubikey_5ci",
        public_key_hex="3059301306072a8648ce3d020106082a8648ce3d03010703420004f1a2b3",
        device_name="YubiKey 5Ci Dual-Connector",
    )

    assert cred.credential_id == "cred_hardware_yubikey_5ci"
    assert cred.user_id == user_id
    assert cred.device_name == "YubiKey 5Ci Dual-Connector"
    assert cred.sign_count == 1

    # 3. Challenge must be consumed
    with pytest.raises(ValueError, match="No active registration challenge found"):
        ephemeral_access_service.verify_webauthn_registration(
            user_id=user_id,
            credential_id="cred_replay_attempt",
            public_key_hex="abcdef",
        )

    # 4. Inventory check
    creds = ephemeral_access_service.list_user_credentials(user_id=user_id)
    assert len(creds) == 1
    assert creds[0].credential_id == "cred_hardware_yubikey_5ci"


@pytest.mark.asyncio
async def test_zerotrust_rest_api_lifecycle():
    """Verify complete end-to-end API lifecycle across /api/v1/zerotrust/*."""
    token_requester = create_access_token({"userId": "api_requester_user"})
    headers_requester = {"Authorization": f"Bearer {token_requester}"}

    token_approver = create_access_token({"userId": "api_security_officer"})
    headers_approver = {"Authorization": f"Bearer {token_approver}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Request JIT grant
        req_resp = await client.post(
            "/api/v1/zerotrust/grants/request",
            headers=headers_requester,
            json={
                "scope": "FORENSIC_READ",
                "justification": "Automated integration testing for Phase 22",
                "duration_minutes": 15,
            },
        )
        assert req_resp.status_code == 200
        grant_data = req_resp.json()["data"]
        grant_id = grant_data["grant_id"]
        assert grant_data["status"] == "PENDING_APPROVAL"

        # 2. List grants
        list_resp = await client.get("/api/v1/zerotrust/grants", headers=headers_requester)
        assert list_resp.status_code == 200
        assert any(g["grant_id"] == grant_id for g in list_resp.json()["data"])

        # 3. Attempt self-approval (should fail with 400)
        self_approve = await client.post(
            f"/api/v1/zerotrust/grants/{grant_id}/approve",
            headers=headers_requester,
        )
        assert self_approve.status_code == 400
        assert "Separation of duties" in self_approve.json()["error"]["message"]

        # 4. Independent approver approves
        approve_resp = await client.post(
            f"/api/v1/zerotrust/grants/{grant_id}/approve",
            headers=headers_approver,
        )
        assert approve_resp.status_code == 200
        assert approve_resp.json()["data"]["status"] == "ACTIVE_ELEVATED"

        # 5. Revoke grant
        revoke_resp = await client.post(
            f"/api/v1/zerotrust/grants/{grant_id}/revoke",
            headers=headers_approver,
            json={"reason": "Security test routine complete"},
        )
        assert revoke_resp.status_code == 200
        assert revoke_resp.json()["data"]["status"] == "REVOKED"

        # 6. WebAuthn challenge generation
        challenge_resp = await client.post(
            "/api/v1/zerotrust/webauthn/challenge",
            headers=headers_requester,
        )
        assert challenge_resp.status_code == 200
        challenge_data = challenge_resp.json()["data"]
        assert "challenge" in challenge_data

        # 7. WebAuthn verify & enroll passkey
        verify_resp = await client.post(
            "/api/v1/zerotrust/webauthn/verify",
            headers=headers_requester,
            json={
                "credential_id": "cred_api_passkey_01",
                "public_key_hex": "04abcd1234ef",
                "device_name": "Titan Security Key USB-C",
            },
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["data"]["credential_id"] == "cred_api_passkey_01"

        # 8. List enrolled WebAuthn credentials
        creds_resp = await client.get(
            "/api/v1/zerotrust/webauthn/credentials",
            headers=headers_requester,
        )
        assert creds_resp.status_code == 200
        assert any(c["credential_id"] == "cred_api_passkey_01" for c in creds_resp.json()["data"])
