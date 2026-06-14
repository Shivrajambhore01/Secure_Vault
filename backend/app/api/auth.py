"""Authentication API routes — full port of backend/routes/auth.ts."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import pyotp
import qrcode
import qrcode.image.pil
from io import BytesIO
import base64

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Body
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.database import db
from app.core.security import (
    hash_password,
    verify_password,
    is_bcrypt_hash,
    generate_access_token,
    generate_refresh_token,
    generate_reset_token,
    decode_token,
    set_auth_cookies,
    get_current_user,
)
from app.lib.encryption import encrypt, decrypt

router = APIRouter()
settings = get_settings()

# ------------------------------------------------------------------
# Collections helper
# ------------------------------------------------------------------
users_col = db["users"]
otps_col = db["otps"]


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


async def _send_verification_email(email: str, token: str, full_name: str):
    frontend_url = settings.FRONTEND_URL
    verification_url = f"{frontend_url}/verify?token={token}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #3b82f6;">Welcome to SecureVault!</h2>
        <p>Hello {full_name},</p>
        <p>Thank you for signing up. Please verify your email address to activate your account and access your dashboard.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{verification_url}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify Email Address</a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #64748b;">{verification_url}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 12px; color: #64748b;">This link will expire in 24 hours.</p>
    </div>
    """
    await _send_email(email, "Verify your Email - SecureVault", html)


def _generate_verification_token() -> str:
    return secrets.token_hex(32)


def _reset_reengagement_fields() -> dict:
    """Returns fields to reset the re-engagement system."""
    return {
        "logoutTime": None,
        "reEngagementCallSent": False,
        "reEngagementMessagesSent": 0,
        "reEngagementLastMessageAt": None,
        "nomineesNotified": False,
    }


# ------------------------------------------------------------------
# Pydantic Models
# ------------------------------------------------------------------

class SignupRequest(BaseModel):
    fullName: str
    email: str
    phone: str = ""
    dob: str = ""
    password: str
    pin: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TwoFATokenRequest(BaseModel):
    token: str


class TwoFALoginVerifyRequest(BaseModel):
    userId: str
    token: str


class SendOTPRequest(BaseModel):
    email: str


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str


class VerifyPinRequest(BaseModel):
    userId: str
    pin: str


class UpdatePlanRequest(BaseModel):
    userId: str
    plan: str


class UpdateProfileRequest(BaseModel):
    userId: str
    fullName: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    inactivityPeriod: Optional[int] = None


class UpdatePasswordRequest(BaseModel):
    userId: str
    oldPassword: str
    newPassword: str


class UpdatePinRequest(BaseModel):
    userId: str
    oldPin: str
    newPin: str


class GoogleAuthRequest(BaseModel):
    credential: str


class CompleteProfileRequest(BaseModel):
    fullName: str
    phone: str
    dob: str
    pin: str


class ForgotRequestModel(BaseModel):
    email: str
    type: str  # 'password' or 'pin'


class ForgotVerifyModel(BaseModel):
    email: str
    otp: str
    type: str


class ResetCredentialModel(BaseModel):
    resetToken: str
    newValue: str
    type: str


# ===================================================================
# ROUTES
# ===================================================================

