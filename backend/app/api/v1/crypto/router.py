"""
Post-Quantum Cryptography & Hybrid Enclave API Router — Phase 20.
NIST FIPS 203 (ML-KEM-768) and FIPS 204 (ML-DSA-65) operations.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.security.post_quantum_crypto import (
    post_quantum_crypto_service,
    HybridPqcEnvelope,
    PqcSignatureEnvelope,
)

router = APIRouter(prefix="/crypto", tags=["v1 - Post-Quantum Cryptography"])


class EncapsulateRequest(BaseModel):
    plaintext: str = Field(..., description="Secret content to protect with hybrid PQC encryption")
    public_keys: Dict[str, str] = Field(..., description="Target classical and ML-KEM public keys")
    key_id: Optional[str] = "pqc_key_primary"


class DecapsulateRequest(BaseModel):
    envelope: HybridPqcEnvelope
    private_keys: Dict[str, str]
    public_keys: Dict[str, str]


class SignDeedRequest(BaseModel):
    deed_text: str = Field(..., description="Legal inheritance deed or notarized decree content")
    key_id: Optional[str] = "pqc_notary_key_01"


class VerifyDeedRequest(BaseModel):
    deed_text: str
    key_id: str
    signature_envelope: PqcSignatureEnvelope


@router.get("/pqc/telemetry")
async def get_pqc_telemetry():
    """
    Retrieve platform quantum readiness telemetry, standards compliance,
    lattice parameters, and algorithm agility status.
    """
    telemetry = post_quantum_crypto_service.get_pqc_telemetry()
    return success_response(data=telemetry, meta={"message": "PQC telemetry retrieved."})


@router.post("/pqc/keypair")
async def generate_pqc_keypair(request: Request):
    """
    Generate dual-layer hybrid public/private keypair: Curve25519 + ML-KEM-768.
    """
    _ = require_authenticated_user(request)
    keypair = post_quantum_crypto_service.generate_hybrid_keypair()
    return success_response(data=keypair, meta={"message": "Hybrid PQC keypair generated."})


@router.post("/pqc/encapsulate")
async def encapsulate_secret(
    request: Request,
    body: EncapsulateRequest,
):
    """
    Encapsulate secret payload into hybrid post-quantum envelope (X25519 + ML-KEM-768 + AES-256-GCM).
    """
    _ = require_authenticated_user(request)
    envelope = post_quantum_crypto_service.encapsulate_hybrid(
        public_keys=body.public_keys,
        plaintext=body.plaintext.encode("utf-8"),
        key_id=body.key_id or "pqc_key_primary",
    )
    return success_response(data=envelope.model_dump(), meta={"message": "Hybrid PQC encapsulation successful."})


@router.post("/pqc/decapsulate")
async def decapsulate_secret(
    request: Request,
    body: DecapsulateRequest,
):
    """
    Decapsulate hybrid PQC envelope and decrypt protected secret payload.
    """
    _ = require_authenticated_user(request)
    try:
        decrypted_bytes = post_quantum_crypto_service.decapsulate_hybrid(
            private_keys=body.private_keys,
            public_keys=body.public_keys,
            envelope=body.envelope,
        )
        return success_response(
            data={"plaintext": decrypted_bytes.decode("utf-8")},
            meta={"message": "Hybrid PQC decapsulation successful."}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Decapsulation failed. Corrupted ciphertext or invalid keys: {str(e)}"
        )


@router.post("/pqc/sign-deed")
async def sign_inheritance_deed(
    request: Request,
    body: SignDeedRequest,
):
    """
    Apply post-quantum ML-DSA-65 (Dilithium) digital signature to inheritance deed or notary decree.
    """
    _ = require_authenticated_user(request)
    sig = post_quantum_crypto_service.sign_post_quantum(
        private_key_id=body.key_id or "pqc_notary_key_01",
        message=body.deed_text.encode("utf-8"),
    )
    return success_response(data=sig.model_dump(), meta={"message": "Post-quantum digital signature applied."})


@router.post("/pqc/verify-deed")
async def verify_inheritance_deed(body: VerifyDeedRequest):
    """
    Verify authenticity of post-quantum ML-DSA digital signature on inheritance deed.
    """
    is_valid = post_quantum_crypto_service.verify_post_quantum(
        public_key_id=body.key_id,
        message=body.deed_text.encode("utf-8"),
        signature_envelope=body.signature_envelope,
    )
    return success_response(
        data={"is_valid": is_valid, "algorithm": body.signature_envelope.algorithm},
        meta={"message": "Signature verification completed."}
    )
