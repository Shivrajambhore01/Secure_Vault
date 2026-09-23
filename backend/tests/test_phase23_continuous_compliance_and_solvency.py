"""
Phase 23 Verification Test Suite:
Institutional Continuous Compliance, SOC2/ISO27001 Evidence Automation & Merkle-Tree Proof of Solvency.

Validates:
1. Continuous Trust Services Criteria (TSC) evaluation, framework mapping, and compliance scoring.
2. Cryptographic audit evidence package generation, canonical hashing, and HMAC signature sealing.
3. Cryptographic binary Merkle tree construction over asset commitments and root determination.
4. Zero-knowledge style leaf inclusion proofs and independent mathematical verification.
5. Detection and rejection of forged or altered Merkle proofs.
6. REST API routes under /api/v1/compliance/evidence/* and /api/v1/compliance/solvency/*.
"""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.security.tokens import create_access_token
from app.services.compliance_evidence_service import (
    compliance_evidence_service,
    ControlStatus,
    ControlCategory,
)
from app.security.proof_of_solvency import (
    proof_of_solvency_engine,
    MerkleTree,
    ProofNode,
    ProofDirection,
)


def test_compliance_controls_evaluation_and_scores():
    """Verify continuous Trust Services Criteria evaluation and control attributes."""
    controls = compliance_evidence_service.evaluate_controls()

    assert len(controls) >= 7
    control_ids = {c.control_id for c in controls}
    assert "CC6.1" in control_ids
    assert "CC6.7" in control_ids
    assert "A1.2" in control_ids
    assert "C1.1" in control_ids
    assert "P1.1" in control_ids

    for c in controls:
        assert c.status == ControlStatus.COMPLIANT
        assert len(c.frameworks) > 0
        assert len(c.evidence_summary) > 10
        assert c.last_evaluated_at is not None


def test_evidence_bundle_generation_and_cryptographic_verification():
    """Verify evidence bundle sealing, SHA-256 manifest hashing, and signature validation."""
    bundle = compliance_evidence_service.generate_evidence_bundle(auditor_id="auditor_ernst_young_01")

    assert bundle.bundle_id.startswith("evd_")
    assert bundle.auditor_id == "auditor_ernst_young_01"
    assert bundle.compliance_score_percent == 100.0
    assert bundle.total_controls == len(bundle.controls)
    assert bundle.passing_controls == bundle.total_controls
    assert len(bundle.manifest_hash) == 64
    assert len(bundle.digital_signature_hex) == 64

    # 1. Verification of pristine bundle
    assert compliance_evidence_service.verify_bundle_signature(bundle) is True

    # 2. Tampered hash must fail signature verification
    bundle.manifest_hash = "0000000000000000000000000000000000000000000000000000000000000000"
    assert compliance_evidence_service.verify_bundle_signature(bundle) is False


def test_merkle_tree_construction_and_root():
    """Verify Merkle tree construction, layer hashing, and root consistency."""
    leaves = [
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2222222222222222222222222222222222222222222222222222222222222222",
        "3333333333333333333333333333333333333333333333333333333333333333",
        "4444444444444444444444444444444444444444444444444444444444444444",
    ]
    tree = MerkleTree(leaves)

    assert len(tree.root) == 64
    assert len(tree.layers) == 3  # 4 leaves -> 2 parents -> 1 root

    # Empty leaves check
    with pytest.raises(ValueError, match="zero leaves"):
        MerkleTree([])


def test_solvency_leaf_inclusion_proof_and_verification():
    """Verify generation and independent validation of asset inclusion proofs."""
    solvency_root_data = proof_of_solvency_engine.get_merkle_root()
    root = solvency_root_data["merkle_root"]
    assert len(root) == 64

    # Generate proof for BTC vault asset
    proof = proof_of_solvency_engine.generate_proof_for_asset("ast_btc_cold_01")
    assert proof is not None
    assert proof.asset_id == "ast_btc_cold_01"
    assert proof.merkle_root == root
    assert len(proof.proof_path) > 0

    # Verify inclusion against root
    is_valid = proof_of_solvency_engine.verify_inclusion(
        merkle_root=root,
        leaf_hash=proof.leaf_hash,
        proof_path=proof.proof_path,
    )
    assert is_valid is True


def test_tampered_merkle_proof_fails():
    """Verify that altered leaves or tampered sibling paths fail inclusion check."""
    proof = proof_of_solvency_engine.generate_proof_for_asset("ast_eth_custody_02")
    assert proof is not None

    # Alter the leaf hash
    forged_leaf = "deadbeef" + proof.leaf_hash[8:]
    assert proof_of_solvency_engine.verify_inclusion(
        merkle_root=proof.merkle_root,
        leaf_hash=forged_leaf,
        proof_path=proof.proof_path,
    ) is False

    # Alter a sibling hash in path
    tampered_path = [
        ProofNode(sibling_hash="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", direction=node.direction)
        if idx == 0 else node
        for idx, node in enumerate(proof.proof_path)
    ]
    assert proof_of_solvency_engine.verify_inclusion(
        merkle_root=proof.merkle_root,
        leaf_hash=proof.leaf_hash,
        proof_path=tampered_path,
    ) is False


@pytest.mark.asyncio
async def test_continuous_compliance_rest_api_lifecycle():
    """Verify REST API lifecycle across /api/v1/compliance/evidence/* and /compliance/solvency/*."""
    token = create_access_token({"userId": "auditor_sec_pwc_01"})
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Get evaluated controls
        controls_resp = await client.get("/api/v1/compliance/evidence/controls", headers=headers)
        assert controls_resp.status_code == 200
        ctrl_data = controls_resp.json()["data"]
        assert ctrl_data["compliance_score_percent"] == 100.0
        assert ctrl_data["total_controls"] >= 7

        # 2. Generate signed evidence bundle
        bundle_resp = await client.post("/api/v1/compliance/evidence/bundle", headers=headers)
        assert bundle_resp.status_code == 200
        bundle_data = bundle_resp.json()["data"]
        bundle_id = bundle_data["bundle_id"]

        # 3. Verify bundle signature
        verify_bundle_resp = await client.get(
            f"/api/v1/compliance/evidence/bundle/{bundle_id}/verify",
            headers=headers,
        )
        assert verify_bundle_resp.status_code == 200
        assert verify_bundle_resp.json()["data"]["is_valid"] is True

        # 4. Solvency Merkle root
        root_resp = await client.get("/api/v1/compliance/solvency/root", headers=headers)
        assert root_resp.status_code == 200
        root = root_resp.json()["data"]["merkle_root"]
        assert len(root) == 64

        # 5. Generate solvency proof
        proof_resp = await client.post(
            "/api/v1/compliance/solvency/proof",
            headers=headers,
            json={"asset_id": "ast_btc_cold_01"},
        )
        assert proof_resp.status_code == 200
        proof_payload = proof_resp.json()["data"]
        leaf_hash = proof_payload["leaf_hash"]
        proof_path = proof_payload["proof_path"]

        # 6. Verify solvency proof endpoint
        verify_solvency_resp = await client.post(
            "/api/v1/compliance/solvency/verify",
            headers=headers,
            json={
                "merkle_root": root,
                "leaf_hash": leaf_hash,
                "proof_path": proof_path,
            },
        )
        assert verify_solvency_resp.status_code == 200
        assert verify_solvency_resp.json()["data"]["is_valid"] is True