# ------------------------------------------------------------------
# Signup
# ------------------------------------------------------------------
@router.post("/signup")
async def signup(data: SignupRequest, response: Response):
    if not data.fullName or not data.email or not data.password or not data.pin:
        raise HTTPException(status_code=400, detail="Missing required fields")

    existing = await users_col.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    password_hash = hash_password(data.password)
    pin_hash = hash_password(data.pin)
    verification_token = _generate_verification_token()

    new_user = {
        "fullName": data.fullName,
        "email": data.email.lower(),
        "phone": "",
        "dob": "",
        "password": password_hash,
        "pin": pin_hash,
        "role": "user",
        "isTwoFactorEnabled": False,
        "twoFactorSecret": "",
        "isProfileComplete": False,
        "inactivityPeriod": 6,
        "plan": "free",
        "storageUsed": 0,
        "storageLimit": 500 * 1024 * 1024,
        "isVerified": False,
        "verificationToken": verification_token,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "lastActive": datetime.now(timezone.utc).isoformat(),
        "logoutTime": None,
        "reEngagementCallSent": False,
        "reEngagementMessagesSent": 0,
        "reEngagementLastMessageAt": None,
    }

    result = await users_col.insert_one(new_user)

    # Send verification email (fire-and-forget style)
    try:
        await _send_verification_email(new_user["email"], verification_token, new_user["fullName"])
    except Exception as e:
        print(f"Verification email failed: {e}")

    user_data = _serialize_user(new_user)

    access_token = generate_access_token(user_data["id"], user_data["email"])
    refresh_token = generate_refresh_token(user_data["id"], user_data["email"])
    set_auth_cookies(response, access_token, refresh_token)

    return {"message": "User registered successfully", "user": user_data}


# ------------------------------------------------------------------
# Login
# ------------------------------------------------------------------
@router.post("/login")
async def login(data: LoginRequest, response: Response):
    if not data.email or not data.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user = await users_col.find_one({"email": data.email.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    is_password_match = False
    if is_bcrypt_hash(user["password"]):
        is_password_match = verify_password(data.password, user["password"])
    else:
        # Legacy AES-256 password
        try:
            decrypted = decrypt(user["password"])
            if decrypted == data.password:
                new_hash = hash_password(data.password)
                await users_col.update_one({"_id": user["_id"]}, {"$set": {"password": new_hash}})
                is_password_match = True
        except Exception as e:
            print(f"Legacy decryption failed: {e}")

    if not is_password_match:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 2FA check
    if user.get("isTwoFactorEnabled"):
        return {
            "message": "2FA Required",
            "twoFactorRequired": True,
            "userId": str(user["_id"]),
        }

    user_data = {k: v for k, v in user.items() if k not in ("password", "pin", "_id")}
    user_data["id"] = str(user["_id"])

    access_token = generate_access_token(user_data["id"], user_data.get("email"))
    refresh_token = generate_refresh_token(user_data["id"], user_data.get("email"))
    set_auth_cookies(response, access_token, refresh_token)

    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {"lastActive": datetime.now(timezone.utc).isoformat(), **_reset_reengagement_fields()}},
    )

    return {"message": "Login successful", "user": user_data}


# ------------------------------------------------------------------
# 2FA Setup
# ------------------------------------------------------------------
@router.post("/2fa/setup")
async def twofa_setup(current_user: dict = Depends(get_current_user)):
    user_id = current_user["userId"]
    secret = pyotp.random_base32()

    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"tempTwoFactorSecret": secret}},
    )

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=f"SecureVault:{user_id}", issuer_name="SecureVault")

    # Generate QR code as data URL
    # Use PilImage factory explicitly to satisfy linter and ensure format support
    from qrcode.image.pil import PilImage
    qr = qrcode.make(provisioning_uri, image_factory=PilImage)
    buf = BytesIO()
    
    # PilImage always supports format="PNG"
    qr.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()
    qr_code_url = f"data:image/png;base64,{qr_b64}"

    return {"qrCodeUrl": qr_code_url, "secret": secret}


# ------------------------------------------------------------------
# 2FA Verify (enable)
# ------------------------------------------------------------------
@router.post("/2fa/verify")
async def twofa_verify(data: TwoFATokenRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["userId"]
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("tempTwoFactorSecret"):
        raise HTTPException(status_code=400, detail="2FA setup not initiated")

    totp = pyotp.TOTP(user["tempTwoFactorSecret"])
    if totp.verify(data.token):
        await users_col.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {"isTwoFactorEnabled": True, "twoFactorSecret": user["tempTwoFactorSecret"]},
                "$unset": {"tempTwoFactorSecret": ""},
            },
        )
        return {"message": "2FA enabled successfully!"}
    else:
        raise HTTPException(status_code=400, detail="Invalid verification token")


