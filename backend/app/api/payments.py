"""User-facing Payment API routes — SecureVault.

Endpoints:
  GET  /api/payments/plans          — List all plans (public)
  POST /api/payments/request        — Submit a manual UPI payment request
  GET  /api/payments/my-requests    — List current user's payment requests
  GET  /api/payments/my-subscription — Get active subscription details
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from typing import Optional

from app.core.database import db
from app.core.security import get_current_user
from app.core.plans import get_all_plans, get_plan, PAID_PLANS
from app.lib.payment_provider import get_payment_provider
from app.lib.subscription_service import get_active_subscription, get_user_invoices

router = APIRouter()

users_col = db["users"]
payment_requests_col = db["payment_requests"]


# ------------------------------------------------------------------
# GET /plans — Public plan list
# ------------------------------------------------------------------
@router.get("/plans")
async def list_plans():
    """Return all available plans with server-authoritative pricing."""
    plans = get_all_plans()
    # Strip internal fields, return only what the frontend needs
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "price": p["price"],
            "currency": p["currency"],
            "billingPeriod": p["billing_period"],
            "storageLimit": p["storage_limit"],
            "fileSizeLimit": p["file_size_limit"],
            "nomineeLimit": p["nominee_limit"],
            "assetLimit": p["asset_limit"],
            "features": p["features"],
        }
        for p in plans
    ]


# ------------------------------------------------------------------
# POST /request — Submit a payment request
# ------------------------------------------------------------------
@router.post("/request")
async def submit_payment_request(
    request: Request,
    planId: str = Form(...),
    utrId: str = Form(...),
    screenshot: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Submit a manual UPI payment request for a paid plan.

    - planId: 'pro' or 'premium'
    - utrId: UPI Transaction Reference ID
    - screenshot: Payment screenshot image (max 5MB)

    The server determines the amount from the plan — frontend-supplied
    amount is never used.

    Blocks duplicate PENDING requests for the same user.
    """
    user_id = current_user.get("userId") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    # Validate plan
    if planId not in PAID_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan. Must be 'pro' or 'premium'.")

    # Validate UTR
    utr_clean = utrId.strip()
    if not utr_clean or len(utr_clean) < 4:
        raise HTTPException(status_code=400, detail="Please provide a valid UTR/Transaction ID.")

    # Validate screenshot
    if not screenshot or not screenshot.filename:
        raise HTTPException(status_code=400, detail="Payment screenshot is required.")

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    if screenshot.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Screenshot must be an image (JPEG, PNG, or WebP).",
        )

    # Read and validate size (max 5MB)
    screenshot_data = await screenshot.read()
    if len(screenshot_data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Screenshot must be under 5MB.")

    # Fetch user details for the request record
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    user_email = user.get("email", "") if user else ""
    user_name = user.get("fullName", "") if user else ""

    # Create payment request via provider
    provider = get_payment_provider()
    result = await provider.create_payment_request(
        user_id=user_id,
        plan_id=planId,
        utr_id=utr_clean,
        screenshot_data=screenshot_data,
        screenshot_filename=screenshot.filename,
        screenshot_mime_type=screenshot.content_type,
        user_email=user_email,
        user_name=user_name,
    )

    return {
        "message": "Payment request submitted successfully. "
                   "It will be reviewed by our team.",
        "paymentRequest": result,
    }


# ------------------------------------------------------------------
# GET /my-requests — User's own payment requests
# ------------------------------------------------------------------
@router.get("/my-requests")
async def get_my_payment_requests(
    current_user: dict = Depends(get_current_user),
):
    """List all payment requests for the current user."""
    user_id = current_user.get("userId") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    requests = await payment_requests_col.find(
        {"userId": user_id},
        {"screenshotData": 0},  # Never send binary to frontend
    ).sort("submittedAt", -1).to_list(length=50)

    for r in requests:
        r["_id"] = str(r["_id"])

    return requests


# ------------------------------------------------------------------
# GET /my-subscription — Active subscription details
# ------------------------------------------------------------------
@router.get("/my-subscription")
async def get_my_subscription(
    current_user: dict = Depends(get_current_user),
):
    """Get the current user's active subscription and recent invoices."""
    user_id = current_user.get("userId") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found in token")

    subscription = await get_active_subscription(user_id)
    invoices = await get_user_invoices(user_id, limit=10)

    # Get pending payment request if any
    pending = await payment_requests_col.find_one(
        {"userId": user_id, "status": "PENDING"},
        {"screenshotData": 0},
    )
    if pending:
        pending["_id"] = str(pending["_id"])

    return {
        "subscription": subscription,
        "invoices": invoices,
        "pendingRequest": pending,
    }
