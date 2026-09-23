"""
Phase 21 Verification Test Suite:
Institutional Multi-Custodian Governance, Time-Locked Emergency Recovery & Cold Storage Air-Gap Handshake.

Validates:
1. Proposal creation with M-of-N threshold rules.
2. Custodian signature collection, deduplication, and quorum threshold satisfaction.
3. Timelock delay enforcement blocking premature execution.
4. Vault owner emergency veto immediately nullifying proposals.
5. Cold-storage air-gap offline QR challenge generation and signature verification.
6. REST API routes (/api/v1/governance/*).
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.security.tokens import create_access_token
from app.services.custodian_consensus_service import (
    custodian_consensus_service,
    ProposalAction,
    ProposalState,
)


def test_create_custodian_proposal():
    """Verify proposal creation with threshold rules and initial state."""
    prop = custodian_consensus_service.create_proposal(
        vault_id="vlt_test_uhn_01",
        action=ProposalAction.EMERGENCY_UNFREEZE,
        description="Emergency unfreeze after living owner signal",
        threshold_required=3,
        total_custodians=5,
        timelock_seconds=0,
    )

    assert prop.proposal_id.startswith("prop_")
    assert prop.threshold_required == 3
    assert prop.total_custodians == 5
    assert prop.state == ProposalState.COLLECTING_SIGNATURES
    assert len(prop.signatures) == 0


def test_signature_collection_and_threshold_achievement():
    """Verify progressive signature collection, duplicate prevention, and quorum transition."""
    prop = custodian_consensus_service.create_proposal(
        vault_id="vlt_test_uhn_02",
        action=ProposalAction.ASSET_COLD_TRANSFER,
        description="Transfer keys to Swiss air-gapped vault",
        threshold_required=2,
        total_custodians=3,
        timelock_seconds=0,
    )

    # 1. First signature
    custodian_consensus_service.sign_proposal(
        proposal_id=prop.proposal_id,
        custodian_id="custodian_alpha",
        signature_hex="sig_alpha_12345",
    )
    assert prop.state == ProposalState.COLLECTING_SIGNATURES
    assert len(prop.signatures) == 1

    # 2. Duplicate signature rejected
    with pytest.raises(ValueError, match="already signed"):
        custodian_consensus_service.sign_proposal(
            proposal_id=prop.proposal_id,
            custodian_id="custodian_alpha",
            signature_hex="sig_alpha_duplicate",
        )

    # 3. Second signature satisfies threshold (2 of 2) -> EXECUTABLE
    custodian_consensus_service.sign_proposal(
        proposal_id=prop.proposal_id,
        custodian_id="custodian_beta",
        signature_hex="sig_beta_67890",
    )
    assert prop.state == ProposalState.EXECUTABLE

    # 4. Execute proposal
    executed = custodian_consensus_service.execute_proposal(prop.proposal_id)
    assert executed.state == ProposalState.EXECUTED


def test_timelock_enforcement_before_execution():
    """Verify timelock delay blocks execution until challenge window elapses."""
    prop = custodian_consensus_service.create_proposal(
        vault_id="vlt_test_uhn_03",
        action=ProposalAction.QUORUM_POLICY_MUTATION,
        description="Expand board of trustees",
        threshold_required=2,
        total_custodians=3,
        timelock_seconds=3600,  # 1 hour timelock
    )

    # Satisfy threshold
    custodian_consensus_service.sign_proposal(prop.proposal_id, "custodian_1", "sig_1")
    custodian_consensus_service.sign_proposal(prop.proposal_id, "custodian_2", "sig_2")

    assert prop.state == ProposalState.TIMELOCK_RUNNING
    assert prop.timelock_expires_at is not None

    # Immediate execution attempt must be rejected
    with pytest.raises(ValueError, match="Timelock active"):
        custodian_consensus_service.execute_proposal(prop.proposal_id)


def test_owner_emergency_veto():
    """Verify vault owner can veto and nullify proposals during voting or timelock."""
    prop = custodian_consensus_service.create_proposal(
        vault_id="vlt_test_uhn_04",
        action=ProposalAction.EMERGENCY_UNFREEZE,
        description="Rogue custodian unfreeze attempt",
        threshold_required=2,
        total_custodians=3,
    )

    custodian_consensus_service.sign_proposal(prop.proposal_id, "custodian_1", "sig_1")

    # Owner emergency veto
    vetoed = custodian_consensus_service.owner_veto_proposal(
        proposal_id=prop.proposal_id,
        owner_id="usr_owner_sovereign",
        reason="Unauthorized unfreeze attempt detected",
    )
    assert vetoed.state == ProposalState.VETOED_BY_OWNER

    # Cannot sign vetoed proposal
    with pytest.raises(ValueError, match="cannot accept signatures"):
        custodian_consensus_service.sign_proposal(prop.proposal_id, "custodian_2", "sig_2")


def test_airgap_challenge_generation_and_offline_verification():
    """Verify offline QR challenge manifest generation and cryptographic HMAC verification."""
    payload = {
        "vault_id": "vlt_cold_storage_99",
        "action": "SIGN_TRANSFER_AIRGAP",
        "amount_btc": 250,
    }

    # 1. Generate challenge
    envelope = custodian_consensus_service.generate_airgap_challenge(payload)
    assert envelope.challenge_id.startswith("airgap_")
    assert envelope.payload_hash is not None
    assert "SECUREVAULT_AIRGAP:V1:" in envelope.offline_qr_manifest

    # 2. Generate and verify valid offline signature
    pub_key_hex = "pub_hsm_offline_ledger_01"
    valid_sig = custodian_consensus_service.generate_simulated_airgap_signature(
        challenge_id=envelope.challenge_id,
        public_key_hex=pub_key_hex,
    )

    assert custodian_consensus_service.verify_airgap_signature(
        challenge_id=envelope.challenge_id,
        public_key_hex=pub_key_hex,
        signature_hex=valid_sig,
    ) is True

    # 3. Invalid signature rejected
    assert custodian_consensus_service.verify_airgap_signature(
        challenge_id=envelope.challenge_id,
        public_key_hex=pub_key_hex,
        signature_hex="corrupted_signature_12345",
    ) is False


@pytest.mark.asyncio
async def test_governance_api_endpoints_integration():
    """Verify REST API routes for proposals, signing, veto, and airgap challenges."""
    token = create_access_token({"userId": "usr_governance_tester"})
    headers = {
        "Authorization": f"Bearer {token}",
        "X-User-Role": "SECURITY_OFFICER",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create proposal
        create_resp = await client.post(
            "/api/v1/governance/proposals",
            headers=headers,
            json={
                "vault_id": "vlt_api_test_01",
                "action": "EMERGENCY_UNFREEZE",
                "description": "API Integration Test Proposal",
                "threshold_required": 2,
                "total_custodians": 3,
                "timelock_seconds": 0,
            },
        )
        assert create_resp.status_code == 200
        prop_data = create_resp.json()["data"]
        prop_id = prop_data["proposal_id"]

        # 2. List proposals
        list_resp = await client.get("/api/v1/governance/proposals")
        assert list_resp.status_code == 200
        assert any(p["proposal_id"] == prop_id for p in list_resp.json()["data"])

        # 3. Sign proposal
        sign_resp = await client.post(
            f"/api/v1/governance/proposals/{prop_id}/sign",
            headers=headers,
            json={"custodian_id": "custodian_api_1", "signature_hex": "sig_api_1"},
        )
        assert sign_resp.status_code == 200
        assert len(sign_resp.json()["data"]["signatures"]) == 1

        # 4. Owner veto
        veto_resp = await client.post(
            f"/api/v1/governance/proposals/{prop_id}/veto",
            headers=headers,
            json={"reason": "Testing emergency veto endpoint"},
        )
        assert veto_resp.status_code == 200
        assert veto_resp.json()["data"]["state"] == ProposalState.VETOED_BY_OWNER.value

        # 5. Air-gap challenge & verify
        airgap_resp = await client.post(
            "/api/v1/governance/airgap/challenge",
            headers=headers,
            json={"payload": {"testKey": "testVal"}},
        )
        assert airgap_resp.status_code == 200
        challenge_id = airgap_resp.json()["data"]["challenge_id"]

        sim_sig = custodian_consensus_service.generate_simulated_airgap_signature(
            challenge_id=challenge_id,
            public_key_hex="pub_api_tester",
        )

        verify_resp = await client.post(
            "/api/v1/governance/airgap/verify",
            headers=headers,
            json={
                "challenge_id": challenge_id,
                "public_key_hex": "pub_api_tester",
                "signature_hex": sim_sig,
            },
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["data"]["is_valid"] is True
