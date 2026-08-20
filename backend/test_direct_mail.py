import asyncio
import sys
import os
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import get_settings

settings = get_settings()

async def send_direct_email(to: str, subject: str, html_content: str):
    msg = MIMEMultipart("alternative")
    msg["From"] = f"SecureVault <{settings.EMAIL_USER}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg["X-Mailer"] = "SecureVault Direct Email Verification"
    msg.attach(MIMEText(html_content, "html"))

    print(f"Connecting to smtp.gmail.com:587 for recipient {to}...")
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
        print(f"[SUCCESS] Email sent to {to} | Subject: {subject}")
        return True
    except Exception as e:
        import traceback
        print(f"[ERROR] sending email to {to}: {e}")
        traceback.print_exc()
        return False

async def main():
    target_email = "shivrajambhore01@gmail.com"
    print("==================================================")
    print("   SecureVault Direct SMTP Email Sending Test    ")
    print("==================================================")
    print(f"Sender Account   : {settings.EMAIL_USER}")
    print(f"Target Email     : {target_email}")
    print("--------------------------------------------------")

    # 1. USER EMAIL TEST
    user_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:24px;border-radius:12px">
      <h2 style="color:#ef4444">⚠️ [TEST] SecureVault Owner Alert</h2>
      <p>Hello <strong>Vault Owner (Shivraj)</strong>,</p>
      <p>This is a test notification confirming that <strong>User Email Notifications</strong> are functioning correctly in SecureVault.</p>
      <p>Your Security OTP code: <span style="font-size:24px;font-weight:bold;color:#38bdf8">849201</span></p>
      <p style="color:#94a3b8;font-size:12px">Time: {asyncio.get_event_loop().time()}</p>
    </div>
    """
    res_user = await send_direct_email(target_email, "SecureVault Test Mail - User Alert & OTP", user_html)

    # 2. NOMINEE EMAIL TEST
    nominee_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:24px;border-radius:12px">
      <h2 style="color:#8b5cf6">🔐 [TEST] SecureVault Nominee Access Link</h2>
      <p>Hello <strong>Nominee (Shivraj)</strong>,</p>
      <p>This is a test notification confirming that <strong>Nominee Email Notifications</strong> (Access Links & Verification Codes) are functioning correctly.</p>
      <div style="text-align:center;margin:20px 0">
        <a href="http://localhost:3000/nominee/verify/test_token_123" style="background:#7c3aed;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
          Verify Inheritance Access →
        </a>
      </div>
    </div>
    """
    res_nominee = await send_direct_email(target_email, "SecureVault Test Mail - Nominee Access Link", nominee_html)

    print("\n--------------------------------------------------")
    if res_user and res_nominee:
        print("[SUCCESS] ALL TEST EMAILS SENT SUCCESSFULLY TO shivrajambhore01@gmail.com!")
    else:
        print("[WARNING] ONE OR MORE EMAILS FAILED.")

if __name__ == "__main__":
    asyncio.run(main())
