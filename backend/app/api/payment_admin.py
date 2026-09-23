"""Admin Payment Verification API routes — SecureVault.

RBAC Rules:
  - List / Detail / Stats / Screenshot: SUPPORT_ADMIN, SUPER_ADMIN
  - Approve / Reject: SUPPORT_ADMIN ONLY (Super Admin gets 403 Forbidden)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, Body
from typing import Optional
from pydantic import BaseModel, Field

from app.core.database import db
from app.core.admin_security import require_role
from app.lib.encryption import decrypt_bytes
from app.lib.subscription_service import approve_payment, reject_payment

router = APIRouter()

payment_requests_col = db["payment_requests"]
invoices_col = db["invoices"]
subscriptions_col = db["subscriptions"]


class RejectPaymentPayload(BaseModel):
    remark: str = Field(..., min_length=3, description="Reason for rejection")


# ------------------------------------------------------------------
# GET /stats — Payment statistics (Support Admin & Super Admin)
# ------------------------------------------------------------------
@router.get("/stats")
async def get_payment_stats(
    admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    """Get aggregate statistics for payment verification."""
    pending = await payment_requests_col.count_documents({"status": "PENDING"})
    approved = await payment_requests_col.count_documents({"status": "APPROVED"})
    rejected = await payment_requests_col.count_documents({"status": "REJECTED"})
    total = await payment_requests_col.count_documents({})
    
    # Calculate total revenue from approved payments
    pipeline = [
        {"$match": {"status": "APPROVED"}},
        {"$group": {"_id": None, "totalRevenue": {"$sum": "$amount"}}},
    ]
    revenue_cursor = payment_requests_col.aggregate(pipeline)
    revenue_list = await revenue_cursor.to_list(length=1)
    total_revenue = revenue_list[0]["totalRevenue"] if revenue_list else 0

    return {
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "total": total,
        "totalRevenue": total_revenue,
    }


# ------------------------------------------------------------------
# GET / — List payment requests (Support Admin & Super Admin)
# ------------------------------------------------------------------
@router.get("/")
async def list_payment_requests(
    status: Optional[str] = Query(None, description="Filter by status: PENDING, APPROVED, REJECTED"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    """List payment requests with optional status filter and pagination."""
    query = {}
    if status and status.upper() in {"PENDING", "APPROVED", "REJECTED"}:
        query["status"] = status.upper()

    total = await payment_requests_col.count_documents(query)
    requests = (
        await payment_requests_col.find(
            query,
            {"screenshotData": 0},  # Exclude binary data
        )
        .sort("submittedAt", -1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )

    for r in requests:
        r["_id"] = str(r["_id"])

    return {
        "items": requests,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


# ------------------------------------------------------------------
# GET /{request_id} — Payment request detail
# ------------------------------------------------------------------
@router.get("/{request_id}")
async def get_payment_request_detail(
    request_id: str,
    admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    """Get single payment request detail."""
    doc = await payment_requests_col.find_one(
        {"id": request_id},
        {"screenshotData": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Payment request not found.")

    doc["_id"] = str(doc["_id"])

    # If approved, attach invoice
    invoice = await invoices_col.find_one({"paymentRequestId": request_id})
    if invoice:
        invoice["_id"] = str(invoice["_id"])
        doc["invoice"] = invoice

    # Attach subscription if any
    if invoice and invoice.get("subscriptionId"):
        sub = await subscriptions_col.find_one({"id": invoice["subscriptionId"]})
        if sub:
            sub["_id"] = str(sub["_id"])
            doc["subscription"] = sub

    return doc


# ------------------------------------------------------------------
# GET /{request_id}/screenshot — View payment screenshot
# ------------------------------------------------------------------
@router.get("/{request_id}/screenshot")
async def get_payment_screenshot(
    request_id: str,
    admin: dict = Depends(require_role("SUPPORT_ADMIN", "SUPER_ADMIN")),
):
    """Retrieve and decrypt the payment proof screenshot."""
    doc = await payment_requests_col.find_one({"id": request_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Payment request not found.")

    encrypted_data = doc.get("screenshotData")
    if not encrypted_data:
        raise HTTPException(status_code=404, detail="Screenshot data not found.")

    try:
        # Decrypt binary screenshot
        raw_bytes = bytes(encrypted_data)
        decrypted = decrypt_bytes(raw_bytes)
        mime_type = doc.get("screenshotMimeType", "image/jpeg")
        return Response(content=decrypted, media_type=mime_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt screenshot: {str(e)}")


# ------------------------------------------------------------------
# POST /{request_id}/approve — SUPPORT_ADMIN ONLY
# ------------------------------------------------------------------
@router.post("/{request_id}/approve")
async def approve_payment_request(
    request_id: str,
    admin: dict = Depends(require_role("SUPPORT_ADMIN")),
):
    """Approve payment request. Enforced strictly for SUPPORT_ADMIN only."""
    admin_id = admin.get("adminId") or admin.get("id") or "UNKNOWN_ADMIN"
    admin_role = admin.get("role", "SUPPORT_ADMIN")

    result = await approve_payment(
        payment_request_id=request_id,
        admin_id=admin_id,
        admin_role=admin_role,
    )

    return {
        "message": "Payment approved successfully. Subscription activated.",
        "subscription": result,
    }


# ------------------------------------------------------------------
# POST /{request_id}/reject — SUPPORT_ADMIN ONLY
# ------------------------------------------------------------------
@router.post("/{request_id}/reject")
async def reject_payment_request(
    request_id: str,
    payload: RejectPaymentPayload,
    admin: dict = Depends(require_role("SUPPORT_ADMIN")),
):
    """Reject payment request. Enforced strictly for SUPPORT_ADMIN only."""
    admin_id = admin.get("adminId") or admin.get("id") or "UNKNOWN_ADMIN"
    admin_role = admin.get("role", "SUPPORT_ADMIN")

    result = await reject_payment(
        payment_request_id=request_id,
        admin_id=admin_id,
        admin_role=admin_role,
        remark=payload.remark.strip(),
    )

    return {
        "message": "Payment request rejected.",
        "paymentRequest": result,
    }
