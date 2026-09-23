"""Subscription Service — SecureVault.

Provider-agnostic subscription lifecycle management.
Handles approval, rejection, expiry, and mid-cycle upgrades.

The Subscription/Invoice/Audit logic does NOT depend on which provider
verified the payment — only PaymentRequest creation/verification is
provider-specific.
"""

import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException

from app.core.database import db
from app.core.plans import get_plan, SUBSCRIPTION_DURATION_DAYS, PAID_PLANS
from app.core.config import get_settings

logger = logging.getLogger("securevault.subscription")
settings = get_settings()

# Collections
users_col = db["users"]
subscriptions_col = db["subscriptions"]
payment_requests_col = db["payment_requests"]
invoices_col = db["invoices"]
billing_audit_col = db["billing_audit_logs"]


# ------------------------------------------------------------------
# Email helper
# ------------------------------------------------------------------

async def _send_email(to: str, subject: str, html: str):
    """Send an email via Gmail SMTP. Falls back to console log in dev."""
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


# ------------------------------------------------------------------
# Approve Payment
# ------------------------------------------------------------------

async def approve_payment(
    payment_request_id: str,
    admin_id: str,
    admin_role: str,
) -> dict:
    """Approve a payment request and create/replace the active subscription.

    In one logical transaction:
    1. Validate the payment request is PENDING
    2. Mark it APPROVED
    3. Supersede any existing ACTIVE subscription for the user
    4. Create a new ACTIVE subscription (now → now + 30 days)
    5. Update the user's plan and storageLimit
    6. Generate an Invoice
    7. Write a BillingAuditLog entry
    8. Send approval notification email to user

    Returns the created subscription document.
    """
    # 1. Fetch and validate
    pay_req = await payment_requests_col.find_one({"id": payment_request_id})
    if not pay_req:
        raise HTTPException(status_code=404, detail="Payment request not found.")
    if pay_req["status"] != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Payment request is already {pay_req['status']}. Cannot approve.",
        )

    user_id = pay_req["userId"]
    plan_id = pay_req["planId"]
    plan = get_plan(plan_id)
    amount = plan["price"]  # Server-determined amount
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Fetch user to get before-state
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    before_plan = user.get("plan", "free")

    # 2. Mark payment request APPROVED
    await payment_requests_col.update_one(
        {"id": payment_request_id},
        {"$set": {
            "status": "APPROVED",
            "reviewedBy": admin_id,
            "reviewedByRole": admin_role,
            "reviewedAt": now_iso,
        }},
    )

    # 3. Supersede any existing ACTIVE subscription
    subscription_id = str(uuid.uuid4())
    existing_active = await subscriptions_col.find_one({
        "userId": user_id,
        "status": "ACTIVE",
    })
    if existing_active:
        await subscriptions_col.update_one(
            {"id": existing_active["id"]},
            {"$set": {
                "status": "SUPERSEDED",
                "supersededBy": subscription_id,
                "supersededAt": now_iso,
            }},
        )
        # Log the supersession
        await billing_audit_col.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "SUBSCRIPTION_SUPERSEDED",
            "actorId": admin_id,
            "actorRole": admin_role,
            "details": {
                "oldSubscriptionId": existing_active["id"],
                "oldPlanId": existing_active["planId"],
                "newSubscriptionId": subscription_id,
                "newPlanId": plan_id,
                "reason": "Mid-cycle upgrade approved",
            },
            "createdAt": now_iso,
        })

    # 4. Create new subscription
    end_date = now + timedelta(days=SUBSCRIPTION_DURATION_DAYS)
    subscription_doc = {
        "id": subscription_id,
        "userId": user_id,
        "planId": plan_id,
        "status": "ACTIVE",
        "startDate": now_iso,
        "endDate": end_date.isoformat(),
        "createdAt": now_iso,
        "supersededBy": None,
        "paymentRequestId": payment_request_id,
    }
    await subscriptions_col.insert_one(subscription_doc)

    # 5. Update user's plan and storage limit
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "plan": plan_id,
            "storageLimit": plan["storage_limit"],
        }},
    )

    # 6. Generate invoice
    invoice_id = str(uuid.uuid4())
    invoice_doc = {
        "id": invoice_id,
        "paymentRequestId": payment_request_id,
        "subscriptionId": subscription_id,
        "userId": user_id,
        "planId": plan_id,
        "planName": plan["name"],
        "amount": amount,
        "currency": "INR",
        "issuedAt": now_iso,
    }
    await invoices_col.insert_one(invoice_doc)

    # 7. Write billing audit log
    await billing_audit_col.insert_one({
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "action": "PAYMENT_APPROVED",
        "actorId": admin_id,
        "actorRole": admin_role,
        "details": {
            "paymentRequestId": payment_request_id,
            "subscriptionId": subscription_id,
            "invoiceId": invoice_id,
            "planId": plan_id,
            "amount": amount,
            "beforePlan": before_plan,
            "afterPlan": plan_id,
        },
        "createdAt": now_iso,
    })

    # 8. Send approval email
    user_email = pay_req.get("userEmail", user.get("email", ""))
    user_name = pay_req.get("userName", user.get("fullName", "User"))
    if user_email:
        try:
            html = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #10b981;">✅ Payment Approved — SecureVault</h2>
                <p>Hello {user_name},</p>
                <p>Your payment for the <strong>{plan['name']}</strong> plan has been approved!</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Plan</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">{plan['name']}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Amount</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">₹{amount}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Invoice ID</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{invoice_id[:8]}...</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Valid Until</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">{end_date.strftime('%B %d, %Y')}</td></tr>
                </table>
                <p>Enjoy your upgraded vault! Your new storage limit and features are now active.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="font-size: 12px; color: #64748b;">SecureVault — Protecting Your Digital Legacy</p>
            </div>
            """
            await _send_email(user_email, f"Payment Approved — {plan['name']} Plan Activated", html)
        except Exception as e:
            logger.error("Failed to send approval email to %s: %s", user_email, e)

    logger.info(
        "[SUBSCRIPTION] Payment %s approved by %s (%s). User %s upgraded to %s.",
        payment_request_id, admin_id, admin_role, user_id, plan_id,
    )

    subscription_doc["_id"] = str(subscription_doc.get("_id", ""))
    return subscription_doc


# ------------------------------------------------------------------
# Reject Payment
# ------------------------------------------------------------------

async def reject_payment(
    payment_request_id: str,
    admin_id: str,
    admin_role: str,
    remark: str,
) -> dict:
    """Reject a payment request. User's plan remains unchanged.

    1. Mark the payment request as REJECTED with admin remark
    2. Write BillingAuditLog entry
    3. Send rejection notification email to user
    """
    pay_req = await payment_requests_col.find_one({"id": payment_request_id})
    if not pay_req:
        raise HTTPException(status_code=404, detail="Payment request not found.")
    if pay_req["status"] != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Payment request is already {pay_req['status']}. Cannot reject.",
        )

    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Mark REJECTED
    await payment_requests_col.update_one(
        {"id": payment_request_id},
        {"$set": {
            "status": "REJECTED",
            "adminRemark": remark,
            "reviewedBy": admin_id,
            "reviewedByRole": admin_role,
            "reviewedAt": now_iso,
        }},
    )

    # 2. Write billing audit log
    await billing_audit_col.insert_one({
        "id": str(uuid.uuid4()),
        "userId": pay_req["userId"],
        "action": "PAYMENT_REJECTED",
        "actorId": admin_id,
        "actorRole": admin_role,
        "details": {
            "paymentRequestId": payment_request_id,
            "planId": pay_req["planId"],
            "amount": pay_req["amount"],
            "remark": remark,
        },
        "createdAt": now_iso,
    })

    # 3. Send rejection email
    user_email = pay_req.get("userEmail", "")
    user_name = pay_req.get("userName", "User")
    plan = get_plan(pay_req["planId"])

    if user_email:
        try:
            html = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #ef4444;">❌ Payment Request Declined — SecureVault</h2>
                <p>Hello {user_name},</p>
                <p>Your payment request for the <strong>{plan['name']}</strong> plan (₹{pay_req['amount']}) has been declined.</p>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <strong>Reason:</strong> {remark}
                </div>
                <p>You can submit a new payment request from your dashboard. If you believe this was an error, please contact support.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="font-size: 12px; color: #64748b;">SecureVault — Protecting Your Digital Legacy</p>
            </div>
            """
            await _send_email(user_email, "Payment Request Declined — SecureVault", html)
        except Exception as e:
            logger.error("Failed to send rejection email to %s: %s", user_email, e)

    logger.info(
        "[SUBSCRIPTION] Payment %s rejected by %s (%s). Remark: %s",
        payment_request_id, admin_id, admin_role, remark,
    )

    pay_req["_id"] = str(pay_req.get("_id", ""))
    pay_req["status"] = "REJECTED"
    pay_req["adminRemark"] = remark
    return pay_req