# ------------------------------------------------------------------
# 2FA Login Verify
# ------------------------------------------------------------------
@router.post("/2fa/login-verify")
async def twofa_login_verify(data: TwoFALoginVerifyRequest, response: Response):
    if not data.userId or not data.token:
        raise HTTPException(status_code=400, detail="UserId and token required")

    user = await users_col.find_one({"_id": ObjectId(data.userId)})
    if not user or not user.get("twoFactorSecret"):
        raise HTTPException(status_code=401, detail="Invalid session or 2FA not enabled")

    totp = pyotp.TOTP(user["twoFactorSecret"])
    if totp.verify(data.token):
        user_data = {k: v for k, v in user.items() if k not in ("password", "pin", "_id")}
        user_data["id"] = str(user["_id"])

        access_token = generate_access_token(user_data["id"], user_data.get("email"))
        refresh_token = generate_refresh_token(user_data["id"], user_data.get("email"))
        set_auth_cookies(response, access_token, refresh_token)

        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"lastActive": datetime.now(timezone.utc).isoformat(), **_reset_reengagement_fields()}},
        )

        return {"message": "Login successful", "user": user_data}
    else:
        raise HTTPException(status_code=401, detail="Invalid 2FA token")


# ------------------------------------------------------------------
# Send OTP
# ------------------------------------------------------------------
@router.post("/send-otp")
async def send_otp(data: SendOTPRequest):
    if not data.email:
        raise HTTPException(status_code=400, detail="Email is required")

    import random
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    await otps_col.update_one(
        {"email": data.email.lower()},
        {"$set": {"otp": otp, "expiresAt": expires_at}},
        upsert=True,
    )

    html = f"""
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Verify your email</h2>
        <p>Your verification code for SecureVault is:</p>
        <div style="font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 5px; margin: 20px 0;">
            {otp}
        </div>
        <p>This code will expire in 5 minutes.</p>
    </div>
    """

    try:
        await _send_email(data.email, "SecureVault Verification Code", html)
        return {"message": "OTP sent successfully"}
    except Exception as e:
        print(f"[DEV MODE] OTP for {data.email}: {otp}")
        return {"message": "OTP sent (check backend terminal logs)", "devMode": True}


# ------------------------------------------------------------------
# Verify OTP
# ------------------------------------------------------------------
@router.post("/verify-otp")
async def verify_otp(data: VerifyOTPRequest):
    if not data.email or not data.otp:
        raise HTTPException(status_code=400, detail="Email and OTP are required")

    record = await otps_col.find_one({"email": data.email.lower()})
    if not record or record["otp"] != data.otp or datetime.now(timezone.utc) > record["expiresAt"].replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    await otps_col.delete_one({"email": data.email.lower()})
    return {"message": "OTP verified successfully"}


