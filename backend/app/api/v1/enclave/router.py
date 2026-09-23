"""
Hardware Confidential Compute Enclave & Zero-Knowledge Proof API Router — Phase 24.
Exposes hardware remote attestation, isolated in-enclave execution, and ZKP beneficiary verification.
"""

from typing import Optional
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.security.confidential_enclave_service import (
    confidential_enclave_service,
    AttestationReport,
)
from app.security.zk_proof_service import (
    zk_proof_service,
    ZkAgeProof,
)

router = APIRouter(prefix="/enclave", tags=["v1 - Confidential Compute & ZKP"])


class EnclaveExecuteBody(BaseModel):
    operation: str = Field(..., description="Operation to perform inside isolated enclave")
    sensitive_payload: str = Field(..., description="Encrypted or raw payload shielded from host OS")


class ZkProveMajorityBody(BaseModel):
    birth_year: int = Field(..., description="Birth year known only to claimant")
    threshold_age: int = Field(default=18, ge=18, le=100)


@router.get("/status")
async def get_enclave_status(request: Request):
    """
    Retrieve hardware enclave telemetry, memory encryption mode, and PCR registers.
    """
    _ = require_authenticated_user(request)
    status_data = confidential_enclave_service.get_status()
    return success_response(data=status_data)


@router.get("/attestation")
async def get_attestation_report(request: Request, nonce: Optional[str] = None):
    """
    Generate hardware cryptographic remote attestation report signed by root of trust.
    """
    _ = require_authenticated_user(request)
    report = confidential_enclave_service.generate_attestation_report(user_nonce=nonce)
    return success_response(data=report.model_dump())


@router.post("/execute")
async def execute_in_enclave(body: EnclaveExecuteBody, request: Request):
    """
    Execute sensitive computation inside isolated hardware memory enclave.
    """
    _ = require_authenticated_user(request)
    result = confidential_enclave_service.execute_in_enclave(
        operation=body.operation,
        sensitive_payload=body.sensitive_payload,
    )
    return success_response(data=result.model_dump())


@router.post("/zk/prove-majority")
async def prove_age_of_majority(body: ZkProveMajorityBody, request: Request):
    """
    Generate a zero-knowledge proof that the claimant meets minimum age requirements
    without revealing their birth year or personal identifiers.
    """
    user_id = require_authenticated_user(request)
    try:
        proof = zk_proof_service.generate_age_of_majority_proof(
            claimant_id=user_id,
            birth_year=body.birth_year,
            threshold_age=body.threshold_age,
        )
        return success_response(
            data=proof.model_dump(),
            meta={"message": f"Zero-Knowledge Proof generated: Claimant meets age >= {body.threshold_age}."}
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/zk/verify-majority")
async def verify_age_of_majority(proof: ZkAgeProof, request: Request):
    """
    Independently verify a claimant's zero-knowledge proof of majority.
    """
    _ = require_authenticated_user(request)
    is_valid = zk_proof_service.verify_age_of_majority_proof(proof)
    return success_response(
        data={
            "proof_id": proof.proof_id,
            "claimant_id": proof.claimant_id,
            "threshold_age": proof.threshold_age,
            "is_valid": is_valid,
        },
        meta={"message": "Zero-knowledge verification succeeded." if is_valid else "Zero-knowledge verification failed."}
    )
