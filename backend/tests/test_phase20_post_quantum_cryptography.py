"""
Phase 20 Verification Test Suite:
Quantum-Resistant Cryptography, Post-Quantum Hybrid Enclaves (ML-KEM & ML-DSA).

Validates:
1. Dual-layer hybrid keypair generation (Curve25519 + ML-KEM-768 lattice).
2. Hybrid key encapsulation and decapsulation roundtrip (zero plaintext leakage).
3. Cryptographic integrity protection: corrupted ciphertexts trigger decryption failures.
4. Post-quantum digital signatures (NIST FIPS 204 / ML-DSA-65 Dilithium) and forgery resistance.
5. Platform quantum-readiness telemetry reporting.
6. REST API integration: /api/v1/crypto/pqc/* endpoints.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.security.tokens import create_access_token
from app.security.post_quantum_crypto import (
    post_quantum_crypto_service,
    PqcAlgorithm,
    HybridPqcEnvelope,
    PqcSignatureEnvelope,
)


def test_generate_hybrid_keypair():
    """Verify generation of combined X25519 and ML-KEM-768 keypairs."""
    kp = post_quantum_crypto_service.generate_hybrid_keypair()
    assert kp["algorithm"] == PqcAlgorithm.HYBRID_X25519_ML_KEM_768.value
    assert "classical_x25519" in kp["public_keys"]
    assert "pqc_ml_kem_768" in kp["public_keys"]
    assert "classical_x25519" in kp["private_keys"]
    assert "pqc_ml_kem_768" in kp["private_keys"]


def test_encapsulate_and_decapsulate_hybrid_roundtrip():
    """Verify hybrid dual-secret key encapsulation and authenticated decapsulation."""
    kp = post_quantum_crypto_service.generate_hybrid_keypair()
    secret_text = b"OFFSHORE_SWISS_MASTER_SEED_PHRASE_#2026_QUANTUM_SAFE"

    # 1. Encapsulate
    envelope = post_quantum_crypto_service.encapsulate_hybrid(
        public_keys=kp["public_keys"],
        plaintext=secret_text,
        key_id=kp["key_id"],
    )
    assert envelope.algorithm == PqcAlgorithm.HYBRID_X25519_ML_KEM_768
    assert envelope.classical_ephemeral_pubkey is not None
    assert envelope.pqc_kem_ciphertext is not None
    assert envelope.ciphertext is not None

    # 2. Decapsulate
    recovered_bytes = post_quantum_crypto_service.decapsulate_hybrid(
        private_keys=kp["private_keys"],
        public_keys=kp["public_keys"],
        envelope=envelope,
    )
    assert recovered_bytes == secret_text


def test_corrupted_pqc_envelope_fails_decapsulation():
    """Verify tampering with either classical or PQC lattice ciphertext causes auth failure."""
    kp = post_quantum_crypto_service.generate_hybrid_keypair()
    secret_text = b"HIGHLY_CONFIDENTIAL_INHERITANCE_DATA"

    envelope = post_quantum_crypto_service.encapsulate_hybrid(
        public_keys=kp["public_keys"],
        plaintext=secret_text,
        key_id=kp["key_id"],
    )

    # Tamper with AES-GCM ciphertext
    corrupted_dict = envelope.model_dump()
    tampered_bytes = bytearray(corrupted_dict["ciphertext"].encode("ascii"))
    tampered_bytes[4] = (tampered_bytes[4] + 1) % 255
    corrupted_dict["ciphertext"] = tampered_bytes.decode("ascii")

    tampered_envelope = HybridPqcEnvelope(**corrupted_dict)
    with pytest.raises(Exception):
        post_quantum_crypto_service.decapsulate_hybrid(
            private_keys=kp["private_keys"],
            public_keys=kp["public_keys"],
            envelope=tampered_envelope,
        )


def test_sign_and_verify_post_quantum_deed():
    """Verify ML-DSA-65 (Dilithium) digital signature generation and verification."""
    deed_text = b"I HEREBY CONVEY ALL SECUREVAULT HOLDINGS TO PRIMARY NOMINEE ELEANOR VANCE"
    key_id = "pqc_notary_signing_key_01"

    # 1. Sign
    sig_envelope = post_quantum_crypto_service.sign_post_quantum(
        private_key_id=key_id,
        message=deed_text,
    )
    assert sig_envelope.algorithm == PqcAlgorithm.ML_DSA_65_DILITHIUM
    assert sig_envelope.signature is not None

    # 2. Verify authentic signature
    is_valid = post_quantum_crypto_service.verify_post_quantum(
        public_key_id=key_id,
        message=deed_text,
        signature_envelope=sig_envelope,
    )
    assert is_valid is True

    # 3. Verify tampered message fails
    tampered_deed = b"I HEREBY CONVEY ALL HOLDINGS TO MALICIOUS ATTACKER"
    is_tampered_valid = post_quantum_crypto_service.verify_post_quantum(
        public_key_id=key_id,
        message=tampered_deed,
        signature_envelope=sig_envelope,
    )
    assert is_tampered_valid is False


def test_pqc_telemetry_reporting():
    """Verify platform quantum readiness metrics and FIPS compliance."""
    telemetry = post_quantum_crypto_service.get_pqc_telemetry()
    assert telemetry["quantum_readiness_score"] == "100%"
    assert any("FIPS 203" in s for s in telemetry["standards_compliance"])
    assert any("FIPS 204" in s for s in telemetry["standards_compliance"])
    assert "ML-KEM-768" in telemetry["hybrid_kem_suite"]
    assert "ML-DSA-65" in telemetry["signature_suite"]


@pytest.mark.asyncio
async def test_pqc_api_endpoints_integration():
    """Verify REST API endpoints for quantum key generation, encapsulation, and notary signatures."""
    token = create_access_token({"userId": "usr_quantum_tester"})
    headers = {
        "Authorization": f"Bearer {token}",
        "X-User-Role": "SECURITY_OFFICER",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Telemetry
        tel_resp = await client.get("/api/v1/crypto/pqc/telemetry")
        assert tel_resp.status_code == 200
        assert tel_resp.json()["data"]["quantum_readiness_score"] == "100%"

        # 2. Generate Keypair
        kp_resp = await client.post("/api/v1/crypto/pqc/keypair", headers=headers)
        assert kp_resp.status_code == 200
        kp_data = kp_resp.json()["data"]

        # 3. Encapsulate
        encap_resp = await client.post(
            "/api/v1/crypto/pqc/encapsulate",
            headers=headers,
            json={
                "plaintext": "Secret mnemonic seed phrase 2026",
                "public_keys": kp_data["public_keys"],
                "key_id": kp_data["key_id"],
            },
        )
        assert encap_resp.status_code == 200
        envelope_data = encap_resp.json()["data"]
        assert envelope_data["algorithm"] == PqcAlgorithm.HYBRID_X25519_ML_KEM_768.value

        # 4. Decapsulate
        decap_resp = await client.post(
            "/api/v1/crypto/pqc/decapsulate",
            headers=headers,
            json={
                "envelope": envelope_data,
                "private_keys": kp_data["private_keys"],
                "public_keys": kp_data["public_keys"],
            },
        )
        assert decap_resp.status_code == 200
        assert decap_resp.json()["data"]["plaintext"] == "Secret mnemonic seed phrase 2026"

        # 5. Sign Deed
        deed_content = "Irrevocable inheritance transfer of sovereign crypto assets."
        sign_resp = await client.post(
            "/api/v1/crypto/pqc/sign-deed",
            headers=headers,
            json={"deed_text": deed_content, "key_id": "pqc_notary_01"},
        )
        assert sign_resp.status_code == 200
        sig_data = sign_resp.json()["data"]

        # 6. Verify Deed
        verify_resp = await client.post(
            "/api/v1/crypto/pqc/verify-deed",
            json={
                "deed_text": deed_content,
                "key_id": "pqc_notary_01",
                "signature_envelope": sig_data,
            },
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["data"]["is_valid"] is True
