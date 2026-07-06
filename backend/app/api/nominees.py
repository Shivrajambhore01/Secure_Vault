"""Nominee management API routes — port of backend/routes/nominees.ts."""

import secrets
import random
import time
import string
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, Any

from app.core.config import get_settings
from app.core.database import db
from app.core.security import get_current_user

router = APIRouter()
settings = get_settings()

# Collections
nominees_col = db["nominees"]
nominee_otps_col = db["nominee_otps"]
assets_col = db["assets"]


# ------------------------------------------------------------------
# Email helper (shared)
# ------------------------------------------------------------------
async def _send_email(to: str, subject: str, html: str):
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
# Models
# ------------------------------------------------------------------
class NomineeSendOTPRequest(BaseModel):
    token: str
    email: str


class NomineeVerifyOTPRequest(BaseModel):
    email: str
    otp: str
    token: str


# ------------------------------------------------------------------
# GET nominee details by token (public)
# ------------------------------------------------------------------
@router.get("/verify/{token}")
async def verify_nominee_token(token: str):
    print(f"[Nominee] Verifying token: {token}")
    nominee = await nominees_col.find_one({"accessToken": token})

    if not nominee:
        print(f"[Nominee] Token not found in database: {token}")
        raise HTTPException(status_code=404, detail="Invalid or expired access link")

    if nominee.get("tokenExpiry"):
        expiry = nominee["tokenExpiry"]
        if isinstance(expiry, str):
            expiry = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expiry:
            print(f"[Nominee] Token expired for nominee: {nominee['email']}")
            raise HTTPException(status_code=401, detail="Access link has expired (24h limit)")

    print(f"[Nominee] Token verified for: {nominee['email']}")

    # Mask email
    user_part, domain = nominee["email"].split("@")
    masked = user_part[0] + "*" * (len(user_part) - 2) + user_part[-1] + "@" + domain

    return {
        "name": nominee["name"],
        "maskedEmail": masked,
        "email": nominee["email"],
    }


# ------------------------------------------------------------------
# POST send OTP to nominee (public)
# ------------------------------------------------------------------
@router.post("/send-otp")
async def nominee_send_otp(data: NomineeSendOTPRequest):
    nominee = await nominees_col.find_one({"accessToken": data.token, "email": data.email})
    if not nominee:
        raise HTTPException(status_code=403, detail="Unauthorized")

    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    await nominee_otps_col.update_one(
        {"email": data.email.lower()},
        {"$set": {"otp": otp, "expiresAt": expires_at, "token": data.token}},
        upsert=True,
    )

    html = f"""
    <div style="font-family: sans-serif; padding: 20px;">
        <h2>Verify your access</h2>
        <p>Your verification code to access SecureVault assets is:</p>
        <div style="font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 5px; margin: 20px 0;">
            {otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
    </div>
    """

    print(f"[NOMINEE-OTP] Generated OTP for {data.email}: {otp}")
    try:
        await _send_email(data.email, "SecureVault Nominee Verification Code", html)
    except Exception as e:
        print(f"[NOMINEE-OTP] Email failed: {e}")

    return {"message": "OTP sent successfully"}


# ------------------------------------------------------------------
# POST verify nominee OTP (public)
# ------------------------------------------------------------------
@router.post("/verify-otp")
async def nominee_verify_otp(data: NomineeVerifyOTPRequest):
    record = await nominee_otps_col.find_one({
        "email": data.email.lower(),
        "otp": data.otp,
        "token": data.token,
    })

    if not record or datetime.now(timezone.utc) > record["expiresAt"].replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    return {"message": "Verified", "sessionToken": data.token}


# ------------------------------------------------------------------
# GET assets for nominee by session token (public)
# ------------------------------------------------------------------
@router.get("/assets/{session_token}")
async def get_nominee_assets(session_token: str):
    nominee = await nominees_col.find_one({"accessToken": session_token})
    if not nominee:
        raise HTTPException(status_code=401, detail="Session expired")

    # Strictly fetch only assets assigned to this specific nominee
    assets = await assets_col.find({
        "userId": nominee["userId"],
        "$or": [
            {"nomineeId": nominee["id"]},
            {"nomineeIds": nominee["id"]}
        ]
    }, {"fileData": 0}).to_list(length=None)

    # Serialize ObjectIds
    for a in assets:
        a["_id"] = str(a["_id"])

    return {
        "ownerName": nominee.get("userName", "Account Owner"),
        "assets": assets,
    }


# ------------------------------------------------------------------
# GET all nominees for a user (protected)
# ------------------------------------------------------------------
@router.get("/{user_id}")
async def get_nominees(user_id: str, current_user: dict = Depends(get_current_user)):
    nominees = await nominees_col.find({"userId": user_id}).to_list(length=None)
    for n in nominees:
        n["_id"] = str(n["_id"])
    return nominees


# ------------------------------------------------------------------
# POST save/update a nominee (protected)
# ------------------------------------------------------------------
@router.post("/")
async def save_nominee(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    nominee_id = body.pop("id", None)
    user_id = body.pop("userId", None)

    if not user_id:
        raise HTTPException(status_code=400, detail="UserId is required")

    if nominee_id:
        await nominees_col.update_one(
            {"id": nominee_id, "userId": user_id},
            {"$set": {**body, "updatedAt": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    else:
        new_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=13)) + hex(int(time.time()))[2:]
        await nominees_col.insert_one({
            "id": new_id,
            "userId": user_id,
            **body,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

    return {"message": "Nominee saved successfully"}


# ------------------------------------------------------------------
# DELETE a nominee (protected)
# ------------------------------------------------------------------
@router.delete("/{user_id}/{nominee_id}")
async def delete_nominee(user_id: str, nominee_id: str, current_user: dict = Depends(get_current_user)):
    await nominees_col.delete_one({"id": nominee_id, "userId": user_id})
    return {"message": "Nominee deleted successfully"}
