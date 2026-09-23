"""
Continuous Compliance & Proof-of-Solvency REST API Router — Phase 23.
Exposes automated Trust Services Criteria controls, evidence bundle exports,
and cryptographic Merkle tree solvency verification.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.compliance_evidence_service import (
    compliance_evidence_service,
    EvidenceBundle,
)
from app.security.proof_of_solvency import (
    proof_of_solvency_engine,
    ProofNode,
)

evidence_router = APIRouter(tags=["v1 - Continuous Compliance & Solvency"])


class GenerateBundleRequest(BaseModel):
    pass


class GenerateProofRequest(BaseModel):
    asset_id: str = Field(..., description="ID of the asset to generate Merkle inclusion proof for")


class VerifyInclusionRequest(BaseModel):
    merkle_root: str
    leaf_hash: str
    proof_path: List[ProofNode]


@evidence_router.get("/compliance/evidence/controls")
async def get_compliance_controls(request: Request):
    """
    Evaluate and return real-time Trust Services Criteria controls (SOC2 / ISO 27001 / HIPAA).
    """
    _ = require_authenticated_user(request)
    controls = compliance_evidence_service.evaluate_controls()
    passing = sum(1 for c in controls if c.status == "COMPLIANT")
    total = len(controls)
    score = round((passing / total) * 100.0, 2) if total > 0 else 0.0

    return success_response(
        data={
            "compliance_score_percent": score,
            "total_controls": total,
            "passing_controls": passing,
            "controls": [c.model_dump() for c in controls],
        },
        meta={"frameworks": ["SOC2 Type II", "ISO/IEC 27001:2022", "HIPAA Security Rule", "GDPR Art 32"]}
    )


@evidence_router.post("/compliance/evidence/bundle")
async def generate_evidence_bundle(request: Request):
    """
    Generate, hash, and cryptographically sign a comprehensive audit evidence bundle.
    """
    auditor_id = require_authenticated_user(request)
    bundle = compliance_evidence_service.generate_evidence_bundle(auditor_id=auditor_id)
    return success_response(
        data=bundle.model_dump(),
        meta={"message": f"Evidence bundle {bundle.bundle_id} sealed with digital signature."}
    )


@evidence_router.get("/compliance/evidence/bundle/{bundle_id}/verify")
async def verify_evidence_bundle(bundle_id: str, request: Request):
    """
    Verify the cryptographic digital signature of an existing evidence bundle.
    """
    _ = require_authenticated_user(request)
    bundle = compliance_evidence_service.get_bundle(bundle_id)
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Evidence bundle {bundle_id} not found.")

    is_valid = compliance_evidence_service.verify_bundle_signature(bundle)
    return success_response(
        data={"bundle_id": bundle_id, "is_valid": is_valid, "manifest_hash": bundle.manifest_hash}
    )


@evidence_router.get("/compliance/solvency/root")
async def get_solvency_merkle_root(request: Request):
    """
    Retrieve current cryptographic Merkle root summarizing institutional solvency commitments.
    """
    _ = require_authenticated_user(request)
    solvency_data = proof_of_solvency_engine.get_merkle_root()
    return success_response(data=solvency_data)


@evidence_router.post("/compliance/solvency/proof")
async def generate_solvency_proof(body: GenerateProofRequest, request: Request):
    """
    Generate cryptographic Merkle inclusion proof for a vaulted asset.
    """
    _ = require_authenticated_user(request)
    proof = proof_of_solvency_engine.generate_proof_for_asset(asset_id=body.asset_id)
    if not proof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset commitment {body.asset_id} not found in solvency ledger."
        )
    return success_response(data=proof.model_dump())


@evidence_router.post("/compliance/solvency/verify")
async def verify_solvency_proof(body: VerifyInclusionRequest, request: Request):
    """
    Verify cryptographic Merkle leaf inclusion proof against the root.
    """
    _ = require_authenticated_user(request)
    is_valid = proof_of_solvency_engine.verify_inclusion(
        merkle_root=body.merkle_root,
        leaf_hash=body.leaf_hash,
        proof_path=body.proof_path,
    )
    return success_response(
        data={
            "merkle_root": body.merkle_root,
            "leaf_hash": body.leaf_hash,
            "is_valid": is_valid,
        },
        meta={"message": "Merkle leaf inclusion verified." if is_valid else "Merkle leaf inclusion failed."}
    )
