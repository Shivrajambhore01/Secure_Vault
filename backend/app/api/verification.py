"""Death Verification Administration API routes.

All routes are protected by VERIFICATION_ADMIN or SUPER_ADMIN role.
Verification Admins can ONLY review verification requests — they CANNOT
view decrypted user assets, modify users, modify nominees, or modify assets.

Endpoints:
  GET  /api/admin/verification/stats                  — Dashboard statistics
  GET  /api/admin/verification/requests               — List verification requests (filterable)
  GET  /api/admin/verification/requests/{id}           — Get full request details
  GET  /api/admin/verification/requests/{id}/file/{ft} — Stream a verification document file
  POST /api/admin/verification/requests/{id}/review    — Approve / Reject / Request More Docs
  POST /api/admin/verification/requests/{id}/assign    — Claim request (mark UNDER_REVIEW)
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.core.database import db
from app.core.admin_security import require_role
from app.lib.encryption import decrypt_bytes

router = APIRouter()

# Collections
verifications_col = db["verification_requests"]
verification_documents_col = db["verification_documents"]
verification_audit_col = db["verification_logs"]
users_col = db["users"]
nominees_col = db["nominees"]
admins_col = db["admins"]


# ------------------------------------------------------------------
# Request Models
# ------------------------------------------------------------------

class ReviewRequest(BaseModel):
    action: str  # APPROVE | REJECT | REQUEST_MORE_DOCS
    remarks: str = ""


# ------------------------------------------------------------------
# Allowed roles for verification routes
# ------------------------------------------------------------------
ALLOWED_ROLES = ("VERIFICATION_ADMIN", "SUPER_ADMIN")

VALID_STATUSES = {
    "PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "MORE_DOCUMENTS_REQUIRED",
    "CLAIMED", "COOLING_PERIOD", "HALTED", "NOMINEE_NOTIFIED", "PENDING_REVIEW"
}


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _compute_priority(created_at_str: str) -> str:
    """Auto-calculate priority based on age of request."""
    try:
        created = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        age = datetime.now(timezone.utc) - created
        if age > timedelta(days=7):
            return "HIGH"
        elif age > timedelta(days=3):
            return "MEDIUM"
        return "LOW"
    except Exception:
        return "LOW"


async def _write_verification_audit(
    verification_id: str,
    action: str,
    admin_id: str,
    admin_email: str,
    ip_address: str,
    reason: str = "",
    metadata: dict = None,
):
    """Write an entry to the verification audit logs."""
    entry = {
        "verificationId": verification_id,
        "action": action,
        "adminId": admin_id,
        "adminEmail": admin_email,
        "ipAddress": ip_address,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }
    try:
        await verification_audit_col.insert_one(entry)
        print(f"[VERIFICATION AUDIT] {action} on {verification_id} by {admin_email}")
    except Exception as e:
        print(f"[VERIFICATION AUDIT ERROR] {e}")


async def _send_notification_email(to: str, subject: str, html: str):
    """Reuse the existing email helper pattern."""
    from app.core.config import get_settings
    settings = get_settings()
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
        print(f"[DEV MODE] Would send email to {to}: {subject}")


async def _notify_nominee(nominee_email: str, nominee_name: str, status: str, remarks: str = "", nominee_token: str = ""):
    """Send a notification email to the nominee about their verification status."""
    from app.core.config import get_settings
    settings = get_settings()
    frontend_url = settings.FRONTEND_URL.rstrip('/')

    status_labels = {
        "APPROVED": "Approved ✅",
        "REJECTED": "Rejected ❌",
        "MORE_DOCUMENTS_REQUIRED": "Additional Documents Required 📄",
    }
    status_label = status_labels.get(status, status)
    access_url = f"{frontend_url}/nominee/vault/{nominee_token}" if nominee_token else f"{frontend_url}/nominee/verify/{nominee_token}"
    resubmit_url = f"{frontend_url}/nominee/verify/{nominee_token}"

    action_button_html = ""
    if status == "APPROVED":
        action_button_html = f"""
        <div style="text-align: center; margin: 28px 0;">
            <a href="{access_url}" style="display: inline-block; background-color: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Access Your Approved Assets →
            </a>
        </div>
        """
    elif status == "REJECTED":
        action_button_html = f"""
        <div style="text-align: center; margin: 28px 0;">
            <a href="{resubmit_url}" style="display: inline-block; background-color: #ef4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Resubmit Verification Claim →
            </a>
        </div>
        """
    elif status == "MORE_DOCUMENTS_REQUIRED":
        action_button_html = f"""
        <div style="text-align: center; margin: 28px 0;">
            <a href="{resubmit_url}" style="display: inline-block; background-color: #f59e0b; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Upload Requested Documents →
            </a>
        </div>
        """

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #3b82f6;">
        <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 30px 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔐 SecureVault</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Inheritance Verification Update</p>
        </div>
        <div style="padding: 36px 40px; color: #e2e8f0;">
            <h2 style="color: #3b82f6; font-size: 20px; margin-top: 0;">Verification Status: {status_label}</h2>
            <p>Hello <strong>{nominee_name}</strong>,</p>
            <p>Your inheritance death verification claim on SecureVault has been reviewed by our compliance team.</p>
            <div style="background: #1e293b; border-radius: 10px; padding: 20px; margin: 24px 0;">
                <p style="margin: 0; font-size: 14px;"><strong>Status:</strong> {status_label}</p>
                {f'<p style="margin: 12px 0 0; font-size: 13px; color: #f87171;"><strong>Reason / Remarks:</strong> {remarks}</p>' if remarks else ''}
            </div>
            {action_button_html}
            {"<p style='color: #94a3b8; font-size: 13px;'>Your approved digital assets are now accessible in view-only mode via your secure portal link.</p>" if status == "APPROVED" else ""}
            {"<p style='color: #94a3b8; font-size: 13px;'>If your claim was rejected or requires corrections, please click the button above to upload a revised certificate or supporting details.</p>" if status in ("REJECTED", "MORE_DOCUMENTS_REQUIRED") else ""}
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">This is an automated message from SecureVault. Do not reply to this email.</p>
        </div>
    </div>
    """
    try:
        await _send_notification_email(nominee_email, f"SecureVault: Verification {status_label}", html)
    except Exception as e:
        print(f"[VERIFICATION] Failed to send notification to {nominee_email}: {e}")