# ------------------------------------------------------------------
# Expire Subscriptions (called by daily cron)
# ------------------------------------------------------------------

async def expire_subscriptions() -> int:
    """Find and expire all ACTIVE subscriptions past their end date.

    For each expired subscription:
    1. Mark subscription EXPIRED
    2. Set user back to free plan (storageLimit = 50MB)
    3. Do NOT delete any files/assets/nominees
    4. Log the downgrade to BillingAuditLog (actor = SYSTEM)

    Returns the number of subscriptions expired.
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Find all expired active subscriptions
    expired_subs = await subscriptions_col.find({
        "status": "ACTIVE",
        "endDate": {"$lt": now_iso},
    }).to_list(length=None)

    if not expired_subs:
        return 0

    free_plan = get_plan("free")
    count = 0

    for sub in expired_subs:
        user_id = sub["userId"]

        # 1. Mark subscription EXPIRED
        await subscriptions_col.update_one(
            {"id": sub["id"]},
            {"$set": {"status": "EXPIRED"}},
        )

        # 2. Downgrade user to free plan
        # Only downgrade if they don't have another ACTIVE subscription
        other_active = await subscriptions_col.find_one({
            "userId": user_id,
            "status": "ACTIVE",
            "id": {"$ne": sub["id"]},
        })

        if not other_active:
            await users_col.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "plan": "free",
                    "storageLimit": free_plan["storage_limit"],
                }},
            )

        # 3. Write billing audit log
        await billing_audit_col.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "SUBSCRIPTION_EXPIRED",
            "actorId": "SYSTEM",
            "actorRole": "SYSTEM",
            "details": {
                "subscriptionId": sub["id"],
                "planId": sub["planId"],
                "expiredAt": now_iso,
                "beforePlan": sub["planId"],
                "afterPlan": "free" if not other_active else sub["planId"],
            },
            "createdAt": now_iso,
        })

        count += 1
        logger.info(
            "[SUBSCRIPTION-EXPIRY] Subscription %s expired for user %s. Plan: %s → free.",
            sub["id"], user_id, sub["planId"],
        )

    return count


# ------------------------------------------------------------------
# Query helpers
# ------------------------------------------------------------------

async def get_active_subscription(user_id: str) -> Optional[dict]:
    """Get the user's active subscription, if any."""
    sub = await subscriptions_col.find_one({
        "userId": user_id,
        "status": "ACTIVE",
    })
    if sub:
        sub["_id"] = str(sub["_id"])
    return sub


async def get_user_invoices(user_id: str, limit: int = 20) -> list[dict]:
    """Get the user's invoices, newest first."""
    invoices = await invoices_col.find(
        {"userId": user_id},
    ).sort("issuedAt", -1).limit(limit).to_list(length=limit)
    for inv in invoices:
        inv["_id"] = str(inv["_id"])
    return invoices
