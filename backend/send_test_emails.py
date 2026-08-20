import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.lib.notifications import (
    send_otp_email,
    send_owner_death_claim_alert,
    send_nominee_access_link,
    send_claim_approved_email,
)
from app.core.config import get_settings

settings = get_settings()

async def main():
    target_email = "shivrajambhore01@gmail.com"
    print("==================================================")
    print("   SecureVault Email Delivery Verification Test   ")
    print("==================================================")
    print(f"SMTP Sender Account : {settings.EMAIL_USER}")
    print(f"Target Recipient    : {target_email}")
    print("--------------------------------------------------")

    results = []

    # 1. Test User Email — Security Alert (Owner)
    print("\n[1/4] Sending User Security Alert (Death Claim Alert)...")
    try:
        await send_owner_death_claim_alert(
            owner_email=target_email,
            nominee_name="Test Nominee (Shivraj)",
            halt_link="http://localhost:3000/emergency-halt?token=test_token_12345",
            cooling_days=7
        )
        print(" -> User Security Alert Status: SUCCESS (Sent)")
        results.append(("User Security Alert", True))
    except Exception as e:
        print(f" -> User Security Alert Status: FAILED ({e})")
        results.append(("User Security Alert", False))

    # 2. Test User Email — Verification Code (OTP)
    print("\n[2/4] Sending User OTP Verification Code...")
    try:
        await send_otp_email(
            to=target_email,
            otp="984210",
            nominee_name="Shivraj (Vault Owner)"
        )
        print(" -> User OTP Email Status: SUCCESS (Sent)")
        results.append(("User OTP Email", True))
    except Exception as e:
        print(f" -> User OTP Email Status: FAILED ({e})")
        results.append(("User OTP Email", False))

    # 3. Test Nominee Email — Access Link (Nominee)
    print("\n[3/4] Sending Nominee Access Link Email...")
    try:
        await send_nominee_access_link(
            nominee_email=target_email,
            nominee_name="Shivraj (Nominee)",
            access_url="http://localhost:3000/nominee/verify/test_access_token_67890"
        )
        print(" -> Nominee Access Link Status: SUCCESS (Sent)")
        results.append(("Nominee Access Link", True))
    except Exception as e:
        print(f" -> Nominee Access Link Status: FAILED ({e})")
        results.append(("Nominee Access Link", False))

    # 4. Test Nominee Email — Claim Approved
    print("\n[4/4] Sending Nominee Claim Approved Email...")
    try:
        await send_claim_approved_email(
            nominee_email=target_email,
            nominee_name="Shivraj (Nominee)",
            vault_url="http://localhost:3000/nominee/vault/test_session_token_abc"
        )
        print(" -> Nominee Claim Approved Status: SUCCESS (Sent)")
        results.append(("Nominee Claim Approved", True))
    except Exception as e:
        print(f" -> Nominee Claim Approved Status: FAILED ({e})")
        results.append(("Nominee Claim Approved", False))

    print("\n==================================================")
    print("                  TEST SUMMARY                    ")
    print("==================================================")
    all_success = True
    for name, status in results:
        status_str = "DELIVERED" if status else "FAILED"
        print(f"  - {name:<30}: {status_str}")
        if not status:
            all_success = False

    if all_success:
        print("\n[SUCCESS] ALL TEST EMAILS WERE SUCCESSFULLY DELIVERED VIA NOTIFICATION SERVICE!")
    else:
        print("\n[WARNING] SOME EMAILS FAILED TO SEND.")

if __name__ == "__main__":
    asyncio.run(main())
