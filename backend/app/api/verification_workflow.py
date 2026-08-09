"""Death Verification Workflow API — Nominee-facing endpoints.

This module implements the complete inheritance verification lifecycle:

  1. Death Claim Submission (POST /claim)
  2. 30-Day Cooling Period (owner gets a chance to halt the claim)
  3. Owner Halt (POST /halt — owner cancels the claim)
  4. Email OTP Verification  (POST /email/send-otp, POST /email/verify)
  5. Mobile OTP Verification (POST /mobile/send-otp, POST /mobile/verify)
  6. Government ID Upload + Simulated OCR (POST /upload-id)
  7. Selfie / Liveness Upload (POST /upload-selfie)
  8. Death Evidence Upload — Preferred & Alternative (POST /upload-death-document)
  9. Finalise submission (POST /complete)
  10. Status polling (GET /status)
  11. Additional document upload for MORE_DOCUMENTS_REQUIRED (POST /additional-document)

Authentication model: The nominee's `accessToken` (the hex token embedded in
the secure access link generated when the owner adds a nominee) is used as
proof-of-identity throughout the entire workflow, NOT a user session cookie.

Collections used:
  verification_requests        — master verification document
  verification_documents       — encrypted binary files
  verification_logs            — full audit trail
  verification_sessions        — short-lived approved sessions
  verification_status_history  — every status transition
  verification_otps            — active OTP records (email + mobile)
"""

import os
import random
import secrets
import string
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from bson.binary import Binary
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.database import db
from app.lib.encryption import encrypt_bytes

router = APIRouter()
settings = get_settings()

# ─────────────────────────────────────────────────────────────
# Collections
# ─────────────────────────────────────────────────────────────
verification_requests_col = db["verification_requests"]
verification_documents_col = db["verification_documents"]
verification_logs_col = db["verification_logs"]
verification_sessions_col = db["verification_sessions"]
verification_status_history_col = db["verification_status_history"]
verification_otps_col = db["verification_otps"]
nominees_col = db["nominees"]
users_col = db["users"]

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Document types: Preferred = highest evidential weight, Alternative = secondary
PREFERRED_DOC_TYPES = {"DEATH_CERTIFICATE", "DEATH_REGISTRATION"}
ALTERNATIVE_DOC_TYPES = {
    "HOSPITAL_RECORD",
    "CREMATION_CERTIFICATE",
    "FUNERAL_CERTIFICATE",
    "OBITUARY",
    "PROBATE_DOC",
    "EXECUTOR_LETTER",
    "COURT_ORDER",
    "AFFIDAVIT",
    "NEWSPAPER_NOTICE",
    "SUPPORTING_EVIDENCE",
}
ALL_DEATH_DOC_TYPES = PREFERRED_DOC_TYPES | ALTERNATIVE_DOC_TYPES

# Workflow statuses — in order
STATUS_CLAIMED = "CLAIMED"             # Claim submitted, owner notified
STATUS_COOLING = "COOLING_PERIOD"      # 30-day wait active
STATUS_HALTED = "HALTED"              # Owner cancelled the claim
STATUS_NOTIFIED = "NOMINEE_NOTIFIED"  # 30 days elapsed, nominee link sent
STATUS_PENDING = "PENDING_REVIEW"     # Nominee completed steps, awaiting admin
STATUS_APPROVED = "APPROVED"
STATUS_REJECTED = "REJECTED"
STATUS_MORE_DOCS = "MORE_DOCUMENTS_REQUIRED"

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _generate_id() -> str:
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=13)) + hex(int(time.time()))[2:]


async def _authenticate_nominee(token: str) -> dict:
    """Validate the nominee access token and return the nominee document."""
    if not token:
        raise HTTPException(status_code=401, detail="Access token is required.")
    nominee = await nominees_col.find_one({"accessToken": token})
    if not nominee:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.")
    expiry = nominee.get("tokenExpiry")
    if expiry:
        expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00")) if isinstance(expiry, str) else expiry
        if datetime.now(timezone.utc) > expiry_dt:
            raise HTTPException(status_code=401, detail="Access token has expired.")
    return nominee


async def _get_active_request(nominee_id: str) -> Optional[dict]:
    """Return the active verification request for this nominee, if any."""
    return await verification_requests_col.find_one(
        {"nomineeId": nominee_id},
        sort=[("createdAt", -1)],
    )