# ------------------------------------------------------------------
# Verify PIN
# ------------------------------------------------------------------
@router.post("/verify-pin")
async def verify_pin(data: VerifyPinRequest):
    if not data.userId or not data.pin:
        raise HTTPException(status_code=400, detail="User ID and PIN are required")

    user = await users_col.find_one({"_id": ObjectId(data.userId)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_pin_match = False
    if is_bcrypt_hash(user["pin"]):
        is_pin_match = verify_password(data.pin, user["pin"])
    else:
        try:
            decrypted = decrypt(user["pin"])
            if decrypted == data.pin:
                new_hash = hash_password(data.pin)
                await users_col.update_one({"_id": user["_id"]}, {"$set": {"pin": new_hash}})
                is_pin_match = True
        except Exception as e:
            print(f"Legacy PIN decryption failed: {e}")

    if is_pin_match:
        return {"message": "PIN verified successfully"}
    else:
        raise HTTPException(status_code=401, detail="Incorrect PIN")


# ------------------------------------------------------------------
# Update Plan
# ------------------------------------------------------------------
@router.post("/update-plan")
async def update_plan(data: UpdatePlanRequest, current_user: dict = Depends(get_current_user)):
    if not data.userId or not data.plan:
        raise HTTPException(status_code=400, detail="UserId and Plan are required")

    limits = {
        "free": 500 * 1024 * 1024,
        "pro": 10 * 1024 * 1024 * 1024,
        "premium": 100 * 1024 * 1024 * 1024,
    }

    result = await users_col.find_one_and_update(
        {"_id": ObjectId(data.userId)},
        {"$set": {"plan": data.plan, "storageLimit": limits.get(data.plan, limits["free"])}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": f"Upgraded to {data.plan} successfully!", "user": _serialize_user(result)}


# ------------------------------------------------------------------
# Get User Profile
# ------------------------------------------------------------------
@router.get("/me/{user_id}")
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = {k: v for k, v in user.items() if k not in ("password", "pin", "_id")}
    user_data["id"] = str(user["_id"])

    # Default values
    if user_data.get("isVerified") is None:
        user_data["isVerified"] = False
    if user_data.get("isProfileComplete") is None:
        user_data["isProfileComplete"] = False
    if not user_data.get("plan"):
        user_data["plan"] = "free"
    if not user_data.get("storageLimit"):
        user_data["storageLimit"] = 500 * 1024 * 1024

    # Auto-fix storageUsed
    if not user_data.get("storageUsed"):
        assets = await db["assets"].find({"userId": user_id}).to_list(length=None)
        total_size = sum(a.get("fileSize", 0) for a in assets)
        if total_size > 0:
            await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"storageUsed": total_size}})
            user_data["storageUsed"] = total_size
        else:
            user_data["storageUsed"] = 0

    return user_data


# ------------------------------------------------------------------
# Update Profile
# ------------------------------------------------------------------
@router.post("/update-profile")
async def update_profile(data: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    if not data.userId:
        raise HTTPException(status_code=400, detail="User ID is required")

    update_data: dict = {}
    if data.fullName:
        update_data["fullName"] = data.fullName
    if data.phone:
        update_data["phone"] = data.phone
    if data.email:
        update_data["email"] = data.email.lower()
    if data.inactivityPeriod is not None:
        update_data["inactivityPeriod"] = data.inactivityPeriod

    update_data.update(_reset_reengagement_fields())

    result = await users_col.find_one_and_update(
        {"_id": ObjectId(data.userId)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "Profile updated successfully!", "user": _serialize_user(result)}


# ------------------------------------------------------------------
# Update Password
# ------------------------------------------------------------------
@router.post("/update-password")
async def update_password(data: UpdatePasswordRequest, current_user: dict = Depends(get_current_user)):
    if not data.userId or not data.oldPassword or not data.newPassword:
        raise HTTPException(status_code=400, detail="Missing required fields")

    user = await users_col.find_one({"_id": ObjectId(data.userId)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_old_match = False
    if is_bcrypt_hash(user["password"]):
        is_old_match = verify_password(data.oldPassword, user["password"])
    else:
        try:
            if decrypt(user["password"]) == data.oldPassword:
                is_old_match = True
        except Exception:
            pass

    if not is_old_match:
        raise HTTPException(status_code=401, detail="Incorrect current password")

    hashed = hash_password(data.newPassword)
    await users_col.update_one(
        {"_id": ObjectId(data.userId)},
        {"$set": {"password": hashed, **_reset_reengagement_fields()}},
    )

    return {"message": "Password updated successfully!"}


# ------------------------------------------------------------------
# Heartbeat
# ------------------------------------------------------------------
@router.post("/heartbeat")
async def heartbeat(current_user: dict = Depends(get_current_user)):
    user_id = current_user["userId"]
    user = await users_col.find_one({"_id": ObjectId(user_id)})

    if user and user.get("logoutTime"):
        print(f"[Heartbeat] BLOCKED for User {user_id} (already logged out at {user['logoutTime']})")
        return {"status": "logged_out", "isOnline": False}

    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"lastActive": datetime.now(timezone.utc).isoformat(), **_reset_reengagement_fields()}},
    )

    print(f"[Heartbeat] User {user_id} is active.")
    return {"status": "active", "isOnline": True}


# ------------------------------------------------------------------
# Update PIN
# ------------------------------------------------------------------
@router.post("/update-pin")
async def update_pin(data: UpdatePinRequest, current_user: dict = Depends(get_current_user)):
    if not data.userId or not data.oldPin or not data.newPin:
        raise HTTPException(status_code=400, detail="Missing required fields")

    user = await users_col.find_one({"_id": ObjectId(data.userId)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_old_match = False
    if is_bcrypt_hash(user["pin"]):
        is_old_match = verify_password(data.oldPin, user["pin"])
    else:
        try:
            if decrypt(user["pin"]) == data.oldPin:
                is_old_match = True
        except Exception:
            pass

    if not is_old_match:
        raise HTTPException(status_code=401, detail="Incorrect current PIN")

    hashed = hash_password(data.newPin)
    await users_col.update_one(
        {"_id": ObjectId(data.userId)},
        {"$set": {"pin": hashed, **_reset_reengagement_fields()}},
    )

    return {"message": "PIN updated successfully!"}


# ------------------------------------------------------------------
# Google OAuth
# ------------------------------------------------------------------
@router.post("/google-auth")
async def google_auth(data: GoogleAuthRequest, response: Response):
    if not data.credential:
        raise HTTPException(status_code=400, detail="Google token is required")

    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    try:
        payload = google_id_token.verify_oauth2_token(
            data.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=300,
        )
    except Exception as e:
        import traceback
        print("GOOGLE AUTH EXCEPTION:")
        traceback.print_exc()
        try:
            with open("google_auth_error.log", "w", encoding="utf-8") as f:
                f.write(f"Exception: {str(e)}\n\nTraceback:\n")
                traceback.print_exc(file=f)
        except Exception as log_err:
            print(f"Failed to write log file: {log_err}")
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")

    email = payload.get("email")
    email_verified = payload.get("email_verified", False)
    name = payload.get("name")
    picture = payload.get("picture")
    google_id = payload.get("sub")

    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    user = await users_col.find_one({"email": email.lower()})

    if not user:
        # SIGN UP
        verification_token = _generate_verification_token()
        new_user = {
            "fullName": name,
            "email": email.lower(),
            "googleId": google_id,
            "picture": picture,
            "phone": "",
            "dob": "",
            "password": hash_password("GOOGLE_AUTH_ACCOUNT"),
            "pin": hash_password("0000"),
            "inactivityPeriod": 6,
            "plan": "free",
            "storageUsed": 0,
            "storageLimit": 500 * 1024 * 1024,
            "isVerified": email_verified,
            "verificationToken": verification_token if not email_verified else None,
            "verificationTokenExpires": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "lastActive": datetime.now(timezone.utc).isoformat(),
            "isProfileComplete": False,
            "isOnline": True,
            "authMethod": "google",
            **_reset_reengagement_fields(),
        }

        result = await users_col.insert_one(new_user)

        try:
            await _send_verification_email(new_user["email"], verification_token, new_user.get("fullName") or "User")
        except Exception as e:
            print(f"Verification email failed: {e}")

        user_data = _serialize_user(new_user)

        access_token = generate_access_token(user_data["id"], user_data["email"])
        refresh_token = generate_refresh_token(user_data["id"], user_data["email"])
        set_auth_cookies(response, access_token, refresh_token)

        return {"message": "Signed up with Google successfully!", "user": user_data, "source": "signup"}
    else:
        # LOGIN
        if not user.get("googleId"):
            await users_col.update_one(
                {"_id": user["_id"]},
                {"$set": {"googleId": google_id, "picture": picture, "authMethod": "google"}},
            )

        user_data = {k: v for k, v in user.items() if k not in ("password", "pin", "_id")}
        user_data["id"] = str(user["_id"])

        access_token = generate_access_token(user_data["id"], user_data.get("email"))
        refresh_token = generate_refresh_token(user_data["id"], user_data.get("email"))
        set_auth_cookies(response, access_token, refresh_token)

        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"lastActive": datetime.now(timezone.utc).isoformat(), **_reset_reengagement_fields()}},
        )

        return {"message": "Welcome back!", "user": user_data, "source": "login"}


# ------------------------------------------------------------------
# Complete Profile
# ------------------------------------------------------------------
@router.post("/complete-profile")
async def complete_profile(data: CompleteProfileRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["userId"]
    print(f"[Complete Profile] userId from token: {user_id}")

    if not data.fullName or not data.phone or not data.dob or not data.pin:
        raise HTTPException(status_code=400, detail="All fields are required: fullName, phone, dob, pin")

    if len(data.pin) < 4:
        raise HTTPException(status_code=400, detail="PIN must be at least 4 digits")

    hashed_pin = hash_password(data.pin)

    user_to_update = await users_col.find_one({"_id": ObjectId(user_id)})

    if not user_to_update and current_user.get("email"):
        print(f"[Complete Profile] Falling back to email: {current_user['email']}")
        user_to_update = await users_col.find_one({"email": current_user["email"].lower()})

    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    result = await users_col.find_one_and_update(
        {"_id": user_to_update["_id"]},
        {
            "$set": {
                "fullName": data.fullName,
                "phone": data.phone,
                "dob": data.dob,
                "pin": hashed_pin,
                "isProfileComplete": True,
                **_reset_reengagement_fields(),
            }
        },
        return_document=True,
    )

    user_data = _serialize_user(result)
    print(f"Profile completed for user: {user_data.get('email')}")
    return {"message": "Profile completed successfully!", "user": user_data}


# ------------------------------------------------------------------
# Refresh Token
# ------------------------------------------------------------------
@router.post("/refresh-token")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refreshToken")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token provided")

    try:
        decoded = decode_token(token)
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid refresh token")

    if not decoded.get("userId") or decoded.get("type") != "refresh":
        raise HTTPException(status_code=403, detail="Invalid refresh token")

    new_access_token = generate_access_token(decoded["userId"], decoded.get("email"))

    set_auth_cookies(response, new_access_token, token)

    # Reset re-engagement
    await users_col.update_one(
        {"_id": ObjectId(decoded["userId"])},
        {"$set": {"lastActive": datetime.now(timezone.utc).isoformat(), **_reset_reengagement_fields()}},
    )

    return {"message": "Token refreshed"}


# ------------------------------------------------------------------
# Verify Email
# ------------------------------------------------------------------
@router.get("/verify-email")
async def verify_email(token: str):
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    user = await users_col.find_one({"verificationToken": token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    if user.get("isVerified"):
        return {"message": "Email already verified!"}

    expires_at = user.get("verificationTokenExpires")
    if expires_at:
        expiry_date = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00")) if isinstance(expires_at, str) else expires_at
        if expiry_date < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Verification token has expired. Please request a new one.")

    await users_col.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"isVerified": True, **_reset_reengagement_fields()},
            "$unset": {"verificationToken": "", "verificationTokenExpires": ""},
        },
    )

    return {"message": "Email verified successfully!"}


