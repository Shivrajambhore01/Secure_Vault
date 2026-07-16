"""Nominee-facing Death Verification Submission API routes.

These endpoints allow nominees to submit death verification requests
and check the status of their submissions.

Endpoints:
  POST /api/verification/submit          — Submit a verification request with file uploads
  GET  /api/verification/status/{token}  — Check submission status

Authentication: Nominee accessToken (the same token used for asset retrieval).
"""

import os
import random
import string
import time
from datetime import datetime, timezone

from bson.binary import Binary
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from typing import Optional

from app.core.database import db
from app.lib.encryption import encrypt_bytes

router = APIRouter()

# Collections
verifications_col = db["death_verifications"]
nominees_col = db["nominees"]
users_col = db["users"]

# File upload constraints
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _generate_id() -> str:
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=13)) + hex(int(time.time()))[2:]


def _validate_file(file: UploadFile, label: str) -> None:
    """Validate file extension and size."""
    if not file or not file.filename:
        return

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"{label}: Only PDF, PNG, and JPEG files are accepted. Got '{ext}'.",
        )


async def _read_and_validate_file(file: UploadFile, label: str) -> Optional[dict]:
    """Read, validate, and encrypt an uploaded file. Returns file metadata dict."""
    if not file or not file.filename:
        return None

    _validate_file(file, label)

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"{label}: File exceeds the 10 MB size limit ({len(content) / (1024*1024):.1f} MB).",
        )

    # Encrypt file bytes before storage
    encrypted = encrypt_bytes(content)

    return {
        "data": Binary(encrypted),
        "fileName": file.filename,
        "mimeType": file.content_type or "application/octet-stream",
        "fileSize": len(content),
    }


async def _authenticate_nominee(token: str) -> dict:
    """Validate the nominee access token and return the nominee document."""
    if not token:
        raise HTTPException(status_code=401, detail="Access token is required.")

    nominee = await nominees_col.find_one({"accessToken": token})
    if not nominee:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.")

    # Check token expiry
    expiry = nominee.get("tokenExpiry")
    if expiry:
        if isinstance(expiry, str):
            from datetime import timezone as tz
            expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        else:
            expiry_dt = expiry
        if datetime.now(timezone.utc) > expiry_dt:
            raise HTTPException(status_code=401, detail="Access token has expired.")

    return nominee


# ------------------------------------------------------------------
# POST /submit — Submit a death verification request
# ------------------------------------------------------------------

@router.post("/submit")
async def submit_verification(
    request: Request,
    token: str = Form(..., description="Nominee access token"),
    remarks: str = Form("", description="Optional remarks from nominee"),
    certificate: UploadFile = File(..., description="Death certificate (PDF/PNG/JPEG, max 10MB)"),
    governmentId: Optional[UploadFile] = File(None, description="Government-issued ID (optional)"),
    relationshipProof: Optional[UploadFile] = File(None, description="Relationship proof document (optional)"),
):
    """Submit a death verification request with supporting documents.

    Requires a valid nominee accessToken. Each nominee can only have one active
    verification request (PENDING, UNDER_REVIEW, or MORE_DOCUMENTS_REQUIRED).
    """
    # Authenticate nominee
    nominee = await _authenticate_nominee(token)
    nominee_id = nominee["id"]
    user_id = nominee["userId"]

    # Check for existing active request
    existing = await verifications_col.find_one({
        "nomineeId": nominee_id,
        "status": {"$in": ["PENDING", "UNDER_REVIEW"]},
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have an active verification request. Please wait for the review to complete.",
        )

    # Process files
    cert_file = await _read_and_validate_file(certificate, "Death Certificate")
    if not cert_file:
        raise HTTPException(status_code=400, detail="Death certificate is required.")

    gov_id_file = await _read_and_validate_file(governmentId, "Government ID") if governmentId else None
    rel_proof_file = await _read_and_validate_file(relationshipProof, "Relationship Proof") if relationshipProof else None

    now = datetime.now(timezone.utc).isoformat()
    verification_id = _generate_id()

    doc = {
        "id": verification_id,
        "userId": user_id,
        "nomineeId": nominee_id,
        "verificationToken": token,
        "certificateFile": cert_file,
        "governmentIdFile": gov_id_file,
        "relationshipProofFile": rel_proof_file,
        "remarks": remarks.strip(),
        "aiVerificationScore": None,  # Placeholder for future AI verification
        "status": "PENDING",
        "priority": "LOW",
        "reviewedBy": None,
        "reviewedAt": None,
        "reviewHistory": [],
        "createdAt": now,
        "updatedAt": now,
    }

    await verifications_col.insert_one(doc)
    print(f"[VERIFICATION] New request submitted: {verification_id} by nominee {nominee.get('email')} for user {user_id}")

    return {
        "message": "Verification request submitted successfully. You will be notified once reviewed.",
        "verificationId": verification_id,
        "status": "PENDING",
    }


# ------------------------------------------------------------------
# GET /status/{token} — Check submission status
# ------------------------------------------------------------------

@router.get("/status/{token}")
async def check_verification_status(token: str):
    """Check the status of a verification request using the nominee access token."""
    nominee = await _authenticate_nominee(token)

    # Find the most recent verification request for this nominee
    v = await verifications_col.find_one(
        {"nomineeId": nominee["id"]},
        {
            "certificateFile.data": 0,
            "governmentIdFile.data": 0,
            "relationshipProofFile.data": 0,
        },
    )

    if not v:
        return {
            "hasRequest": False,
            "message": "No verification request found. You can submit one.",
        }

    v["_id"] = str(v["_id"])

    # Strip file binary data, keep metadata
    for key in ("certificateFile", "governmentIdFile", "relationshipProofFile"):
        if v.get(key) and isinstance(v[key], dict):
            v[key] = {k: val for k, val in v[key].items() if k != "data"}

    return {
        "hasRequest": True,
        "verification": v,
    }