async def _write_log(
    request_id: str,
    action: str,
    ip_address: str = "unknown",
    device_fingerprint: dict = None,
    metadata: dict = None,
):
    await verification_logs_col.insert_one({
        "id": _generate_id(),
        "requestId": request_id,
        "action": action,
        "ipAddress": ip_address,
        "deviceFingerprint": device_fingerprint or {},
        "metadata": metadata or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def _write_status_history(
    request_id: str,
    old_status: str,
    new_status: str,
    remarks: str = "",
    changed_by: str = "system",
):
    await verification_status_history_col.insert_one({
        "id": _generate_id(),
        "requestId": request_id,
        "oldStatus": old_status,
        "newStatus": new_status,
        "remarks": remarks,
        "changedBy": changed_by,
        "changedAt": datetime.now(timezone.utc).isoformat(),
    })


async def _send_email(to: str, subject: str, html: str):
    if settings.EMAIL_USER and settings.EMAIL_PASS:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart("alternative")
        msg["From"] = settings.EMAIL_USER
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))

        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.EMAIL_USER,
            password=settings.EMAIL_PASS,
        )
    else:
        print(f"[DEV EMAIL] To: {to} | Subject: {subject}")


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _read_and_encrypt_file(file: UploadFile, label: str) -> dict:
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail=f"{label}: No file provided.")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"{label}: Only PDF, PNG, JPEG files are accepted. Got '{ext}'.",
        )
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"{label}: File exceeds 10 MB limit ({len(content) / (1024*1024):.1f} MB).",
        )
    encrypted = encrypt_bytes(content)
    return {
        "data": Binary(encrypted),
        "fileName": file.filename,
        "mimeType": file.content_type or "application/octet-stream",
        "fileSize": len(content),
    }


def _compute_risk_score(nominee: dict, ocr_data: dict, existing_request: dict) -> int:
    """Simulated risk scoring (0-100, higher = riskier).
    
    In production, this would be replaced with an AI/ML model.
    Checks name match, multiple attempts, upload patterns, etc.
    """
    score = 0
    # Name match check (OCR vs nominee name in system)
    nominee_name = (nominee.get("name") or "").lower().strip()
    ocr_name = (ocr_data.get("fullName") or "").lower().strip()
    if nominee_name and ocr_name:
        # Simple word-overlap heuristic
        nominee_words = set(nominee_name.split())
        ocr_words = set(ocr_name.split())
        overlap = nominee_words & ocr_words
        if len(overlap) == 0:
            score += 40  # Names don't match at all — high risk
        elif len(overlap) < len(nominee_words) / 2:
            score += 20  # Partial match — medium risk
    else:
        score += 15  # Missing one of the names
    return min(score, 100)


