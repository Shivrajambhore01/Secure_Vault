"""
Multi-Admin Dual Approval Workflow — SecureVault Enterprise

For HIGH or CRITICAL risk verification requests (riskScore >= 51),
a single admin's approval is insufficient.

Dual approval requirement:
  - A second, DIFFERENT admin must independently confirm the approval.
  - The second approver cannot be the same person who initially claimed the request.
  - Both approvals must be recorded within 72 hours of each other.

State machine addition:
  PENDING_REVIEW → CLAIMED (Admin A reviews and recommends approval)
                 → PENDING_SECOND_APPROVAL (Admin A issues first approval)
                 → APPROVED (Admin B issues second approval)

Collections:
  verification_approvals — records individual admin approval votes
"""

import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.database import db
from app.core.admin_security import require_role
from app.lib.audit import audit_admin_decision
from app.lib.rbac import Permission, assert_permission

logger = logging.getLogger("securevault.dual_approval")
router = APIRouter()

ALLOWED_ROLES = ("SUPER_ADMIN",)

# Risk score threshold requiring dual approval
DUAL_APPROVAL_THRESHOLD = 51


class FirstApprovalRequest(BaseModel):
    remarks: str = ""


class SecondApprovalRequest(BaseModel):
    decision: str  # APPROVE | REJECT
    remarks: str = ""


async def _write_status_history(request_id: str, old: str, new: str, by: str, remarks: str = ""):
    await status_history_col.insert_one({
        "id": str(uuid.uuid4()),
        "requestId": request_id,
        "oldStatus": old,
        "newStatus": new,
        "changedBy": by,
        "changedAt": datetime.now(timezone.utc).isoformat(),
        "remarks": remarks,
    })


# ─────────────────────────────────────────────────────────────────────
# Route 1: Admin A — Issue First Approval Recommendation
# ─────────────────────────────────────────────────────────────────────

@router.post("/requests/{request_id}/first-approval", tags=["Dual Approval"])
async def issue_first_approval(
    request_id: str,
    body: FirstApprovalRequest,
    request: Request,
    admin=Depends(require_role(*ALLOWED_ROLES)),
):
    """
    Admin A recommends approval for a HIGH/CRITICAL risk request.
    Advances status to PENDING_SECOND_APPROVAL.
    A different admin must then issue the second approval.
    """
    req = await requests_col.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Verification request not found.")

    risk_score = req.get("riskScore", 0)
    if risk_score < DUAL_APPROVAL_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail=f"Dual approval is not required for this request (risk score: {risk_score}). Use the standard review endpoint.",
        )

    if req.get("status") not in ("PENDING_REVIEW", "CLAIMED", "UNDER_REVIEW"):
        raise HTTPException(
            status_code=400,
            detail=f"Request is not in a reviewable state (current: {req.get('status')}).",
        )

    admin_id = admin.get("adminId") or admin.get("id") or "unknown"

    # Record the first approval vote
    await approvals_col.insert_one({
        "id": str(uuid.uuid4()),
        "requestId": request_id,
        "approvalRound": 1,
        "adminId": admin_id,
        "adminEmail": admin.get("email", ""),
        "decision": "APPROVE",
        "remarks": body.remarks,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat(),
    })

    old_status = req["status"]
    new_status = "PENDING_SECOND_APPROVAL"

    await requests_col.update_one(
        {"id": request_id},
        {"$set": {
            "status": new_status,
            "firstApprovalBy": admin_id,
            "firstApprovalAt": datetime.now(timezone.utc).isoformat(),
            "firstApprovalRemarks": body.remarks,
        }},
    )

    await _write_status_history(request_id, old_status, new_status, admin_id, body.remarks)
    await audit_admin_decision(admin_id, request_id, "FIRST_APPROVAL", body.remarks, request)

    logger.info(
        "First approval issued: request=%s by admin=%s risk_score=%d",
        request_id, admin_id, risk_score,
    )

    return {
        "success": True,
        "message": "First approval recorded. A second admin must now review and confirm.",
        "status": new_status,
        "expiresInHours": 72,
    }


