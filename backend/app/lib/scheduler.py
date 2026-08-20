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
async def _send_email(to: str, subject: str, html: str, from_name: str = "SecureVault"):
    if settings.EMAIL_USER and settings.EMAIL_PASS:
        import aiosmtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        sender_name = from_name or "SecureVault"
        sender_header = f"{sender_name} <{settings.EMAIL_USER}>"

        msg = MIMEMultipart("alternative")
        msg["From"] = sender_header
        msg["To"] = to
        msg["Subject"] = subject
        msg["X-Mailer"] = "SecureVault Notification Service"
        msg.attach(MIMEText(html, "html"))

        try:
            await aiosmtplib.send(
                msg,
                hostname="smtp.gmail.com",
                port=587,
                start_tls=True,
                username=settings.EMAIL_USER,
                password=settings.EMAIL_PASS,
                timeout=15,
            )
            print(f"[EMAIL-DELIVERY] [OK] Successfully delivered email to {to}: {subject}")
            
            # Log to notification_logs collection
            notif_col = db["notification_logs"]
            await notif_col.insert_one({
                "channel": "EMAIL",
                "recipient": to,
                "subject": subject,
                "status": "SENT",
                "createdAt": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as err:
            print(f"[EMAIL-DELIVERY] [ERROR] SMTP Send failed to {to}: {err}")
            raise err
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
            await users_col.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"reEngagementCallSent": True}},
            )
            return {"skipped": True}

        account_sid = settings.TWILIO_ACCOUNT_SID
        auth_token = settings.TWILIO_AUTH_TOKEN
        flow_sid = settings.TWILIO_FLOW_SID
        from_number = settings.TWILIO_PHONE_NUMBER

        if not all([account_sid, auth_token, flow_sid, from_number]):
            print("[RE-ENGAGEMENT-V4] Skip Call: Missing Twilio config.")
            await users_col.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"reEngagementCallSent": True}},
            )
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
        # Still set to True to allow the test state machine to advance
        await users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"reEngagementCallSent": True}},
        )
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
        user_email = user.get("email", "").strip().lower()
        
        # Support both string and ObjectId userId in nominees collection
        nominees = await nominees_col.find({
            "$or": [{"userId": user_id}, {"userId": ObjectId(user_id)}]
        }).to_list(length=None)
        print(f"[NOMINEE-NOTIFICATION] Found {len(nominees)} nominee(s) for user {user['email']}")

        if not nominees:
            print("[NOMINEE-NOTIFICATION] No nominees found — marking as notified and skipping.")
            await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"nomineesNotified": True}})
            return

        frontend_url = settings.FRONTEND_URL
        success_count = 0

        for nominee in nominees:
            try:
                nominee_email = nominee.get("email", "").strip().lower()
                if nominee_email == user_email:
                    print(f"[NOMINEE-NOTIFICATION] Skipping user's own email ({user_email}) listed as nominee.")
                    continue

                print(f"[NOMINEE-NOTIFICATION] Processing nominee: {nominee['name']} <{nominee['email']}>")

                token = secrets.token_hex(32)
                expiry = datetime.now(timezone.utc) + timedelta(days=10)

                await nominees_col.update_one(
                    {"_id": nominee["_id"]},
                    {"$set": {"accessToken": token, "tokenExpiry": expiry.isoformat(), "userName": user["fullName"]}},
                )

                access_url = f"{frontend_url}/nominee/verify/{token}"
                print("\n" + "=" * 75)
                print(f"[NOMINEE-TRANSFER-LINK] Nominee Access Link for {nominee['email']}:")
                print(f"👉 {access_url}")
                print("=" * 75 + "\n")

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
                print(f"[NOMINEE-NOTIFICATION] [OK] Email delivered to nominee: {nominee['email']}")
                success_count += 1

            except Exception as e:
                print(f"[NOMINEE-NOTIFICATION] [ERROR] Failed to notify nominee {nominee['email']}: {e}")

        await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"nomineesNotified": True}})
        print(f"[NOMINEE-NOTIFICATION] Done. {success_count}/{len(nominees)} nominees notified for user {user['email']}")

    except Exception as e:
        print(f"[NOMINEE-NOTIFICATION] [ERROR] Critical error in notify_nominees_for_user({user_id}): {e}")