async def _notify_owner(owner_email: str, owner_name: str, nominee_name: str, status: str):
    """Send a notification email to the account owner about the verification action."""
    if status != "APPROVED":
        return  # Only notify owner on approval

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #ef4444;">
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 30px 40px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔐 SecureVault</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Important Security Notification</p>
        </div>
        <div style="padding: 36px 40px; color: #e2e8f0;">
            <h2 style="color: #ef4444; font-size: 20px; margin-top: 0;">Death Verification Approved</h2>
            <p>Dear <strong>{owner_name}</strong>,</p>
            <p>A death verification request submitted by your designated nominee <strong>{nominee_name}</strong> has been <strong>approved</strong> following review of the submitted Death Certificate.</p>
            <p>Access to your assigned digital vault assets has been unlocked for your nominee.</p>
            <div style="background: #1e293b; border-radius: 10px; padding: 20px; margin: 24px 0; border: 1px solid #334155;">
                <p style="margin: 0; font-size: 13px; color: #cbd5e1;"><strong>Security Notice:</strong> If you are active and believe this verification was processed in error, please log in to your SecureVault dashboard immediately to revoke nominee access and secure your account.</p>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">This is an automated security alert from SecureVault.</p>
        </div>
    </div>
    """
    try:
        await _send_notification_email(owner_email, "🚨 SecureVault: Death Verification Approved for Nominee", html)
    except Exception as e:
        print(f"[VERIFICATION] Failed to send owner notification to {owner_email}: {e}")


# ------------------------------------------------------------------
# GET /stats — Verification dashboard statistics
# ------------------------------------------------------------------

@router.get("/stats")
async def get_verification_stats(
    current_admin: dict = Depends(require_role(*ALLOWED_ROLES)),
):
    """Return aggregate stats for the verification dashboard."""
    pending = await verifications_col.count_documents({"status": {"$in": ["PENDING", "PENDING_REVIEW"]}})
    under_review = await verifications_col.count_documents({"status": "UNDER_REVIEW"})

    # Approved/Rejected today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    approved_today = await verifications_col.count_documents({
        "status": "APPROVED",
        "reviewedAt": {"$gte": today_start},
    })
    rejected_today = await verifications_col.count_documents({
        "status": "REJECTED",
        "reviewedAt": {"$gte": today_start},
    })

    # Average review time (for completed reviews)
    pipeline = [
        {"$match": {"reviewedAt": {"$ne": None}, "status": {"$in": ["APPROVED", "REJECTED"]}}},
        {"$limit": 100},  # Cap for performance
    ]
    reviewed = await verifications_col.aggregate(pipeline).to_list(length=100)
    avg_hours = 0
    if reviewed:
        total_hours = 0
        count = 0
        for v in reviewed:
            try:
                created = datetime.fromisoformat(v["createdAt"].replace("Z", "+00:00"))
                reviewed_at = datetime.fromisoformat(v["reviewedAt"].replace("Z", "+00:00"))
                delta = (reviewed_at - created).total_seconds() / 3600
                total_hours += delta
                count += 1
            except Exception:
                pass
        avg_hours = round(total_hours / count, 1) if count else 0

    # Total counts
    total = await verifications_col.count_documents({})
    more_docs = await verifications_col.count_documents({"status": "MORE_DOCUMENTS_REQUIRED"})

    # Recent 5 requests
    recent_cursor = verifications_col.find({}).sort("createdAt", -1).limit(5)
    recent = await recent_cursor.to_list(length=5)
    for r in recent:
        r["_id"] = str(r["_id"])
        # Compute live priority
        r["priority"] = _compute_priority(r.get("createdAt", ""))
        # Fetch owner and nominee names
        owner = await users_col.find_one({"_id": ObjectId(r["userId"])} if ObjectId.is_valid(r["userId"]) else {"id": r["userId"]}, {"fullName": 1, "email": 1})
        nominee = await nominees_col.find_one({"id": r["nomineeId"]}, {"name": 1, "email": 1, "relation": 1})
        r["ownerName"] = owner.get("fullName", "Unknown") if owner else "Unknown"
        r["nomineeName"] = nominee.get("name", "Unknown") if nominee else "Unknown"
        r["nomineeRelation"] = nominee.get("relation", "N/A") if nominee else "N/A"
        # Strip file data from response
        for key in ("certificateFile", "governmentIdFile", "relationshipProofFile"):
            if r.get(key) and isinstance(r[key], dict):
                r[key] = {k: v for k, v in r[key].items() if k != "data"}

    return {
        "pending": pending,
        "underReview": under_review,
        "approvedToday": approved_today,
        "rejectedToday": rejected_today,
        "avgReviewTimeHours": avg_hours,
        "total": total,
        "moreDocsRequired": more_docs,
        "recentRequests": recent,
    }


# ------------------------------------------------------------------
# GET /requests — List all verification requests (filterable)
# ------------------------------------------------------------------

@router.get("/requests")
async def list_verification_requests(
    current_admin: dict = Depends(require_role(*ALLOWED_ROLES)),
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    sort_by: str = "createdAt",
    sort_order: str = "desc",
):
    """List verification requests with filtering and pagination."""
    query: dict = {}

    if status and status in VALID_STATUSES:
        query["status"] = status

    # Build the sort
    sort_dir = -1 if sort_order == "desc" else 1

    cursor = verifications_col.find(query).sort(sort_by, sort_dir).skip(skip).limit(limit)
    requests = await cursor.to_list(length=limit)
    total = await verifications_col.count_documents(query)

    results = []
    for r in requests:
        r["_id"] = str(r["_id"])
        r["priority"] = _compute_priority(r.get("createdAt", ""))

        # Fetch owner and nominee metadata
        try:
            owner = await users_col.find_one(
                {"_id": ObjectId(r["userId"])} if ObjectId.is_valid(r["userId"]) else {"id": r["userId"]},
                {"fullName": 1, "email": 1},
            )
        except Exception:
            owner = None
        nominee = await nominees_col.find_one({"id": r["nomineeId"]}, {"name": 1, "email": 1, "relation": 1})

        r["ownerName"] = owner.get("fullName", "Unknown") if owner else "Unknown"
        r["ownerEmail"] = owner.get("email", "") if owner else ""
        r["nomineeName"] = nominee.get("name", "Unknown") if nominee else "Unknown"
        r["nomineeEmail"] = nominee.get("email", "") if nominee else ""
        r["nomineeRelation"] = nominee.get("relation", "N/A") if nominee else "N/A"

        # Strip binary file data from list response
        for key in ("certificateFile", "governmentIdFile", "relationshipProofFile"):
            if r.get(key) and isinstance(r[key], dict):
                r[key] = {k: v for k, v in r[key].items() if k != "data"}

        # Apply search filter in Python (across owner/nominee names)
        if search:
            search_lower = search.lower()
            matches = (
                search_lower in r["ownerName"].lower()
                or search_lower in r["nomineeName"].lower()
                or search_lower in r.get("ownerEmail", "").lower()
                or search_lower in r.get("nomineeEmail", "").lower()
            )
            if not matches:
                continue

        results.append(r)

    return {"requests": results, "total": total, "skip": skip, "limit": limit}


# ------------------------------------------------------------------
# GET /requests/{id} — Full request detail
# ------------------------------------------------------------------

@router.get("/requests/{verification_id}")
async def get_verification_detail(
    verification_id: str,
    request: Request,
    current_admin: dict = Depends(require_role(*ALLOWED_ROLES)),
):
    """Get full verification request detail including owner/nominee profiles."""
    v = await verifications_col.find_one({"id": verification_id})
    if not v:
        raise HTTPException(status_code=404, detail="Verification request not found.")

    v["_id"] = str(v["_id"])
    v["priority"] = _compute_priority(v.get("createdAt", ""))

    # Fetch owner profile (metadata only — NEVER passwords, PINs, secrets)
    try:
        owner = await users_col.find_one(
            {"_id": ObjectId(v["userId"])} if ObjectId.is_valid(v["userId"]) else {"id": v["userId"]},
            {"password": 0, "pin": 0, "twoFactorSecret": 0},
        )
    except Exception:
        owner = None
    if owner:
        owner["_id"] = str(owner["_id"])

    # Fetch nominee profile
    nominee = await nominees_col.find_one({"id": v["nomineeId"]})
    if nominee:
        nominee["_id"] = str(nominee["_id"])

    # Fetch reviewer info if reviewed
    reviewer = None
    if v.get("reviewedBy"):
        reviewer = await admins_col.find_one({"id": v["reviewedBy"]}, {"password": 0})
        if reviewer:
            reviewer["_id"] = str(reviewer["_id"])

    # For compatibility: populate file metadata from separate documents collection
    docs_cursor = verification_documents_col.find({"requestId": verification_id}, {"data": 0})
    db_docs = await docs_cursor.to_list(length=100)
    for doc in db_docs:
        doc["_id"] = str(doc["_id"])
        if doc["documentType"] in ("DEATH_CERTIFICATE", "DEATH_REGISTRATION") and not v.get("certificateFile"):
            v["certificateFile"] = doc
        elif doc["documentType"] == "GOVT_ID" and not v.get("governmentIdFile"):
            v["governmentIdFile"] = doc
        elif doc["documentType"] == "SUPPORTING_EVIDENCE" and not v.get("relationshipProofFile"):
            v["relationshipProofFile"] = doc
        elif doc["documentType"] == "SELFIE" and not v.get("selfieFile"):
            v["selfieFile"] = doc

    # Strip binary data from file fields (keep metadata)
    for key in ("certificateFile", "governmentIdFile", "relationshipProofFile", "selfieFile"):
        if v.get(key) and isinstance(v[key], dict):
            v[key] = {k: val for k, val in v[key].items() if k != "data"}

    # Build a dynamic list of ALL submitted documents (metadata only)
    all_documents = []
    for doc in db_docs:
        all_documents.append({
            "id": doc.get("id"),
            "documentType": doc.get("documentType", "UNKNOWN"),
            "fileName": doc.get("fileName", "document"),
            "mimeType": doc.get("mimeType", "application/octet-stream"),
            "isPreferred": doc.get("isPreferred", False),
            "isAdditional": doc.get("isAdditional", False),
            "idType": doc.get("idType"),
            "createdAt": doc.get("createdAt"),
        })

    # Fetch audit log / review history
    audit_logs = await verification_audit_col.find(
        {"verificationId": verification_id}
    ).sort("timestamp", -1).to_list(length=50)
    for log in audit_logs:
        log["_id"] = str(log["_id"])

    # Fetch stored AI verification report if present
    ai_ver_doc = await db["ai_verifications"].find_one({"verificationRequestId": verification_id})
    if ai_ver_doc:
        ai_ver_doc["_id"] = str(ai_ver_doc["_id"])
        v["aiVerificationFull"] = ai_ver_doc
        v["aiVerificationScore"] = ai_ver_doc.get("aiVerificationConfidence")

    # Write audit log for viewing
    client_ip = request.client.host if request.client else "unknown"
    await _write_verification_audit(
        verification_id, "VERIFICATION_VIEWED",
        current_admin.get("adminId", ""), current_admin.get("email", ""),
        client_ip,
    )

    return {
        "verification": v,
        "owner": owner,
        "nominee": nominee,
        "reviewer": reviewer,
        "auditLogs": audit_logs,
        "aiVerification": ai_ver_doc,
        "documents": all_documents,
    }


# ------------------------------------------------------------------
# POST /requests/{id}/analyze — Trigger AI verification analysis
# ------------------------------------------------------------------

@router.post("/requests/{verification_id}/analyze")
async def trigger_ai_analysis(
    verification_id: str,
    request: Request,
    current_admin: dict = Depends(require_role(*ALLOWED_ROLES)),
):
    """Trigger AI-assisted death certificate verification analysis."""
    from app.lib.ai_verification_service import run_ai_verification
    admin_id = current_admin.get("adminId", "")
    admin_email = current_admin.get("email", "")
    client_ip = request.client.host if request.client else "unknown"

    await _write_verification_audit(
        verification_id, "AI_ANALYSIS_TRIGGERED",
        admin_id, admin_email, client_ip,
    )

    ai_result = await run_ai_verification(verification_id, admin_id=admin_id)
    return {"message": "AI verification analysis completed successfully.", "aiResult": ai_result}


# ------------------------------------------------------------------
# GET /requests/{id}/ai-result — Retrieve stored AI verification result
# ------------------------------------------------------------------

@router.get("/requests/{verification_id}/ai-result")
async def get_ai_verification_result(
    verification_id: str,
    current_admin: dict = Depends(require_role(*ALLOWED_ROLES)),
):
    """Retrieve stored AI verification report for a request."""
    ai_doc = await db["ai_verifications"].find_one({"verificationRequestId": verification_id})
    if not ai_doc:
        return {"status": "pending", "message": "AI analysis pending or not yet requested."}

    ai_doc["_id"] = str(ai_doc["_id"])
    return {"status": "completed", "aiResult": ai_doc}



# ------------------------------------------------------------------
# GET /requests/{id}/file/{file_type} — Stream verification doc
# ------------------------------------------------------------------

@router.get("/requests/{verification_id}/file/{file_type}")
async def get_verification_file(
    verification_id: str,
    file_type: str,
    current_admin: dict = Depends(require_role(*ALLOWED_ROLES)),
):
    """Stream a verification document file (decrypted on-the-fly).

    file_type must be one of: certificate, governmentId, relationshipProof
    """
    field_map = {
        "certificate": "certificateFile",
        "governmentId": "governmentIdFile",
        "relationshipProof": "relationshipProofFile",
    }
    if file_type not in field_map:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Must be one of: {', '.join(field_map.keys())}")

    doc_type_map = {
        "certificate": "DEATH_CERTIFICATE",
        "governmentId": "GOVT_ID",
        "relationshipProof": "SUPPORTING_EVIDENCE",
    }
    doc_type = doc_type_map.get(file_type)

    # Try finding in the separate documents collection first
    file_obj = await verification_documents_col.find_one({"requestId": verification_id, "documentType": doc_type})

    if not file_obj:
        # Fallback to checking legacy embedded files
        v = await verifications_col.find_one({"id": verification_id})
        if v:
            field = field_map[file_type]
            file_obj = v.get(field)

    if not file_obj or not isinstance(file_obj, dict) or not file_obj.get("data"):
        raise HTTPException(status_code=404, detail=f"No {file_type} file found for this request.")

    # Decrypt file bytes
    file_bytes = file_obj["data"]
    try:
        file_bytes = decrypt_bytes(file_bytes)
    except Exception as e:
        print(f"[Verification] Decryption error for {verification_id}/{file_type}: {e}")
        raise HTTPException(status_code=500, detail="Error decrypting verification document.")

    mime_type = file_obj.get("mimeType", "application/octet-stream")
    filename = file_obj.get("fileName", f"{file_type}_document")

    return Response(
        content=file_bytes,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


@router.get("/requests/{verification_id}/document/{document_id}")
async def get_verification_document_by_id(
    verification_id: str,
    document_id: str,
    current_admin: dict = Depends(require_role(*ALLOWED_ROLES)),
):
    """Stream any verification document file by its unique ID (decrypted on-the-fly)."""
    file_obj = await verification_documents_col.find_one({"requestId": verification_id, "id": document_id})
    if not file_obj:
        raise HTTPException(status_code=404, detail="Verification document not found.")

    file_bytes = file_obj["data"]
    try:
        file_bytes = decrypt_bytes(file_bytes)
    except Exception as e:
        print(f"[Verification] Decryption error for doc {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Error decrypting verification document.")

    mime_type = file_obj.get("mimeType", "application/octet-stream")
    filename = file_obj.get("fileName", "document")

    return Response(
        content=file_bytes,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


# ------------------------------------------------------------------
# POST /requests/{id}/assign — Claim request (UNDER_REVIEW)
# ------------------------------------------------------------------

@router.post("/requests/{verification_id}/assign")
async def assign_verification(
    verification_id: str,
    request: Request,
    current_admin: dict = Depends(require_role(*ALLOWED_ROLES)),
):
    """Claim a verification request and mark it as UNDER_REVIEW."""
    v = await verifications_col.find_one({"id": verification_id})
    if not v:
        raise HTTPException(status_code=404, detail="Verification request not found.")

    if v["status"] not in ("PENDING", "PENDING_REVIEW", "MORE_DOCUMENTS_REQUIRED"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign request with status '{v['status']}'. Only PENDING, PENDING_REVIEW, or MORE_DOCUMENTS_REQUIRED requests can be assigned.",
        )

    now = datetime.now(timezone.utc).isoformat()
    admin_id = current_admin.get("adminId", "")
    admin_email = current_admin.get("email", "")

    # Update status and add to review history
    history_entry = {
        "action": "ASSIGNED",
        "adminId": admin_id,
        "adminEmail": admin_email,
        "timestamp": now,
        "remarks": f"Claimed for review by {admin_email}",
    }

    await verifications_col.update_one(
        {"id": verification_id},
        {
            "$set": {
                "status": "UNDER_REVIEW",
                "reviewedBy": admin_id,
                "updatedAt": now,
            },
            "$push": {"reviewHistory": history_entry},
        },
    )

    # Audit log
    client_ip = request.client.host if request.client else "unknown"
    await _write_verification_audit(
        verification_id, "VERIFICATION_ASSIGNED",
        admin_id, admin_email, client_ip,
    )

    return {"message": "Verification request assigned for review."}


# ------------------------------------------------------------------
# POST /requests/{id}/review — Approve / Reject / Request More Docs
# ------------------------------------------------------------------

@router.post("/requests/{verification_id}/review")
async def review_verification(
    verification_id: str,
    body: ReviewRequest,
    request: Request,
    current_admin: dict = Depends(require_role(*ALLOWED_ROLES)),
):
    """Take an action on a verification request."""
    v = await verifications_col.find_one({"id": verification_id})
    if not v:
        raise HTTPException(status_code=404, detail="Verification request not found.")

    action_map = {
        "APPROVE": "APPROVED",
        "REJECT": "REJECTED",
        "REQUEST_MORE_DOCS": "MORE_DOCUMENTS_REQUIRED",
    }
    if body.action not in action_map:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action. Must be one of: {', '.join(action_map.keys())}",
        )

    if body.action == "REJECT" and not body.remarks.strip():
        raise HTTPException(status_code=400, detail="Rejection reason is required.")

    new_status = action_map[body.action]
    now = datetime.now(timezone.utc).isoformat()
    admin_id = current_admin.get("adminId", "")
    admin_email = current_admin.get("email", "")

    # Build review history entry
    history_entry = {
        "action": body.action,
        "status": new_status,
        "adminId": admin_id,
        "adminEmail": admin_email,
        "timestamp": now,
        "remarks": body.remarks.strip(),
    }

    update_fields = {
        "status": new_status,
        "reviewedBy": admin_id,
        "reviewedAt": now,
        "remarks": body.remarks.strip(),
        "updatedAt": now,
    }

    await verifications_col.update_one(
        {"id": verification_id},
        {
            "$set": update_fields,
            "$push": {"reviewHistory": history_entry},
        },
    )

    # Audit log
    client_ip = request.client.host if request.client else "unknown"
    audit_action_map = {
        "APPROVE": "VERIFICATION_APPROVED",
        "REJECT": "VERIFICATION_REJECTED",
        "REQUEST_MORE_DOCS": "DOCUMENTS_REQUESTED",
    }
    await _write_verification_audit(
        verification_id,
        audit_action_map[body.action],
        admin_id,
        admin_email,
        client_ip,
        reason=body.remarks.strip(),
    )

    # Send notifications
    nominee = await nominees_col.find_one({"id": v["nomineeId"]})
    if nominee:
        await _notify_nominee(
            nominee.get("email", ""),
            nominee.get("name", "Nominee"),
            new_status,
            body.remarks.strip(),
            nominee_token=nominee.get("accessToken", ""),
        )

    # Notify owner on approval
    if new_status == "APPROVED":
        try:
            owner = await users_col.find_one(
                {"_id": ObjectId(v["userId"])} if ObjectId.is_valid(v["userId"]) else {"id": v["userId"]},
                {"fullName": 1, "email": 1},
            )
        except Exception:
            owner = None
        if owner:
            await _notify_owner(
                owner.get("email", ""),
                owner.get("fullName", "User"),
                nominee.get("name", "Nominee") if nominee else "Nominee",
                new_status,
            )

    print(f"[VERIFICATION] {body.action} on {verification_id} by {admin_email} — remarks: {body.remarks}")
    return {"message": f"Verification request {new_status.lower().replace('_', ' ')}."}


# ─────────────────────────────────────────────────────────────────────
# Stateful Emergency Halt & Session Revocation (Phase 6B & 6C)
# ─────────────────────────────────────────────────────────────────────

class HaltClaimPayload(BaseModel):
    token: str
    confirm: bool = True


@router.post("/halt-claim", tags=["Emergency Halt"])
async def stateful_halt_claim(payload: HaltClaimPayload, request: Request):
    """
    Stateful Emergency Halt Endpoint (POST).
    Owner confirms cancellation of death claim.
    1. Transitions vault state to CLAIM_HALTED -> ACTIVE via State Machine engine.
    2. Revokes all active nominee session tokens for this vault.
    3. Writes immutable hash-chain audit log.
    """
    if not payload.token or not payload.confirm:
        raise HTTPException(status_code=400, detail="Confirmation payload and valid token required to halt claim.")

    # Locate workflow or user by halt token
    workflow = await db["verification_workflows"].find_one({"haltToken": payload.token})
    if not workflow:
        workflow = await db["verification_workflows"].find_one({"token": payload.token})

    if not workflow:
        raise HTTPException(status_code=404, detail="Invalid or expired emergency halt token.")

    user_id = workflow.get("userId")
    from app.lib.state_machine import transition_vault_state, VaultState
    
    # Transition to CLAIM_HALTED and then revert to ACTIVE
    await transition_vault_state(user_id, VaultState.CLAIM_HALTED.value, actor_id=f"owner_{user_id}", reason="Emergency Halt Confirmed")
    await transition_vault_state(user_id, VaultState.ACTIVE.value, actor_id=f"owner_{user_id}", reason="Vault Restored to Active")

    # Invalidate token
    await db["verification_workflows"].update_one({"_id": workflow["_id"]}, {"$set": {"haltToken": None, "haltedAt": datetime.now(timezone.utc).isoformat()}})

    # Revoke all active nominee sessions for this vault owner
    nominee_ids = [n["id"] async for n in db["nominees"].find({"userId": user_id})]
    await db["nominee_sessions"].delete_many({"nomineeId": {"$in": nominee_ids}})
    await db["nominees"].update_many({"userId": user_id}, {"$set": {"accessToken": None, "tokenExpiry": None}})

    # Audit log
    from app.lib.audit import write_audit_log
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    await write_audit_log(
        user_id,
        "EMERGENCY_HALT_CONFIRMED",
        "SUCCESS",
        client_ip,
        user_agent,
        {"userId": user_id, "revokedNomineeSessionsCount": len(nominee_ids)}
    )

    return {
        "success": True,
        "message": "Claim successfully halted. All active nominee sessions have been revoked and vault restored to ACTIVE.",
        "vaultState": "ACTIVE"
    }