# ─────────────────────────────────────────────────────────────────────
# Route 2: Admin B — Issue Second Approval (or Reject)
# ─────────────────────────────────────────────────────────────────────

@router.post("/requests/{request_id}/second-approval", tags=["Dual Approval"])
async def issue_second_approval(
    request_id: str,
    body: SecondApprovalRequest,
    request: Request,
    admin=Depends(require_role(*ALLOWED_ROLES)),
):
    """
    Admin B independently reviews and approves or rejects the request.
    The second approver CANNOT be the same admin who issued the first approval.
    """
    if body.decision not in ("APPROVE", "REJECT"):
        raise HTTPException(status_code=400, detail="Decision must be APPROVE or REJECT.")

    req = await requests_col.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Verification request not found.")

    if req.get("status") != "PENDING_SECOND_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"Request is not awaiting second approval (current: {req.get('status')}).",
        )

    admin_id = admin.get("adminId") or admin.get("id") or "unknown"

    # Prevent same admin from issuing both approvals
    first_approver_id = req.get("firstApprovalBy")
    if admin_id == first_approver_id:
        raise HTTPException(
            status_code=403,
            detail="The second approval must be issued by a different administrator. You cannot approve your own first approval.",
        )

    # Check that first approval hasn't expired (72h window)
    first_approval_at_str = req.get("firstApprovalAt")
    if first_approval_at_str:
        first_approval_at = datetime.fromisoformat(first_approval_at_str.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - first_approval_at > timedelta(hours=72):
            await requests_col.update_one(
                {"id": request_id},
                {"$set": {"status": "PENDING_REVIEW", "firstApprovalBy": None, "firstApprovalAt": None}},
            )
            raise HTTPException(
                status_code=400,
                detail="The first approval has expired (72-hour window). The request has been returned to PENDING_REVIEW.",
            )

    now = datetime.now(timezone.utc).isoformat()
    new_status = "APPROVED" if body.decision == "APPROVE" else "REJECTED"

    # Record the second approval vote
    await approvals_col.insert_one({
        "id": str(uuid.uuid4()),
        "requestId": request_id,
        "approvalRound": 2,
        "adminId": admin_id,
        "adminEmail": admin.get("email", ""),
        "decision": body.decision,
        "remarks": body.remarks,
        "timestamp": now,
    })

    update_fields = {
        "status": new_status,
        "secondApprovalBy": admin_id,
        "secondApprovalAt": now,
        "secondApprovalRemarks": body.remarks,
        "reviewedBy": admin_id,
        "reviewedAt": now,
    }

    await requests_col.update_one({"id": request_id}, {"$set": update_fields})
    await _write_status_history(request_id, "PENDING_SECOND_APPROVAL", new_status, admin_id, body.remarks)
    await audit_admin_decision(admin_id, request_id, f"SECOND_APPROVAL_{body.decision}", body.remarks, request)

    logger.info(
        "Second approval issued: request=%s by admin=%s decision=%s",
        request_id, admin_id, body.decision,
    )

    return {
        "success": True,
        "message": f"Request has been {new_status.lower()}.",
        "status": new_status,
        "approvedBy": [first_approver_id, admin_id],
    }


# ─────────────────────────────────────────────────────────────────────
# Route 3: Get Approval History for a Request
# ─────────────────────────────────────────────────────────────────────

@router.get("/requests/{request_id}/approvals", tags=["Dual Approval"])
async def get_approval_history(
    request_id: str,
    admin=Depends(require_role(*ALLOWED_ROLES)),
):
    """Return the full approval vote trail for a verification request."""
    votes = await approvals_col.find(
        {"requestId": request_id},
        {"_id": 0},
        sort=[("timestamp", 1)],
    ).to_list(length=None)

    return {"requestId": request_id, "approvals": votes, "count": len(votes)}