# ------------------------------------------------------------------
# Resend Verification
# ------------------------------------------------------------------
@router.post("/resend-verification")
async def resend_verification(current_user: dict = Depends(get_current_user)):
    user_id = current_user["userId"]
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("isVerified"):
        raise HTTPException(status_code=400, detail="Email already verified")

    new_token = _generate_verification_token()
    expiry = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "verificationToken": new_token,
                "verificationTokenExpires": expiry,
                **_reset_reengagement_fields(),
            }
        },
    )

    await _send_verification_email(user["email"], new_token, user["fullName"])
    return {"message": "Verification email resent!"}


# ------------------------------------------------------------------
# Logout
# ------------------------------------------------------------------
@router.post("/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    user_id = current_user["userId"]
    try:
        print(f"[Logout] Arming re-engagement for User: {user_id}")
        await users_col.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "lastActive": datetime.now(timezone.utc).isoformat(),
                    "logoutTime": datetime.now(timezone.utc).isoformat(),
                    "reEngagementCallSent": False,
                    "reEngagementMessagesSent": 0,
                    "reEngagementLastMessageAt": None,
                    "nomineesNotified": False,
                }
            },
        )
    except Exception as e:
        print(f"[Logout] DB Update Error for User {user_id}: {e}")

    response.delete_cookie("accessToken")
    response.delete_cookie("refreshToken")
    return {"message": "Logged out successfully"}


