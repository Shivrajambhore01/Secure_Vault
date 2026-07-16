"""
Centralized Notification Service — SecureVault Enterprise

Handles all outbound communications: Email, SMS, and future Push/Webhook.
Every notification is persisted in the 'notification_logs' collection with
full delivery tracking: QUEUED → SENT → DELIVERED / FAILED.

Design:
  1. All notification calls go through this module (never inline SMTP).
  2. Templates are centralized for consistent branding.
  3. Errors are caught and logged — notifications never crash the main flow.

Collections:
  notification_logs — every notification sent, with status tracking
"""

import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from app.core.config import get_settings
from app.core.database import db

logger = logging.getLogger("securevault.notifications")
settings = get_settings()
notif_col = db["notification_logs"]


class NotifChannel(str, Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    PUSH = "PUSH"


class NotifStatus(str, Enum):
    QUEUED = "QUEUED"
    SENT = "SENT"
    FAILED = "FAILED"
    DELIVERED = "DELIVERED"


# ─────────────────────────────────────────────────────────────────────
# Internal Helpers
# ─────────────────────────────────────────────────────────────────────

async def _log_notification(
    channel: NotifChannel,
    recipient: str,
    subject: str,
    template: str,
    status: NotifStatus,
    error: str = "",
    reference_id: str = "",
) -> str:
    notif_id = str(uuid.uuid4())
    await notif_col.insert_one({
        "id": notif_id,
        "channel": channel.value,
        "recipient": recipient,
        "subject": subject,
        "template": template,
        "status": status.value,
        "error": error,
        "referenceId": reference_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    })
    return notif_id


async def _send_email_raw(to: str, subject: str, html: str):
    """Internal SMTP sender using aiosmtplib / Gmail."""
    if not settings.EMAIL_USER or not settings.EMAIL_PASS:
        logger.warning("[DEV] Email suppressed — EMAIL_USER/PASS not configured.")
        logger.debug("[DEV EMAIL] To=%s Subject=%s", to, subject)
        return
    import aiosmtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    msg = MIMEMultipart("alternative")
    msg["From"] = f"SecureVault <{settings.EMAIL_USER}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg["X-Mailer"] = "SecureVault Notification Service"
    msg.attach(MIMEText(html, "html"))

    await aiosmtplib.send(
        msg,
        hostname="smtp.gmail.com",
        port=587,
        start_tls=True,
        username=settings.EMAIL_USER,
        password=settings.EMAIL_PASS,
        timeout=15,
    )


# ─────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────

async def send_email(
    to: str,
    subject: str,
    html: str,
    template: str = "GENERIC",
    reference_id: str = "",
) -> bool:
    """
    Send a transactional email and record delivery status.
    Returns True on success, False on failure.
    """
    notif_id = await _log_notification(
        channel=NotifChannel.EMAIL,
        recipient=to,
        subject=subject,
        template=template,
        status=NotifStatus.QUEUED,
        reference_id=reference_id,
    )
    try:
        await _send_email_raw(to, subject, html)
        await notif_col.update_one(
            {"id": notif_id},
            {"$set": {"status": NotifStatus.SENT.value, "updatedAt": datetime.now(timezone.utc).isoformat()}},
        )
        logger.info("Email SENT to=%s subject=%s", to, subject)
        return True
    except Exception as exc:
        await notif_col.update_one(
            {"id": notif_id},
            {"$set": {
                "status": NotifStatus.FAILED.value,
                "error": str(exc),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }},
        )
        logger.error("Email FAILED to=%s error=%s", to, exc)
        return False


# ─────────────────────────────────────────────────────────────────────
# Email Templates
# ─────────────────────────────────────────────────────────────────────

async def send_otp_email(to: str, otp: str, nominee_name: str = "Nominee"):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">🔐 SecureVault</h1>
        <p style="color:rgba(255,255,255,.8);margin:8px 0 0">Email Verification Code</p>
      </div>
      <div style="padding:32px">
        <p>Hello <strong>{nominee_name}</strong>,</p>
        <p>Your one-time verification code for SecureVault is:</p>
        <div style="background:#1e1b4b;border:2px solid #7c3aed;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#a78bfa;font-family:monospace">{otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:14px">⏰ This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#94a3b8;font-size:12px">If you did not request this code, please ignore this email.</p>
      </div>
    </div>
    """
    await send_email(to, "SecureVault — Email Verification Code", html, template="OTP_EMAIL")


async def send_owner_death_claim_alert(
    owner_email: str,
    nominee_name: str,
    halt_link: str,
    cooling_days: int,
):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">⚠️ SecureVault Security Alert</h1>
        <p style="color:rgba(255,255,255,.8);margin:8px 0 0">A Death Claim Has Been Submitted</p>
      </div>
      <div style="padding:32px">
        <p>A death claim has been filed against your SecureVault account by:</p>
        <div style="background:#1c1917;border:1px solid #78350f;border-radius:8px;padding:16px;margin:16px 0">
          <strong style="color:#fbbf24">{nominee_name}</strong>
        </div>
        <p>Your vault will remain locked for <strong>{cooling_days} days</strong> while we verify this claim.</p>
        <p><strong>If you are alive and did not authorize this claim</strong>, click the button below immediately to cancel it:</p>
        <div style="text-align:center;margin:32px 0">
          <a href="{halt_link}" style="background:#dc2626;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">
            🚫 Cancel This Claim — I Am Alive
          </a>
        </div>
        <p style="color:#94a3b8;font-size:12px">This is a high-priority security alert from SecureVault. Do not ignore it.</p>
      </div>
    </div>
    """
    await send_email(
        owner_email,
        "🚨 URGENT: Death Claim Filed Against Your SecureVault Account",
        html,
        template="OWNER_DEATH_ALERT",
    )


async def send_nominee_access_link(
    nominee_email: str,
    nominee_name: str,
    access_url: str,
):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">🔐 SecureVault</h1>
        <p style="color:rgba(255,255,255,.8);margin:8px 0 0">Inheritance Access Notification</p>
      </div>
      <div style="padding:32px">
        <p>Hello <strong>{nominee_name}</strong>,</p>
        <p>You have been designated as a nominee in a SecureVault digital inheritance. 
           The verification cooling period has elapsed and you are now authorized to begin the verification process.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="{access_url}" style="background:#7c3aed;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">
            Begin Secure Verification →
          </a>
        </div>
        <p style="color:#94a3b8;font-size:12px">This link is unique to you and expires in 10 days. Do not share it with anyone.</p>
      </div>
    </div>
    """
    await send_email(
        nominee_email,
        "SecureVault — You've Been Named as a Digital Heir",
        html,
        template="NOMINEE_ACCESS_LINK",
    )


async def send_claim_approved_email(
    nominee_email: str,
    nominee_name: str,
    vault_url: str,
):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#059669,#047857);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">✅ SecureVault — Claim Approved</h1>
      </div>
      <div style="padding:32px">
        <p>Hello <strong>{nominee_name}</strong>,</p>
        <p>Your inheritance claim has been reviewed and <strong>approved</strong> by our compliance team.</p>
        <p>You may now access the secure vault:</p>
        <div style="text-align:center;margin:32px 0">
          <a href="{vault_url}" style="background:#059669;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700">
            Access Your Vault →
          </a>
        </div>
        <p style="color:#94a3b8;font-size:12px">This session link is temporary and secure. It will expire after use.</p>
      </div>
    </div>
    """
    await send_email(
        nominee_email,
        "✅ SecureVault — Your Inheritance Claim Has Been Approved",
        html,
        template="CLAIM_APPROVED",
    )


async def send_claim_rejected_email(nominee_email: str, nominee_name: str, reason: str):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">❌ SecureVault — Claim Rejected</h1>
      </div>
      <div style="padding:32px">
        <p>Hello <strong>{nominee_name}</strong>,</p>
        <p>After careful review, your inheritance claim has been <strong>rejected</strong>.</p>
        <div style="background:#1c1917;border:1px solid #78350f;border-radius:8px;padding:16px;margin:16px 0">
          <strong>Reason:</strong> {reason}
        </div>
        <p>If you believe this decision is in error, please contact support@securevault.com.</p>
      </div>
    </div>
    """
    await send_email(
        nominee_email,
        "SecureVault — Inheritance Claim Decision",
        html,
        template="CLAIM_REJECTED",
    )


async def send_more_docs_email(nominee_email: str, nominee_name: str, remarks: str, portal_url: str):
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#d97706,#b45309);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">📋 Additional Documents Requested</h1>
      </div>
      <div style="padding:32px">
        <p>Hello <strong>{nominee_name}</strong>,</p>
        <p>Our compliance team requires additional documents to complete your verification:</p>
        <div style="background:#1c1917;border:1px solid #78350f;border-radius:8px;padding:16px;margin:16px 0;color:#fbbf24">
          {remarks}
        </div>
        <div style="text-align:center;margin:32px 0">
          <a href="{portal_url}" style="background:#d97706;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700">
            Upload Documents →
          </a>
        </div>
      </div>
    </div>
    """
    await send_email(
        nominee_email,
        "SecureVault — Additional Documents Required",
        html,
        template="MORE_DOCS_REQUIRED",
    )
