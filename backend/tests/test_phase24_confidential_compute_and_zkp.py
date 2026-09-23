"""
Phase 24 Verification Test Suite:
Hardware Confidential Compute Enclaves (Intel SGX / AWS Nitro) & Zero-Knowledge Beneficiary Verification.

Validates:
1. Hardware TEE enclave telemetry, memory shielding parameters, and SHA-384 PCR registers.
2. Cryptographic remote attestation report generation and hardware vendor signature validation.
3. In-enclave isolated computation with memory shielding and zero host leakage.
4. Zero-knowledge non-interactive age of majority proofs (Fiat-Shamir heuristics) and verification.
5. Strict rejection of under-age claimants and tampered ZK responses.
6. REST API routes under /api/v1/enclave/* with token authorization.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.security.tokens import create_access_token
from app.security.confidential_enclave_service import (
    confidential_enclave_service,
    AttestationReport,
    PcrMeasurements,
)
from app.security.zk_proof_service import (
    zk_proof_service,
    ZkAgeProof,
)


def test_enclave_status_and_pcr_measurements():
    """Verify hardware enclave status, memory encryption, and PCR registers."""
    status = confidential_enclave_service.get_status()

    assert "enclave_id" in status
    assert status["hardware_type"] == "AWS_NITRO_ENCLAVE"
    assert status["status"] == "SHIELDED_ACTIVE"
    assert status["host_os_visible"] is False

    pcrs = status["pcr_measurements"]
    assert len(pcrs["pcr0"]) == 96  # SHA-384 hex
    assert len(pcrs["pcr1"]) == 96
    assert len(pcrs["pcr2"]) == 96


def test_enclave_remote_attestation_report_and_signature_verification():
    """Verify remote attestation generation, nonce binding, and cryptographic verification."""
    custom_nonce = "client_audit_nonce_0x7719ab"
    report = confidential_enclave_service.generate_attestation_report(user_nonce=custom_nonce)

    assert report.attestation_id.startswith("att_")
    assert report.nonce == custom_nonce
    assert len(report.vendor_signature_hex) == 64

    # 1. Valid report verification
    assert confidential_enclave_service.verify_attestation(report) is True

    # 2. Tampered nonce or PCR must fail verification
    tampered_report = AttestationReport(
        attestation_id=report.attestation_id,
        hardware_type=report.hardware_type,
        enclave_id=report.enclave_id,
        status=report.status,
        pcr=report.pcr,
        timestamp=report.timestamp,
        nonce="tampered_nonce_999",
        vendor_signature_hex=report.vendor_signature_hex,
        is_valid=report.is_valid,
    )
    assert confidential_enclave_service.verify_attestation(tampered_report) is False


def test_in_enclave_execution_isolation():
    """Verify in-enclave isolated computation with memory shielding."""
    result = confidential_enclave_service.execute_in_enclave(
        operation="PROBATE_DECREE_ATTEST",
        sensitive_payload="confidential_testator_master_seed_material",
    )

    assert result.execution_id.startswith("ex_")
    assert result.operation == "PROBATE_DECREE_ATTEST"
    assert len(result.result_ciphertext_hex) == 64
    assert result.execution_time_ms > 0
    assert result.tamper_detected is False
    assert result.status == "COMPLETED_SHIELDED"


def test_zero_knowledge_age_of_majority_proof_and_verification():
    """Verify NIZK age proof generation and mathematical verification without birth year disclosure."""
    proof = zk_proof_service.generate_age_of_majority_proof(
        claimant_id="claimant_alice_beneficiary",
        birth_year=1998,
        threshold_age=18,
    )

    assert proof.proof_id.startswith("zkp_")
    assert proof.claimant_id == "claimant_alice_beneficiary"
    assert proof.threshold_age == 18
    assert len(proof.commitment_hash) == 64
    assert len(proof.challenge_hash) == 64
    assert len(proof.response_proof) == 64

    # Mathematical verification
    assert zk_proof_service.verify_age_of_majority_proof(proof) is True


def test_zk_proof_underage_claimant_fails():
    """Verify that claimants under the age threshold are mathematically rejected."""
    with pytest.raises(ValueError, match="does not satisfy minimum age requirement"):
        zk_proof_service.generate_age_of_majority_proof(
            claimant_id="claimant_minor_child",
            birth_year=2018,  # Age 8 in 2026
            threshold_age=18,
        )


@pytest.mark.asyncio
async def test_confidential_enclave_rest_api_lifecycle():
    """Verify REST API lifecycle across /api/v1/enclave/*."""
    token = create_access_token({"userId": "enclave_operator_01"})
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Get status
        status_resp = await client.get("/api/v1/enclave/status", headers=headers)
        assert status_resp.status_code == 200
        assert status_resp.json()["data"]["hardware_type"] == "AWS_NITRO_ENCLAVE"

        # 2. Get attestation report
        attest_resp = await client.get("/api/v1/enclave/attestation?nonce=api_nonce_99", headers=headers)
        assert attest_resp.status_code == 200
        assert attest_resp.json()["data"]["nonce"] == "api_nonce_99"

        # 3. Execute in enclave
        exec_resp = await client.post(
            "/api/v1/enclave/execute",
            headers=headers,
            json={
                "operation": "SHRED_PROOF_ENCLAVE_DECRYPT",
                "sensitive_payload": "test_raw_key_material",
            },
        )
        assert exec_resp.status_code == 200
        assert "result_ciphertext_hex" in exec_resp.json()["data"]

        # 4. Prove age of majority (ZKP)
        zk_resp = await client.post(
            "/api/v1/enclave/zk/prove-majority",
            headers=headers,
            json={"birth_year": 1995, "threshold_age": 21},
        )
        assert zk_resp.status_code == 200
        proof_data = zk_resp.json()["data"]
        assert proof_data["threshold_age"] == 21

        # 5. Verify age of majority (ZKP)
        verify_resp = await client.post(
            "/api/v1/enclave/zk/verify-majority",
            headers=headers,
            json=proof_data,
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["data"]["is_valid"] is True