# ------------------------------------------------------------------
# Forgot Password / PIN Flow
# ------------------------------------------------------------------
@router.post("/forgot-request")
async def forgot_request(data: ForgotRequestModel):
    if not data.email or not data.type:
        raise HTTPException(status_code=400, detail="Email and type required")

    user = await users_col.find_one({"email": data.email.lower()})
    if not user:
        return {"message": "If account exists, OTP has been sent."}

    # Rate limit
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = await otps_col.count_documents({"email": data.email.lower(), "createdAt": {"$gte": one_hour_ago}})
    if recent >= 3:
        raise HTTPException(status_code=429, detail="Too many requests. Try again after an hour.")

    import random
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    await otps_col.update_one(
        {"email": data.email.lower(), "type": f"forgot_{data.type}"},
        {"$set": {"otp": otp, "expiresAt": expires_at, "createdAt": datetime.now(timezone.utc)}},
        upsert=True,
    )

    type_label = "Password" if data.type == "password" else "PIN"
    html = f"""
    <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3b82f6;">Reset your {data.type}</h2>
        <p>You requested to reset your SecureVault {data.type}. Use the code below to proceed:</p>
        <div style="font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 5px; margin: 20px 0; background: #f8fafc; padding: 10px; text-align: center; border-radius: 8px;">
            {otp}
        </div>
        <p>This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
    </div>
    """

    try:
        await _send_email(data.email, f"SecureVault - Reset {type_label}", html)
    except Exception:
        print(f"[DEV MODE] OTP for {data.email} ({data.type}): {otp}")

    return {"message": "OTP sent successfully"}


