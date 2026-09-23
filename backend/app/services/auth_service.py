"""
Authentication Service — SecureVault Enterprise
Handles registration, login with device fingerprinting, MFA challenges,
token rotation, session revocations, and password/PIN lifecycles.
"""

import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from bson import ObjectId
from fastapi import Request

from app.core.database import db
from app.domain.exceptions import ConflictError, NotFoundError, UnauthorizedError, ValidationError
from app.repositories.user_repository import UserRepository
from app.repositories.audit_repository import AuditRepository
from app.security.hashing import hash_secret, verify_secret
from app.security.tokens import create_access_token, create_refresh_token, decode_token
from app.services.base import BaseService
from app.services.session_service import SessionService
from app.services.mfa_service import MfaService
from app.lib.notifications import send_email


class AuthService(BaseService):
    def __init__(
        self,
        user_repo: Optional[UserRepository] = None,
        audit_repo: Optional[AuditRepository] = None,
    ):
        super().__init__()
        self.user_repo = user_repo or UserRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.session_service = SessionService()
        self.mfa_service = MfaService()
        self.users_col = db["users"]
        self.sessions_col = db["user_sessions"]

    async def register(
        self,
        email: str,
        password: str,
        full_name: str,
        phone: Optional[str] = None,
        pin: Optional[str] = None,
        request: Optional[Request] = None,
    ) -> Dict[str, Any]:
        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise ConflictError("An account with this email already exists")

        now_iso = datetime.now(timezone.utc).isoformat()
        verification_token = secrets.token_urlsafe(32)

        user_doc = {
            "email": email.lower().strip(),
            "password": hash_secret(password),
            "fullName": full_name.strip(),
            "phone": phone.strip() if phone else None,
            "pin": hash_secret(pin) if pin else None,
            "isEmailVerified": False,
            "emailVerificationToken": verification_token,
            "twoFactorEnabled": False,
            "inactivityPeriod": 6.0,
            "lastActive": now_iso,
            "logoutTime": None,
            "storageUsed": 0,
            "storageLimit": 500 * 1024 * 1024,
            "plan": "free",
            "createdAt": now_iso,
        }

        user_id = await self.user_repo.insert(user_doc)
        self.logger.info("User registered successfully: %s (id: %s)", email, user_id)

        # Issue initial tokens and session
        access_token = create_access_token({"userId": user_id, "email": email})
        refresh_token = create_refresh_token({"userId": user_id, "email": email})
        session_id = None
        if request:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            session_id = await self.session_service.create_session(user_id, request, token_hash=token_hash)

        await self.audit_repo.log_event(user_id, "USER_REGISTER", "SUCCESS")

        return {
            "user_id": user_id,
            "email": email,
            "full_name": full_name,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "session_id": session_id,
            "is_email_verified": False,
            "email_verification_token": verification_token,
        }

    async def verify_email(self, token: str) -> Dict[str, Any]:
        """Verifies email via registration token."""
        user = await self.users_col.find_one({"emailVerificationToken": token})
        if not user:
            raise ValidationError("Invalid or expired email verification token.")

        await self.users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"isEmailVerified": True}, "$unset": {"emailVerificationToken": ""}},
        )
        return {"success": True, "message": "Email verified successfully."}

    async def login(
        self, email: str, password: str, request: Optional[Request] = None
    ) -> Dict[str, Any]:
        client_ip = request.client.host if request and request.client else "unknown"
        user = await self.user_repo.get_by_email(email)
        if not user or not verify_secret(password, user.get("password", "")):
            self.logger.warning("Failed login attempt for email: %s from IP %s", email, client_ip)
            raise UnauthorizedError("Invalid email or password")

        user_id = str(user.get("id") or user.get("_id"))

        # Check if MFA is required
        if user.get("twoFactorEnabled"):
            self.logger.info("MFA challenge triggered for user %s (%s)", user_id, user.get("twoFactorType", "TOTP"))
            return {
                "mfa_required": True,
                "user_id": user_id,
                "mfa_type": user.get("twoFactorType", "TOTP"),
                "email": user["email"],
            }

        now_iso = datetime.now(timezone.utc).isoformat()
        await self.user_repo.update_last_active(user_id, now_iso)

        access_token = create_access_token({"userId": user_id, "email": user["email"]})
        refresh_token = create_refresh_token({"userId": user_id, "email": user["email"]})

        session_id = None
        if request:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            session_id = await self.session_service.create_session(user_id, request, token_hash=token_hash)

        await self.audit_repo.log_event(user_id, "USER_LOGIN", "SUCCESS", ip_address=client_ip)

        return {
            "mfa_required": False,
            "user_id": user_id,
            "email": user["email"],
            "full_name": user.get("fullName"),
            "access_token": access_token,
            "refresh_token": refresh_token,
            "session_id": session_id,
        }

    async def complete_mfa_login(
        self, user_id: str, code: str, is_recovery: bool = False, request: Optional[Request] = None
    ) -> Dict[str, Any]:
        """Verifies MFA challenge and completes session initialization."""
        if is_recovery:
            await self.mfa_service.verify_recovery_code(user_id, code)
        else:
            await self.mfa_service.verify_totp(user_id, code)

        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)

        now_iso = datetime.now(timezone.utc).isoformat()
        await self.user_repo.update_last_active(user_id, now_iso)

        access_token = create_access_token({"userId": user_id, "email": user["email"]})
        refresh_token = create_refresh_token({"userId": user_id, "email": user["email"]})

        session_id = None
        if request:
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            session_id = await self.session_service.create_session(user_id, request, token_hash=token_hash)

        await self.audit_repo.log_event(user_id, "MFA_LOGIN", "SUCCESS")

        return {
            "mfa_required": False,
            "user_id": user_id,
            "email": user["email"],
            "full_name": user.get("fullName"),
            "access_token": access_token,
            "refresh_token": refresh_token,
            "session_id": session_id,
        }

    async def rotate_refresh_token(
        self, old_refresh_token: str, request: Optional[Request] = None
    ) -> Dict[str, str]:
        """
        Validates refresh token, invalidates old token record in session,
        and returns a newly minted access & refresh token pair.
        """
        payload = decode_token(old_refresh_token)
        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type for refresh")

        user_id = payload.get("userId")
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise UnauthorizedError("User no longer exists")

        # Rotate: generate new pair
        new_access = create_access_token({"userId": user_id, "email": user["email"]})
        new_refresh = create_refresh_token({"userId": user_id, "email": user["email"]})

        # Update session with new token hash
        old_hash = hashlib.sha256(old_refresh_token.encode()).hexdigest()
        new_hash = hashlib.sha256(new_refresh.encode()).hexdigest()
        now_iso = datetime.now(timezone.utc).isoformat()

        await self.sessions_col.update_one(
            {"userId": user_id, "tokenHash": old_hash, "status": "ACTIVE"},
            {"$set": {"tokenHash": new_hash, "lastSeen": now_iso}},
        )

        return {"access_token": new_access, "refresh_token": new_refresh}

    async def logout(self, session_id: Optional[str] = None, user_id: Optional[str] = None) -> None:
        if session_id and user_id:
            await self.session_service.terminate_session(user_id, session_id)
        elif user_id:
            # Terminate most recent active session
            await self.sessions_col.update_many(
                {"userId": user_id, "status": "ACTIVE"},
                {"$set": {"status": "TERMINATED", "terminatedAt": datetime.now(timezone.utc).isoformat()}},
            )

    async def logout_all(self, user_id: str, except_session_id: Optional[str] = None) -> int:
        if except_session_id:
            return await self.session_service.terminate_all_other_sessions(user_id, except_session_id)
        else:
            res = await self.sessions_col.update_many(
                {"userId": user_id, "status": "ACTIVE"},
                {"$set": {"status": "TERMINATED", "terminatedAt": datetime.now(timezone.utc).isoformat()}},
            )
            return res.modified_count

    async def change_password(self, user_id: str, current_password: str, new_password: str) -> None:
        user = await self.user_repo.find_by_id(user_id)
        if not user or not verify_secret(current_password, user.get("password", "")):
            raise UnauthorizedError("Current password is incorrect")

        if len(new_password) < 8:
            raise ValidationError("New password must be at least 8 characters long")

        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        await self.users_col.update_one(query, {"$set": {"password": hash_secret(new_password)}})
        self.logger.info("Password changed for user %s", user_id)
        await self.audit_repo.log_event(user_id, "PASSWORD_CHANGE", "SUCCESS")

    async def forgot_password(self, email: str) -> Dict[str, Any]:
        user = await self.user_repo.get_by_email(email)
        if not user:
            # Mask presence to prevent user enumeration
            return {"message": "If this email is registered, password reset instructions have been sent."}

        reset_token = secrets.token_urlsafe(32)
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        await self.users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"resetToken": reset_token, "resetTokenExpiresAt": expire.isoformat()}},
        )

        # Send reset email
        html = f"""
        <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
            <h2 style="color:#7c3aed;">🔐 SecureVault Password Reset</h2>
            <p>You requested a password reset. Your temporary reset token is:</p>
            <p style="font-family:monospace;background:#f1f5f9;padding:12px;border-radius:6px;font-size:16px;">{reset_token}</p>
            <p style="color:#64748b;font-size:12px;">This token expires in 15 minutes. If you did not make this request, please secure your account immediately.</p>
        </div>
        """
        await send_email(user["email"], "SecureVault — Password Reset Token", html)
        return {"message": "If this email is registered, password reset instructions have been sent."}

    async def reset_password(self, token: str, new_password: str) -> Dict[str, Any]:
        if len(new_password) < 8:
            raise ValidationError("Password must be at least 8 characters long.")

        user = await self.users_col.find_one({"resetToken": token})
        if not user:
            raise ValidationError("Invalid or expired reset token.")

        exp_str = user.get("resetTokenExpiresAt")
        if exp_str:
            exp_dt = datetime.fromisoformat(exp_str)
            if datetime.now(timezone.utc) > exp_dt:
                raise ValidationError("Password reset token has expired.")

        await self.users_col.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"password": hash_secret(new_password)},
                "$unset": {"resetToken": "", "resetTokenExpiresAt": ""},
            },
        )
        return {"success": True, "message": "Password has been successfully updated. You may now log in."}

    async def verify_pin(self, user_id: str, plain_pin: str) -> bool:
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise UnauthorizedError("User not found")
        hashed_pin = user.get("pin")
        if not hashed_pin or not verify_secret(plain_pin, hashed_pin):
            raise UnauthorizedError("Incorrect Secondary PIN")
        return True
