"""Background scheduler for re-engagement — port of backend/lib/scheduler.ts."""

import asyncio
import secrets
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings
from app.core.database import db

settings = get_settings()

users_col = db["users"]
nominees_col = db["nominees"]


# ------------------------------------------------------------------
# Email helper (duplicated for independence from route layer)
# ------------------------------------------------------------------
async def _send_email(to: str, subject: str, html: str, from_name: str = ""):
    if settings.EMAIL_USER and settings.EMAIL_PASS:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart("alternative")
        msg["From"] = f'"{from_name}" <{settings.EMAIL_USER}>' if from_name else settings.EMAIL_USER
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
# Twilio Voice Call Helper
# ------------------------------------------------------------------
async def trigger_reengagement_call(user_id: str) -> dict:
    try:
        user = await users_col.find_one({"_id": ObjectId(user_id)})
        if not user or not user.get("phone"):
            print(f"[RE-ENGAGEMENT-V4] Skip Call: User {user_id} has no phone number.")
            return {"skipped": True}

        account_sid = settings.TWILIO_ACCOUNT_SID
        auth_token = settings.TWILIO_AUTH_TOKEN
        flow_sid = settings.TWILIO_FLOW_SID
        from_number = settings.TWILIO_PHONE_NUMBER

        if not all([account_sid, auth_token, flow_sid, from_number]):
            print("[RE-ENGAGEMENT-V4] Skip Call: Missing Twilio config.")
            return {"skipped": True}

        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        print(f"[RE-ENGAGEMENT-V4] Triggering Call to {user['phone']}... (Flow SID: {flow_sid})")

        execution = client.studio.v2.flows(flow_sid).executions.create(
            to=user["phone"], from_=from_number
        )

        print(f"[RE-ENGAGEMENT-V4] Call Triggered Successfully. Execution SID: {execution.sid}")
        await users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"reEngagementCallSent": True}},
        )
        return {"success": True, "sid": execution.sid}
    except Exception as e:
        print(f"[RE-ENGAGEMENT-V4] Twilio Error: {e}")
        return {"success": False}