# ------------------------------------------------------------------
# Core Re-Engagement Logic (V4)
# ------------------------------------------------------------------
async def process_reengagement_for_user(user_id: str):
    user = await users_col.find_one({"_id": ObjectId(user_id)})

    if not user:
        return

    # Skip if nominees have already been notified (cycle complete)
    if user.get("nomineesNotified"):
        return

    # Skip if user has re-logged in (logoutTime cleared on login)
    logout_time_str = user.get("logoutTime")
    if not logout_time_str:
        print(f"[RE-ENGAGEMENT-V4] Skipping {user.get('email')} — user is currently logged in (no logoutTime).")
        return

    test_mode = settings.INACTIVITY_TEST_MODE
    user_inactivity_period = float(user.get("inactivityPeriod", 6))
    is_user_test = test_mode or (user_inactivity_period < 1)

    now = datetime.now(timezone.utc).timestamp() * 1000  # ms

    # Measure elapsed time from logoutTime (not lastActive)
    # This ensures heartbeat or other updates don't reset the countdown
    logout_time = datetime.fromisoformat(logout_time_str.replace("Z", "+00:00")).timestamp() * 1000
    elapsed = now - logout_time

    if is_user_test:
        # TEST WORKFLOW
        messages_sent = user.get("reEngagementMessagesSent", 0)

        if user_inactivity_period < 1:
            # 2-MINUTE TEST WORKFLOW (When user selects 2 Minutes option)
            # 1. Send warning emails at 30s and 60s
            if messages_sent < 2:
                target_elapsed = (messages_sent + 1) * 30 * 1000
                if elapsed >= target_elapsed:
                    print(f"[RE-ENGAGEMENT-V4][2-MIN-TEST] Sending email {messages_sent + 1} to {user['email']} (elapsed: {elapsed / 1000:.1f}s)...")

                    frontend_url = settings.FRONTEND_URL
                    html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
                        <div style="text-align: center; margin-bottom: 24px;">
                            <span style="font-size: 28px; font-weight: bold; color: #3b82f6;">🔒 SecureVault</span>
                        </div>
                        <h2 style="color: #0f172a; font-size: 20px; margin-top: 0; text-align: center;">Inactivity Alert (2-Minute Test Mode)</h2>
                        <p>Dear {user.get('fullName', 'User')},</p>
                        <p>We noticed you have been logged out due to inactivity. To ensure the continuous security and preservation of your vault assets, please log back into your account.</p>
                        <p>Your vault inactivity standby limit is set to <strong>2 Minutes (Test Mode)</strong>. If you do not log in within 2 minutes of logout, nominee notification procedures will trigger automatically.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{frontend_url}/login" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">Log In to SecureVault</a>
                        </div>
                    </div>
                    """

                    try:
                        await _send_email(user.get("email", ""), "SecureVault: Inactivity Security Alert (2-Min Test)", html)
                        print(f"[RE-ENGAGEMENT-V4][2-MIN-TEST] Email sent to {user.get('email')}")

                        await users_col.update_one(
                            {"_id": ObjectId(user_id)},
                            {
                                "$inc": {"reEngagementMessagesSent": 1},
                                "$set": {"reEngagementLastMessageAt": datetime.now(timezone.utc).isoformat()},
                            },
                        )
                        messages_sent += 1
                    except Exception as e:
                        print(f"[RE-ENGAGEMENT-V4][2-MIN-TEST] Failed to send reminder email: {e}")

            # 2. Trigger Nominee Access at 2 minutes (120,000 ms)
            if elapsed >= 120 * 1000 and not user.get("nomineesNotified"):
                print(f"[RE-ENGAGEMENT-V4][2-MIN-TEST] 2 Minutes elapsed for {user['email']}. Notifying nominees now...")
                await notify_nominees_for_user(user_id)

            print(f"[RE-ENGAGEMENT-V4][2-MIN-TEST] Status for {user['email']}: elapsed={elapsed/1000:.1f}s, sent_msgs={messages_sent}, nominees_notified={user.get('nomineesNotified')}")

        else:
            # 5-MINUTE GENERAL TEST WORKFLOW
            # Notifications at 1, 2, and 3 minutes of inactivity.
            # Twilio call triggered at 4 minutes of inactivity.
            # Nominee access triggered at 5 minutes of inactivity.
            if messages_sent < 3:
                target_elapsed = (messages_sent + 1) * 1 * 60 * 1000
                if elapsed >= target_elapsed:
                    print(f"[RE-ENGAGEMENT-V4][TEST] Sending reminder message {messages_sent + 1} to {user['email']} (elapsed: {elapsed / 1000}s)...")

                    frontend_url = settings.FRONTEND_URL
                    html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
                        <div style="text-align: center; margin-bottom: 24px;">
                            <span style="font-size: 28px; font-weight: bold; color: #3b82f6;">🔒 SecureVault</span>
                        </div>
                        <h2 style="color: #0f172a; font-size: 20px; margin-top: 0; text-align: center;">Inactivity Alert</h2>
                        <p>Dear {user.get('fullName', 'User')},</p>
                        <p>We noticed you have been logged out due to inactivity. To ensure the continuous security and preservation of your vault assets, please log back into your account.</p>
                        <p>If you do not log in within the verification window, our automated protocols will begin designated nominee notification procedures.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{frontend_url}/login" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);">Log In to SecureVault</a>
                        </div>
                        <p style="font-size: 13px; color: #64748b; text-align: center; line-height: 1.5; margin-top: 24px;">
                            If you did not request this or have questions, please contact support immediately.
                        </p>
                    </div>
                    """

                    try:
                        await _send_email(user.get("email", ""), "SecureVault: Inactivity Security Alert", html)
                        print(f"[RE-ENGAGEMENT-V4][TEST] Reminder email sent to {user.get('email')}")

                        await users_col.update_one(
                            {"_id": ObjectId(user_id)},
                            {
                                "$inc": {"reEngagementMessagesSent": 1},
                                "$set": {"reEngagementLastMessageAt": datetime.now(timezone.utc).isoformat()},
                            },
                        )
                        messages_sent += 1
                    except Exception as e:
                        print(f"[RE-ENGAGEMENT-V4][TEST] Failed to send reminder: {e}")

            # 2. Trigger automated phone call at 4 minutes (after 3rd notification sent)
            if elapsed >= 4 * 60 * 1000 and messages_sent >= 3 and not user.get("reEngagementCallSent"):
                print(f"[RE-ENGAGEMENT-V4][TEST] Triggering re-engagement call for {user['email']} (elapsed: {elapsed / 1000}s)")
                await trigger_reengagement_call(user_id)

            # 3. Trigger Nominee Access at 5 minutes (after 4 mins call + 1 min verification period)
            if elapsed >= 5 * 60 * 1000 and user.get("reEngagementCallSent") and not user.get("nomineesNotified"):
                print(f"[RE-ENGAGEMENT-V4][TEST] Re-engagement cycle COMPLETED for {user['email']}. Notifying nominees...")
                await notify_nominees_for_user(user_id)

            # Print debug status for verification
            print(f"[RE-ENGAGEMENT-V4][TEST] Status for {user['email']}: elapsed={elapsed/1000:.1f}s, sent_msgs={messages_sent}, call_sent={user.get('reEngagementCallSent')}, nominees_notified={user.get('nomineesNotified')}")

    else:
        # PRODUCTION WORKFLOW
        user_inactivity_months = user.get("inactivityPeriod", 6)
        WAIT_PERIOD = user_inactivity_months * 30 * 24 * 60 * 60 * 1000
        DURATION = 2 * 30 * 24 * 60 * 60 * 1000
        GAP = 10 * 24 * 60 * 60 * 1000

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

                frontend_url = settings.FRONTEND_URL
                html = f"""
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #3b82f6;">We miss you at SecureVault!</h2>
                    <p>Hello {user.get('fullName', 'User')},</p>
                    <p>It's been a while since you last logged in. We wanted to reach out and make sure your vault assets are still secure.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{frontend_url}/login" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Log In to SecureVault</a>
                    </div>
                </div>
                """

                try:
                    await _send_email(user.get("email", ""), "SecureVault: Re-Engagement Reminder", html)
                    print(f"[RE-ENGAGEMENT-V4] Reminder email sent to {user.get('email')}")

                    await users_col.update_one(
                        {"_id": ObjectId(user_id)},
                        {
                            "$inc": {"reEngagementMessagesSent": 1},
                            "$set": {"reEngagementLastMessageAt": datetime.now(timezone.utc).isoformat()},
                        },
                    )
                except Exception as e:
                    print(f"[RE-ENGAGEMENT-V4] Failed to send reminder: {e}")

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
        # Only process users who are currently logged out (logoutTime is set)
        # and have not yet completed the nominee notification cycle
        users_to_check = await users_col.find({
            "nomineesNotified": {"$ne": True},
            "logoutTime": {"$ne": None, "$exists": True}
        }).to_list(length=None)
        print(f"[RE-ENGAGEMENT-V4] Found {len(users_to_check)} logged-out users to evaluate for inactivity.")

        tasks = [process_reengagement_for_user(str(u["_id"])) for u in users_to_check]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"[RE-ENGAGEMENT-V4] Error for user: {result}")

        if users_to_check:
            print(f"[RE-ENGAGEMENT-V4] Finished processing batch of {len(users_to_check)} users.")
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
