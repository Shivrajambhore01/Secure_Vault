import asyncio
import sys
import os
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import get_settings

settings = get_settings()

async def send_flow_email(to: str, subject: str, html_content: str, stage_name: str):
    if not settings.EMAIL_USER or not settings.EMAIL_PASS:
        print(f"[ERROR] [{stage_name}] EMAIL_USER or EMAIL_PASS not set in environment.")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"SecureVault <{settings.EMAIL_USER}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg["X-Mailer"] = "SecureVault End-To-End Workflow Verification"
    msg.attach(MIMEText(html_content, "html"))

    safe_subject = subject.encode('ascii', errors='replace').decode('ascii')
    print(f"\n[TRIGGERING FLOW STAGE: {stage_name}]")
    print(f" -> Subject: {safe_subject}")
    print(f" -> Recipient: {to}")

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
        print(f" -> Status: [DELIVERED SUCCESSFULLY]")
        return True
    except Exception as e:
        print(f" -> Status: [DELIVERY FAILED] Error: {e}")
        return False

async def run_end_to_end_email_flow():
    target_email = "shivrajambhore01@gmail.com"
    owner_name = "Shivraj Ambhore (Owner)"
    nominee_name = "Shivraj Ambhore (Nominee)"

    print("================================================================")
    print("   SECUREVAULT END-TO-END WORKFLOW EMAIL TRIGGERING TEST       ")
    print("================================================================")
    print(f"SMTP Account  : {settings.EMAIL_USER}")
    print(f"Target Email  : {target_email}")
    print("================================================================")

    flow_stages = []

    # ------------------------------------------------------------------
    # STAGE 1: USER REGISTRATION & EMAIL VERIFICATION
    # ------------------------------------------------------------------
    stage1_html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">🔐 Welcome to SecureVault</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0">User Registration Email Verification</p>
      </div>
      <div style="padding:28px">
        <p>Hello <strong>{owner_name}</strong>,</p>
        <p>Thank you for creating an account on SecureVault. Please verify your email address to activate your digital vault.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="http://localhost:3000/verify?token=test_verification_token_123" style="background:#7c3aed;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            Verify Email Address →
          </a>
        </div>
        <p style="color:#94a3b8;font-size:12px">If you did not create this account, please ignore this email.</p>
      </div>
    </div>
    """
    res1 = await send_flow_email(
        target_email,
        "Verify your Email - SecureVault",
        stage1_html,
        "Stage 1: User Registration & Email Verification"
    )
    flow_stages.append(("Stage 1: User Sign-Up Verification", res1))
    await asyncio.sleep(1)

    # ------------------------------------------------------------------
    # STAGE 2: USER INACTIVITY WARNING 1 (RE-ENGAGEMENT)
    # ------------------------------------------------------------------
    stage2_html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#d97706,#b45309);padding:28px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">⚠️ SecureVault Inactivity Warning</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0">Action Required: Confirm You Are Active</p>
      </div>
      <div style="padding:28px">
        <p>Hello <strong>{owner_name}</strong>,</p>
        <p>We noticed you haven't logged in to your SecureVault account for a while.</p>
        <p>To ensure your vault remains private and active, please log in within <strong>14 days</strong>.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="http://localhost:3000/login" style="background:#d97706;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            I Am Active — Log In Now →
          </a>
        </div>
      </div>
    </div>
    """
    res2 = await send_flow_email(
        target_email,
        "Action Required: Inactivity Warning - SecureVault",
        stage2_html,
        "Stage 2: Owner Inactivity Re-engagement Alert"
    )
    flow_stages.append(("Stage 2: Owner Inactivity Warning", res2))
    await asyncio.sleep(1)

    # ------------------------------------------------------------------
    # STAGE 3: DEATH CLAIM FILED — OWNER EMERGENCY HALT ALERT
    # ------------------------------------------------------------------
    stage3_html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">🚨 URGENT Security Alert</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0">A Death Claim Has Been Submitted</p>
      </div>
      <div style="padding:28px">
        <p>A death claim has been initiated for your account by nominee <strong>{nominee_name}</strong>.</p>
        <p>Your vault is currently in a <strong>30-Day Cooling Period</strong>.</p>
        <div style="background:#1c1917;border:1px solid #78350f;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
          <p style="color:#fbbf24;margin:0;font-weight:bold">IF YOU ARE ALIVE, CANCEL THIS CLAIM IMMEDIATELY</p>
        </div>
        <div style="text-align:center;margin:28px 0">
          <a href="http://localhost:3000/emergency-halt?token=test_halt_token_999" style="background:#dc2626;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            🚫 Cancel Claim — I Am Alive
          </a>
        </div>
      </div>
    </div>
    """
    res3 = await send_flow_email(
        target_email,
        "🚨 URGENT: Death Claim Filed Against Your SecureVault Account",
        stage3_html,
        "Stage 3: Owner Emergency Halt Security Alert"
    )
    flow_stages.append(("Stage 3: Owner Death Claim Security Alert", res3))
    await asyncio.sleep(1)

    # ------------------------------------------------------------------
    # STAGE 4: NOMINEE INHERITANCE ACCESS LINK NOTIFICATION
    # ------------------------------------------------------------------
    stage4_html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">🔐 SecureVault Inheritance Access</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0">Nominee Verification Portal</p>
      </div>
      <div style="padding:28px">
        <p>Hello <strong>{nominee_name}</strong>,</p>
        <p>You have been named as a digital heir in a SecureVault vault. You are now authorized to initiate the verification process.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="http://localhost:3000/nominee/verify/test_nominee_token_456" style="background:#7c3aed;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            Begin Nominee Verification →
          </a>
        </div>
        <p style="color:#94a3b8;font-size:12px">Link valid for 10 days.</p>
      </div>
    </div>
    """
    res4 = await send_flow_email(
        target_email,
        "SecureVault — You've Been Named as a Digital Heir",
        stage4_html,
        "Stage 4: Nominee Inheritance Access Link"
    )
    flow_stages.append(("Stage 4: Nominee Access Link Email", res4))
    await asyncio.sleep(1)

    # ------------------------------------------------------------------
    # STAGE 5: NOMINEE OTP VERIFICATION CODE
    # ------------------------------------------------------------------
    stage5_html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">🔑 Nominee Identity Verification</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0">One-Time Security Code (OTP)</p>
      </div>
      <div style="padding:28px">
        <p>Hello <strong>{nominee_name}</strong>,</p>
        <p>Your one-time security verification code for accessing the inheritance claim portal is:</p>
        <div style="background:#1e1b4b;border:2px solid #7c3aed;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
          <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#a78bfa;font-family:monospace">739104</span>
        </div>
        <p style="color:#94a3b8;font-size:12px">Valid for 10 minutes.</p>
      </div>
    </div>
    """
    res5 = await send_flow_email(
        target_email,
        "SecureVault Nominee Verification Code",
        stage5_html,
        "Stage 5: Nominee Identity OTP Code"
    )
    flow_stages.append(("Stage 5: Nominee Verification OTP", res5))
    await asyncio.sleep(1)

    # ------------------------------------------------------------------
    # STAGE 6: CLAIM APPROVED & VAULT ACCESS GRANTED
    # ------------------------------------------------------------------
    stage6_html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0d14;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#059669,#047857);padding:28px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">✅ Inheritance Claim Approved</h1>
        <p style="color:rgba(255,255,255,.8);margin:6px 0 0">Vault Release Granted</p>
      </div>
      <div style="padding:28px">
        <p>Hello <strong>{nominee_name}</strong>,</p>
        <p>Your death verification documents have been verified and approved. You can now access and decrypt the assigned vault assets.</p>
        <div style="text-align:center;margin:28px 0">
          <a href="http://localhost:3000/nominee/vault/test_session_789" style="background:#059669;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            Access Vault Assets →
          </a>
        </div>
      </div>
    </div>
    """
    res6 = await send_flow_email(
        target_email,
        "✅ SecureVault — Your Inheritance Claim Has Been Approved",
        stage6_html,
        "Stage 6: Nominee Claim Approval & Vault Grant"
    )
    flow_stages.append(("Stage 6: Nominee Vault Access Granted", res6))

    print("\n================================================================")
    print("                     END-TO-END WORKFLOW SUMMARY               ")
    print("================================================================")
    all_ok = True
    for name, status in flow_stages:
        st_text = "[DELIVERED]" if status else "[FAILED]"
        print(f"  {name:<45} : {st_text}")
        if not status:
            all_ok = False

    print("================================================================")
    if all_ok:
        print("[SUCCESS] ALL 6 END-TO-END WORKFLOW STAGE EMAILS SENT SUCCESSFULLY!")
    else:
        print("[WARNING] ONE OR MORE STAGES FAILED.")

if __name__ == "__main__":
    asyncio.run(run_end_to_end_email_flow())