# ------------------------------------------------------------------
# Notify Nominees
# ------------------------------------------------------------------
async def notify_nominees_for_user(user_id: str):
    print(f"[NOMINEE-NOTIFICATION] Starting notification process for userId: {user_id}")
    try:
        user = await users_col.find_one({"_id": ObjectId(user_id)})
        if not user:
            print(f"[NOMINEE-NOTIFICATION] User not found: {user_id}")
            return

        print(f"[NOMINEE-NOTIFICATION] User: {user['email']}")
        nominees = await nominees_col.find({"userId": user_id}).to_list(length=None)
        print(f"[NOMINEE-NOTIFICATION] Found {len(nominees)} nominee(s) for user {user['email']}")

        if not nominees:
            print("[NOMINEE-NOTIFICATION] No nominees found — marking as notified and skipping.")
            await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"nomineesNotified": True}})
            return

        frontend_url = settings.FRONTEND_URL
        success_count = 0

        for nominee in nominees:
            try:
                print(f"[NOMINEE-NOTIFICATION] Processing nominee: {nominee['name']} <{nominee['email']}>")

                token = secrets.token_hex(32)
                expiry = datetime.now(timezone.utc) + timedelta(days=10)

                await nominees_col.update_one(
                    {"_id": nominee["_id"]},
                    {"$set": {"accessToken": token, "tokenExpiry": expiry.isoformat(), "userName": user["fullName"]}},
                )

                access_url = f"{frontend_url}/nominee/verify/{token}"

                html = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #10b981;">
                    <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 30px 40px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">🔐 SecureVault</h1>
                        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Digital Asset Inheritance Platform</p>
                    </div>
                    <div style="padding: 36px 40px; color: #e2e8f0;">
                        <h2 style="color: #10b981; font-size: 20px; margin-top: 0;">You've Been Granted Secure Access</h2>
                        <p>Hello <strong>{nominee['name']}</strong>,</p>
                        <p>You have been designated as a nominee for <strong>{user['fullName']}</strong>'s digital vault on SecureVault.</p>
                        <div style="background: #1e293b; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
                            <a href="{access_url}" style="display: inline-block; background-color: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Access My Assets →</a>
                        </div>
                        <p style="color: #94a3b8; font-size: 13px;">Link expires on <strong>{expiry.strftime('%a, %d %b %Y %H:%M:%S UTC')}</strong></p>
                    </div>
                </div>
                """

                await _send_email(
                    nominee["email"],
                    f"Secure Access Granted: {user['fullName']}'s Digital Vault",
                    html,
                    from_name="SecureVault",
                )
                print(f"[NOMINEE-NOTIFICATION] ✅ Email sent to: {nominee['email']}")
                success_count += 1

            except Exception as e:
                print(f"[NOMINEE-NOTIFICATION] ❌ Failed to notify nominee {nominee['email']}: {e}")

        await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"nomineesNotified": True}})
        print(f"[NOMINEE-NOTIFICATION] Done. {success_count}/{len(nominees)} nominees notified for user {user['email']}")

    except Exception as e:
        print(f"[NOMINEE-NOTIFICATION] ❌ Critical error in notify_nominees_for_user({user_id}): {e}")


# ------------------------------------------------------------------
# Core Re-Engagement Logic (V4)
# ------------------------------------------------------------------
async def process_reengagement_for_user(user_id: str):
    user = await users_col.find_one({"_id": ObjectId(user_id)})

    if not user or not user.get("logoutTime"):
        return

    test_mode = settings.INACTIVITY_TEST_MODE
    now = datetime.now(timezone.utc).timestamp() * 1000  # ms
    logout_time = datetime.fromisoformat(user["logoutTime"].replace("Z", "+00:00")).timestamp() * 1000
    elapsed = now - logout_time

    # Configuration (ms)
    WAIT_PERIOD = (1 * 60 * 1000) if test_mode else (6 * 30 * 24 * 60 * 60 * 1000)
    DURATION = (3 * 60 * 1000) if test_mode else (2 * 30 * 24 * 60 * 60 * 1000)
    GAP = (1 * 60 * 1000) if test_mode else (10 * 24 * 60 * 60 * 1000)

    # STEP 1: INITIAL CALL
    if elapsed >= WAIT_PERIOD and not user.get("reEngagementCallSent"):
        print(f"[RE-ENGAGEMENT-V4] Triggering re-engagement call for {user['email']}")
        await trigger_reengagement_call(user_id)

    # STEP 2: REMINDER EMAILS
    if elapsed >= WAIT_PERIOD and elapsed < (WAIT_PERIOD + DURATION):
        last_sent = (
            datetime.fromisoformat(user["reEngagementLastMessageAt"].replace("Z", "+00:00")).timestamp() * 1000
            if user.get("reEngagementLastMessageAt")
            else 0
        )

        if now - last_sent >= GAP:
            print(f"[RE-ENGAGEMENT-V4] Sending reminder message to {user['email']}...")

            html = f"""
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #3b82f6;">We miss you at SecureVault!</h2>
                <p>Hello {user['fullName']},</p>
                <p>It's been a while since you last logged in. We wanted to reach out and make sure your vault assets are still secure.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3000/login" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Log In to SecureVault</a>
                </div>
            </div>
            """

            try:
                await _send_email(user["email"], "SecureVault: Re-Engagement Reminder", html)
                print(f"[RE-ENGAGEMENT-V4] Reminder email sent to {user['email']}")
            except Exception as e:
                print(f"[RE-ENGAGEMENT-V4] Failed to send reminder: {e}")

            await users_col.update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$inc": {"reEngagementMessagesSent": 1},
                    "$set": {"reEngagementLastMessageAt": datetime.now(timezone.utc).isoformat()},
                },
            )

    elif elapsed >= (WAIT_PERIOD + DURATION):
        print(f"[RE-ENGAGEMENT-V4] Re-engagement cycle COMPLETED for {user['email']}.")

        # STEP 3: NOTIFY NOMINEES
        if not user.get("nomineesNotified"):
            await notify_nominees_for_user(user_id)
    else:
        remaining_s = (WAIT_PERIOD - elapsed) / 1000
        print(f"[RE-ENGAGEMENT-V4] User {user['email']} still in WAIT_PERIOD. {remaining_s:.2f}s remaining.")


# ------------------------------------------------------------------
# Scheduler Job
# ------------------------------------------------------------------
async def _run_inactivity_check():
    try:
        inactive_users = await users_col.find({"logoutTime": {"$ne": None}}).to_list(length=None)
        print(f"[RE-ENGAGEMENT-V4] Found {len(inactive_users)} logged-out users to process.")

        tasks = [process_reengagement_for_user(str(u["_id"])) for u in inactive_users]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"[RE-ENGAGEMENT-V4] Error for user: {result}")

        if inactive_users:
            print(f"[RE-ENGAGEMENT-V4] Finished processing batch of {len(inactive_users)} users.")
    except Exception as e:
        print(f"[RE-ENGAGEMENT-V4] Global Error: {e}")


def start_inactivity_scheduler():
    """Start the APScheduler cron job — runs every minute."""
    test_mode = settings.INACTIVITY_TEST_MODE
    print(f"[RE-ENGAGEMENT-V4] Scheduler Starting. Mode: {'TEST' if test_mode else 'PROD'}")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(_run_inactivity_check, "interval", seconds=60)
    scheduler.start()
    return scheduler