def _simulate_ocr(doc_type: str) -> dict:
    """Simulate OCR extraction for development. Returns plausible extracted data."""
    return {
        "fullName": "Nominee Full Name (OCR Simulated)",
        "dateOfBirth": "1990-01-01",
        "documentNumber": "XXXX-XXXX-XXXX",
        "documentType": doc_type,
        "confidence": 0.94,
        "verified": True,
        "simulatedAt": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────────

class ClaimRequest(BaseModel):
    accessToken: str
    claimedByName: str
    claimedByRelation: str
    claimedByEmail: str
    claimedByPhone: str
    remarks: str = ""


class HaltClaimRequest(BaseModel):
    ownerToken: str  # The owner's regular auth token — validated against users collection
    requestId: str
    reason: str = ""


class OTPRequest(BaseModel):
    accessToken: str


class OTPVerifyRequest(BaseModel):
    accessToken: str
    otp: str


# ─────────────────────────────────────────────────────────────
# POST /claim — Death Claim Submission
# ─────────────────────────────────────────────────────────────

@router.post("/claim")
async def submit_death_claim(body: ClaimRequest, request: Request):
    """Step 1: Nominee (or informer) submits a death claim.
    
    This does NOT immediately grant access. Instead it:
    - Creates a verification_request record with status CLAIMED
    - Notifies the account owner (email / SMS) with a halt link
    - Starts the 30-day cooling period (or instant if COOLING_PERIOD_DAYS=0)
    - Transitions to NOMINEE_NOTIFIED when cooling period elapses
    """
    nominee = await _authenticate_nominee(body.accessToken)
    nominee_id = nominee["id"]
    user_id = nominee["userId"]

    # Block if there's already an active (non-terminal) request
    existing = await verification_requests_col.find_one({
        "nomineeId": nominee_id,
        "status": {"$nin": [STATUS_REJECTED, STATUS_HALTED]},
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail="An active verification request already exists for this nominee.",
        )

    from bson import ObjectId
    owner = None
    if ObjectId.is_valid(user_id):
        owner = await users_col.find_one({"_id": ObjectId(user_id)})
    if not owner:
        owner = await users_col.find_one({"id": user_id})
    if not owner:
        raise HTTPException(status_code=404, detail="Associated account owner not found.")

    now = datetime.now(timezone.utc)
    cooling_days = settings.COOLING_PERIOD_DAYS
    cooling_end = now + timedelta(days=cooling_days) if cooling_days > 0 else now  # 0 = instant for dev

    request_id = _generate_id()
    halt_token = secrets.token_urlsafe(32)  # Token the owner uses to halt the claim

    doc = {
        "id": request_id,
        "nomineeId": nominee_id,
        "userId": user_id,
        "accessToken": body.accessToken,
        "claimedByName": body.claimedByName.strip(),
        "claimedByRelation": body.claimedByRelation.strip(),
        "claimedByEmail": body.claimedByEmail.strip().lower(),
        "claimedByPhone": body.claimedByPhone.strip(),
        "remarks": body.remarks.strip(),
        "haltToken": halt_token,
        "status": STATUS_COOLING if cooling_days > 0 else STATUS_NOTIFIED,
        # Verification steps
        "emailVerified": False,
        "mobileVerified": False,
        "govtIdVerified": False,
        "faceVerified": False,
        "ocrData": None,
        "riskScore": None,
        # Cooling period
        "coolingPeriodStart": now.isoformat(),
        "coolingPeriodEnd": cooling_end.isoformat(),
        # Review
        "reviewedBy": None,
        "reviewedAt": None,
        "reviewHistory": [],
        "internalComments": [],
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
    }

    await verification_requests_col.insert_one(doc)
    await _write_log(request_id, "CLAIM_SUBMITTED", ip_address=_get_ip(request),
                     device_fingerprint={"userAgent": request.headers.get("user-agent", "")})
    await _write_status_history(request_id, "NONE", doc["status"], remarks="Initial claim submitted.")

    # Notify the account owner
    owner_email = owner.get("email", "")
    owner_name = owner.get("fullName", owner.get("name", "Account Owner"))
    halt_url = f"{settings.FRONTEND_URL}/verification/halt/{halt_token}"
    nominee_name = nominee.get("name", body.claimedByName)

    owner_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;border-radius:16px;overflow:hidden;border:1px solid #ef4444;">
        <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:30px 40px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:24px;">SecureVault — Urgent Security Alert</h1>
        </div>
        <div style="padding:36px 40px;color:#e2e8f0;">
            <h2 style="color:#ef4444;">A Death Claim Has Been Submitted Against Your Account</h2>
            <p>Dear <strong>{owner_name}</strong>,</p>
            <p>A death claim was submitted by <strong>{nominee_name}</strong> ({body.claimedByRelation}) for your SecureVault account.</p>
            <p>If you are alive and wish to cancel this claim immediately, click the button below:</p>
            <div style="text-align:center;margin:30px 0;">
                <a href="{halt_url}" style="background:#dc2626;color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
                    Cancel This Claim — I Am Alive
                </a>
            </div>
            <p style="color:#94a3b8;font-size:13px;">If you do not respond within <strong>{cooling_days if cooling_days > 0 else 'a few moments'} day{'s' if cooling_days != 1 else ''}</strong>, the verification process will proceed to your nominee.</p>
            <p style="color:#64748b;font-size:12px;margin-top:24px;">If this was expected, you may safely ignore this email.</p>
        </div>
    </div>
    """

    try:
        if owner_email:
            await _send_email(owner_email, "SecureVault: Death Claim Submitted — Action Required", owner_html)
    except Exception as e:
        print(f"[VERIFICATION] Failed to email owner: {e}")

    await _write_log(request_id, "OWNER_NOTIFIED", ip_address=_get_ip(request))

    print(f"[VERIFICATION] Claim {request_id} submitted. Cooling ends: {cooling_end.isoformat()}")

    return {
        "message": "Death claim submitted. The account owner has been notified.",
        "requestId": request_id,
        "status": doc["status"],
        "coolingPeriodEnd": cooling_end.isoformat(),
    }


# ─────────────────────────────────────────────────────────────
# POST /halt — Owner Cancels the Claim
# ─────────────────────────────────────────────────────────────

@router.post("/halt/{halt_token}")
async def halt_verification(halt_token: str, request: Request):
    """Owner uses the halt token (from their notification email) to cancel the claim."""
    ver_request = await verification_requests_col.find_one({"haltToken": halt_token})
    if not ver_request:
        raise HTTPException(status_code=404, detail="Invalid or expired halt token.")

    if ver_request["status"] in (STATUS_APPROVED, STATUS_HALTED, STATUS_REJECTED):
        raise HTTPException(status_code=409, detail="This claim has already been finalised.")

    old_status = ver_request["status"]
    now = datetime.now(timezone.utc).isoformat()
    await verification_requests_col.update_one(
        {"id": ver_request["id"]},
        {"$set": {"status": STATUS_HALTED, "updatedAt": now}},
    )
    await _write_log(ver_request["id"], "CLAIM_HALTED", ip_address=_get_ip(request))
    await _write_status_history(ver_request["id"], old_status, STATUS_HALTED,
                                 remarks="Owner halted the claim via email link.", changed_by="owner")

    print(f"[VERIFICATION] Claim {ver_request['id']} HALTED by owner.")
    return {"message": "Claim has been cancelled. No further action will be taken.", "status": STATUS_HALTED}


# ─────────────────────────────────────────────────────────────
# POST /email/send-otp
# ─────────────────────────────────────────────────────────────

@router.post("/email/send-otp")
async def send_email_otp(body: OTPRequest, request: Request):
    """Generate and email a 6-digit OTP to the nominee's registered email."""
    nominee = await _authenticate_nominee(body.accessToken)
    ver_request = await _get_active_request(nominee["id"])

    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request. Please submit a claim first.")
    if ver_request["status"] == STATUS_HALTED:
        raise HTTPException(status_code=403, detail="This claim has been cancelled.")
    if ver_request["emailVerified"]:
        return {"message": "Email already verified.", "alreadyVerified": True}

    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.VERIFICATION_OTP_EXPIRY_MINUTES)
    request_id = ver_request["id"]

    await verification_otps_col.update_one(
        {"requestId": request_id, "type": "email"},
        {"$set": {
            "otp": otp,
            "expiresAt": expires_at,
            "attempts": 0,
        }},
        upsert=True,
    )

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;border-radius:16px;overflow:hidden;border:1px solid #3b82f6;">
        <div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:30px 40px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:24px;">SecureVault Verification</h1>
        </div>
        <div style="padding:36px 40px;color:#e2e8f0;">
            <h2 style="color:#3b82f6;">Email Verification Code</h2>
            <p>Hello {nominee.get('name', 'Nominee')},</p>
            <p>Your email verification code for the SecureVault inheritance access is:</p>
            <div style="text-align:center;background:#1e293b;border-radius:12px;padding:24px;margin:24px 0;">
                <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#3b82f6;">{otp}</span>
            </div>
            <p style="color:#94a3b8;font-size:13px;">This code expires in {settings.VERIFICATION_OTP_EXPIRY_MINUTES} minutes.</p>
        </div>
    </div>
    """

    print(f"[VERIFICATION OTP] Email OTP for nominee {nominee.get('email')}: {otp}")
    try:
        await _send_email(nominee["email"], "SecureVault: Email Verification Code", html)
    except Exception as e:
        print(f"[VERIFICATION OTP] Email send failed: {e}")

    await _write_log(request_id, "EMAIL_OTP_SENT", ip_address=_get_ip(request))
    return {"message": "OTP sent to your registered email address."}


# ─────────────────────────────────────────────────────────────
# POST /email/verify
# ─────────────────────────────────────────────────────────────

@router.post("/email/verify")
async def verify_email_otp(body: OTPVerifyRequest, request: Request):
    """Verify the email OTP. Enforces max attempt limits."""
    nominee = await _authenticate_nominee(body.accessToken)
    ver_request = await _get_active_request(nominee["id"])
    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request.")

    request_id = ver_request["id"]
    otp_record = await verification_otps_col.find_one({"requestId": request_id, "type": "email"})

    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new code.")

    attempts = otp_record.get("attempts", 0)
    if attempts >= settings.VERIFICATION_OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Maximum OTP attempts exceeded. Please request a new code.")

    await verification_otps_col.update_one({"_id": otp_record["_id"]}, {"$inc": {"attempts": 1}})

    expires = otp_record.get("expiresAt")
    if expires:
        expires_dt = expires if hasattr(expires, "tzinfo") else datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
        if not hasattr(expires_dt, "tzinfo") or expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_dt:
            raise HTTPException(status_code=400, detail="OTP has expired. Please request a new code.")

    if otp_record["otp"] != body.otp.strip():
        remaining = settings.VERIFICATION_OTP_MAX_ATTEMPTS - (attempts + 1)
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {remaining} attempts remaining.")

    # Mark email verified
    await verification_requests_col.update_one(
        {"id": request_id},
        {"$set": {"emailVerified": True, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    await verification_otps_col.delete_one({"_id": otp_record["_id"]})
    await _write_log(request_id, "EMAIL_VERIFIED", ip_address=_get_ip(request))
    return {"message": "Email verified successfully.", "emailVerified": True}


# ─────────────────────────────────────────────────────────────
# POST /mobile/send-otp
# ─────────────────────────────────────────────────────────────

@router.post("/mobile/send-otp")
async def send_mobile_otp(body: OTPRequest, request: Request):
    """Generate and log (+ optionally SMS) a 6-digit OTP for mobile verification."""
    nominee = await _authenticate_nominee(body.accessToken)
    ver_request = await _get_active_request(nominee["id"])
    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request.")
    if not ver_request.get("emailVerified"):
        raise HTTPException(status_code=400, detail="Email must be verified before mobile verification.")
    if ver_request.get("mobileVerified"):
        return {"message": "Mobile already verified.", "alreadyVerified": True}

    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.VERIFICATION_OTP_EXPIRY_MINUTES)
    request_id = ver_request["id"]

    await verification_otps_col.update_one(
        {"requestId": request_id, "type": "mobile"},
        {"$set": {"otp": otp, "expiresAt": expires_at, "attempts": 0}},
        upsert=True,
    )

    nominee_phone = nominee.get("phone", ver_request.get("claimedByPhone", ""))
    print(f"[VERIFICATION OTP] Mobile OTP for {nominee_phone}: {otp}")

    # Attempt Twilio SMS if credentials set
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and nominee_phone:
        try:
            from twilio.rest import Client as TwilioClient
            tc = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            tc.messages.create(
                body=f"Your SecureVault verification code is: {otp}. Valid for {settings.VERIFICATION_OTP_EXPIRY_MINUTES} minutes.",
                from_=settings.TWILIO_PHONE_NUMBER,
                to=nominee_phone,
            )
        except Exception as e:
            print(f"[VERIFICATION OTP] SMS failed: {e}")

    await _write_log(request_id, "MOBILE_OTP_SENT", ip_address=_get_ip(request))
    return {"message": "OTP sent to your registered mobile number."}


# ─────────────────────────────────────────────────────────────
# POST /mobile/verify
# ─────────────────────────────────────────────────────────────

@router.post("/mobile/verify")
async def verify_mobile_otp(body: OTPVerifyRequest, request: Request):
    """Verify the mobile OTP."""
    nominee = await _authenticate_nominee(body.accessToken)
    ver_request = await _get_active_request(nominee["id"])
    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request.")

    request_id = ver_request["id"]
    otp_record = await verification_otps_col.find_one({"requestId": request_id, "type": "mobile"})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new code.")

    attempts = otp_record.get("attempts", 0)
    if attempts >= settings.VERIFICATION_OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Maximum OTP attempts exceeded. Please request a new code.")

    await verification_otps_col.update_one({"_id": otp_record["_id"]}, {"$inc": {"attempts": 1}})

    expires = otp_record.get("expiresAt")
    if expires:
        expires_dt = expires if hasattr(expires, "tzinfo") else datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
        if not hasattr(expires_dt, "tzinfo") or expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_dt:
            raise HTTPException(status_code=400, detail="OTP expired. Request a new code.")

    if otp_record["otp"] != body.otp.strip():
        remaining = settings.VERIFICATION_OTP_MAX_ATTEMPTS - (attempts + 1)
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {remaining} attempts remaining.")

    await verification_requests_col.update_one(
        {"id": request_id},
        {"$set": {"mobileVerified": True, "updatedAt": datetime.now(timezone.utc).isoformat()}}
    )
    await verification_otps_col.delete_one({"_id": otp_record["_id"]})
    await _write_log(request_id, "MOBILE_VERIFIED", ip_address=_get_ip(request))
    return {"message": "Mobile verified successfully.", "mobileVerified": True}


# ─────────────────────────────────────────────────────────────
# POST /upload-id — Government ID Upload + Simulated OCR
# ─────────────────────────────────────────────────────────────

@router.post("/upload-id")
async def upload_government_id(
    request: Request,
    accessToken: str = Form(...),
    documentType: str = Form(..., description="AADHAAR | PASSPORT | DRIVING_LICENSE"),
    file: UploadFile = File(...),
):
    """Upload a Government ID. Runs simulated OCR and computes an initial risk score."""
    nominee = await _authenticate_nominee(accessToken)
    ver_request = await _get_active_request(nominee["id"])
    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request.")
    if not ver_request.get("mobileVerified"):
        raise HTTPException(status_code=400, detail="Mobile must be verified before ID upload.")

    file_data = await _read_and_encrypt_file(file, "Government ID")
    request_id = ver_request["id"]
    doc_id = _generate_id()

    await verification_documents_col.insert_one({
        "id": doc_id,
        "requestId": request_id,
        "documentType": "GOVT_ID",
        "idType": documentType.upper(),
        **file_data,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    # Simulated OCR
    ocr_data = _simulate_ocr(documentType)
    risk_score = _compute_risk_score(nominee, ocr_data, ver_request)

    await verification_requests_col.update_one(
        {"id": request_id},
        {"$set": {
            "govtIdVerified": True,
            "ocrData": ocr_data,
            "riskScore": risk_score,
            "govtIdDocumentId": doc_id,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }}
    )
    await _write_log(request_id, "ID_UPLOADED", ip_address=_get_ip(request),
                     metadata={"documentType": documentType, "riskScore": risk_score})

    return {
        "message": "Government ID uploaded and processed.",
        "govtIdVerified": True,
        "ocrData": ocr_data,
        "riskScore": risk_score,
    }


# ─────────────────────────────────────────────────────────────
# POST /upload-selfie — Selfie + Liveness Detection
# ─────────────────────────────────────────────────────────────

@router.post("/upload-selfie")
async def upload_selfie(
    request: Request,
    accessToken: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload a selfie for face and liveness verification."""
    nominee = await _authenticate_nominee(accessToken)
    ver_request = await _get_active_request(nominee["id"])
    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request.")
    if not ver_request.get("govtIdVerified"):
        raise HTTPException(status_code=400, detail="Government ID must be uploaded before selfie.")

    file_data = await _read_and_encrypt_file(file, "Selfie")
    request_id = ver_request["id"]
    doc_id = _generate_id()

    await verification_documents_col.insert_one({
        "id": doc_id,
        "requestId": request_id,
        "documentType": "SELFIE",
        **file_data,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    # Simulated liveness/face match — always passes in dev
    face_result = {
        "livenessScore": 0.97,
        "faceMatchScore": 0.92,
        "verified": True,
        "simulatedAt": datetime.now(timezone.utc).isoformat(),
    }

    await verification_requests_col.update_one(
        {"id": request_id},
        {"$set": {
            "faceVerified": True,
            "faceVerificationData": face_result,
            "selfieDocumentId": doc_id,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }}
    )
    await _write_log(request_id, "SELFIE_UPLOADED", ip_address=_get_ip(request))
    return {"message": "Selfie verified successfully.", "faceVerified": True, "faceResult": face_result}


# ─────────────────────────────────────────────────────────────
# POST /upload-death-document — Death Evidence Upload
# ─────────────────────────────────────────────────────────────

@router.post("/upload-death-document")
async def upload_death_document(
    request: Request,
    accessToken: str = Form(...),
    documentType: str = Form(..., description="DEATH_CERTIFICATE | DEATH_REGISTRATION | HOSPITAL_RECORD | etc."),
    file: UploadFile = File(...),
):
    """Upload a single piece of death evidence. Can be called multiple times."""
    nominee = await _authenticate_nominee(accessToken)
    ver_request = await _get_active_request(nominee["id"])
    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request.")

    doc_type = documentType.upper()
    if doc_type not in ALL_DEATH_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type '{documentType}'. Must be one of: {', '.join(sorted(ALL_DEATH_DOC_TYPES))}",
        )

    file_data = await _read_and_encrypt_file(file, "Death Document")
    request_id = ver_request["id"]
    doc_id = _generate_id()

    is_preferred = doc_type in PREFERRED_DOC_TYPES
    await verification_documents_col.insert_one({
        "id": doc_id,
        "requestId": request_id,
        "documentType": doc_type,
        "isPreferred": is_preferred,
        **file_data,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    await verification_requests_col.update_one(
        {"id": request_id},
        {"$push": {"deathEvidence": {
            "documentId": doc_id,
            "documentType": doc_type,
            "isPreferred": is_preferred,
            "fileName": file_data["fileName"],
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
        }}, "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}}
    )

    await _write_log(request_id, "DEATH_DOCUMENT_UPLOADED", ip_address=_get_ip(request),
                     metadata={"documentType": doc_type, "isPreferred": is_preferred})

    # Trigger background AI verification analysis
    if getattr(settings, "AI_AUTO_ANALYZE_ON_UPLOAD", True):
        try:
            import asyncio
            from app.lib.ai_verification_service import run_ai_verification
            asyncio.create_task(run_ai_verification(request_id, admin_id="ai_auto_trigger"))
            print(f"[AI AUTO-VERIFY] Dispatched background AI analysis for request {request_id}")
        except Exception as e:
            print(f"[AI AUTO-VERIFY] Background task error: {e}")

    return {
        "message": f"{'Preferred' if is_preferred else 'Alternative'} death evidence uploaded successfully.",
        "documentId": doc_id,
        "documentType": doc_type,
        "isPreferred": is_preferred,
    }


# ─────────────────────────────────────────────────────────────
# POST /complete — Finalise Submission
# ─────────────────────────────────────────────────────────────

@router.post("/complete")
async def complete_verification(body: OTPRequest, request: Request):
    """Nominee finalises submission. Moves status to PENDING_REVIEW for admin action."""
    nominee = await _authenticate_nominee(body.accessToken)
    ver_request = await _get_active_request(nominee["id"])
    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request.")

    # Validate that all required steps are done
    if not ver_request.get("emailVerified"):
        raise HTTPException(status_code=400, detail="Email verification is not complete.")
    if not ver_request.get("mobileVerified"):
        raise HTTPException(status_code=400, detail="Mobile verification is not complete.")
    if not ver_request.get("govtIdVerified"):
        raise HTTPException(status_code=400, detail="Government ID upload is not complete.")
    if not ver_request.get("faceVerified"):
        raise HTTPException(status_code=400, detail="Selfie/liveness verification is not complete.")

    # Check at least one death document has been uploaded
    death_evidence = ver_request.get("deathEvidence") or []
    if not death_evidence:
        raise HTTPException(status_code=400, detail="At least one piece of death evidence must be uploaded.")

    old_status = ver_request["status"]
    now = datetime.now(timezone.utc).isoformat()

    await verification_requests_col.update_one(
        {"id": ver_request["id"]},
        {"$set": {"status": STATUS_PENDING, "submittedAt": now, "updatedAt": now}}
    )
    await _write_log(ver_request["id"], "REVIEW_SUBMITTED", ip_address=_get_ip(request))
    await _write_status_history(ver_request["id"], old_status, STATUS_PENDING,
                                 remarks="Nominee completed all steps. Awaiting admin review.")

    print(f"[VERIFICATION] Request {ver_request['id']} moved to PENDING_REVIEW.")

    return {
        "message": "Verification submitted successfully. You will be notified once the review is complete.",
        "status": STATUS_PENDING,
        "estimatedReviewDays": 3,
    }


# ─────────────────────────────────────────────────────────────
# GET /status — Status Polling
# ─────────────────────────────────────────────────────────────

@router.get("/status")
async def get_verification_status(accessToken: str, request: Request):
    """Return the current verification request status and checklist."""
    nominee = await _authenticate_nominee(accessToken)
    ver_request = await _get_active_request(nominee["id"])

    if not ver_request:
        return {"hasRequest": False, "message": "No active verification request found."}

    # Check if cooling period has elapsed — auto-transition to NOMINEE_NOTIFIED
    if ver_request["status"] == STATUS_COOLING:
        cooling_end_str = ver_request.get("coolingPeriodEnd")
        if cooling_end_str:
            cooling_end = datetime.fromisoformat(cooling_end_str.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) >= cooling_end:
                await verification_requests_col.update_one(
                    {"id": ver_request["id"]},
                    {"$set": {"status": STATUS_NOTIFIED, "updatedAt": datetime.now(timezone.utc).isoformat()}}
                )
                await _write_status_history(ver_request["id"], STATUS_COOLING, STATUS_NOTIFIED,
                                             remarks="Cooling period elapsed. Nominee notified.")
                ver_request["status"] = STATUS_NOTIFIED

    # Build a clean checklist response (no binary data)
    return {
        "hasRequest": True,
        "requestId": ver_request["id"],
        "status": ver_request["status"],
        "coolingPeriodEnd": ver_request.get("coolingPeriodEnd"),
        "checklist": {
            "emailVerified": ver_request.get("emailVerified", False),
            "mobileVerified": ver_request.get("mobileVerified", False),
            "govtIdVerified": ver_request.get("govtIdVerified", False),
            "faceVerified": ver_request.get("faceVerified", False),
            "deathEvidenceCount": len(ver_request.get("deathEvidence") or []),
        },
        "ocrData": ver_request.get("ocrData"),
        "riskScore": ver_request.get("riskScore"),
        "deathEvidence": ver_request.get("deathEvidence") or [],
        "reviewHistory": ver_request.get("reviewHistory") or [],
        "submittedAt": ver_request.get("submittedAt"),
        "updatedAt": ver_request.get("updatedAt"),
    }


# ─────────────────────────────────────────────────────────────
# POST /additional-document — More Docs after MORE_DOCUMENTS_REQUIRED
# ─────────────────────────────────────────────────────────────

@router.post("/additional-document")
async def upload_additional_document(
    request: Request,
    accessToken: str = Form(...),
    documentType: str = Form("SUPPORTING_EVIDENCE"),
    file: UploadFile = File(...),
):
    """Upload additional documents when the admin has requested more information."""
    nominee = await _authenticate_nominee(accessToken)
    ver_request = await _get_active_request(nominee["id"])
    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request.")
    if ver_request["status"] != STATUS_MORE_DOCS:
        raise HTTPException(
            status_code=400,
            detail=f"Additional uploads are only allowed when status is MORE_DOCUMENTS_REQUIRED. Current: {ver_request['status']}",
        )

    file_data = await _read_and_encrypt_file(file, "Additional Document")
    doc_type = documentType.upper() if documentType.upper() in ALL_DEATH_DOC_TYPES else "SUPPORTING_EVIDENCE"
    doc_id = _generate_id()
    request_id = ver_request["id"]

    await verification_documents_col.insert_one({
        "id": doc_id,
        "requestId": request_id,
        "documentType": doc_type,
        "isAdditional": True,
        "isPreferred": doc_type in PREFERRED_DOC_TYPES,
        **file_data,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    await verification_requests_col.update_one(
        {"id": request_id},
        {
            "$push": {"deathEvidence": {
                "documentId": doc_id,
                "documentType": doc_type,
                "isAdditional": True,
                "fileName": file_data["fileName"],
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
            }},
            "$set": {
                "status": STATUS_PENDING,  # Re-submit for review
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        }
    )

    await _write_log(request_id, "ADDITIONAL_DOCUMENT_UPLOADED", ip_address=_get_ip(request))
    await _write_status_history(request_id, STATUS_MORE_DOCS, STATUS_PENDING,
                                 remarks=f"Nominee re-submitted with additional document: {file_data['fileName']}")

    return {
        "message": "Additional document uploaded. Your request has been re-submitted for review.",
        "documentId": doc_id,
        "status": STATUS_PENDING,
    }


# ─────────────────────────────────────────────────────────────
# DELETE /document/{document_id} — Delete a document
# ─────────────────────────────────────────────────────────────

@router.delete("/document/{document_id}")
async def delete_verification_document(
    document_id: str,
    accessToken: str,
    request: Request,
):
    """Delete a specific uploaded verification document."""
    nominee = await _authenticate_nominee(accessToken)
    ver_request = await _get_active_request(nominee["id"])
    if not ver_request:
        raise HTTPException(status_code=404, detail="No active verification request.")

    # Find the document
    doc = await verification_documents_col.find_one({"id": document_id, "requestId": ver_request["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Delete from database
    await verification_documents_col.delete_one({"_id": doc["_id"]})

    # Update verification request
    await verification_requests_col.update_one(
        {"id": ver_request["id"]},
        {
            "$pull": {"deathEvidence": {"documentId": document_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
        }
    )

    await _write_log(ver_request["id"], "DOCUMENT_DELETED", ip_address=_get_ip(request),
                     metadata={"documentId": document_id, "documentType": doc["documentType"]})

    return {"message": "Document deleted successfully"}