@router.post("/forgot-verify")
async def forgot_verify(data: ForgotVerifyModel):
    if not data.email or not data.otp or not data.type:
        raise HTTPException(status_code=400, detail="Missing required fields")

    record = await otps_col.find_one({
        "email": data.email.lower(),
        "type": f"forgot_{data.type}",
        "otp": data.otp,
    })

    if not record or datetime.now(timezone.utc) > record["expiresAt"].replace(tzinfo=timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user = await users_col.find_one({"email": data.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await otps_col.delete_one({"_id": record["_id"]})
    reset_token = generate_reset_token(str(user["_id"]), data.type)

    return {"resetToken": reset_token, "message": "OTP verified. Proceed to reset."}


@router.post("/reset-credential")
async def reset_credential(data: ResetCredentialModel):
    if not data.resetToken or not data.newValue or not data.type:
        raise HTTPException(status_code=400, detail="Missing required fields")

    try:
        decoded = decode_token(data.resetToken)
        if decoded.get("purpose") != "reset" or decoded.get("type") != data.type:
            raise HTTPException(status_code=401, detail="Invalid reset token")
    except Exception:
        raise HTTPException(status_code=401, detail="Reset token expired or invalid")

    hashed = hash_password(data.newValue)
    update_field = {"password": hashed} if data.type == "password" else {"pin": hashed}

    result = await users_col.update_one({"_id": ObjectId(decoded["userId"])}, {"$set": update_field})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    label = "Password" if data.type == "password" else "PIN"
    return {"message": f"{label} reset successfully!"}


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _serialize_user(user: dict) -> dict:
    """Strip sensitive fields and convert _id to id string."""
    data = {k: v for k, v in user.items() if k not in ("password", "pin", "_id")}
    data["id"] = str(user.get("_id", ""))
    return data
