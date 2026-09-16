"""
Multi-Factor Authentication (MFA) Service — SecureVault Enterprise
Supports RFC 6238 TOTP Authenticator Apps, 10 Single-Use Recovery Codes, SMS OTP, and Email OTP.
"""

import pyotp
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId

from app.core.database import db
from app.domain.exceptions import NotFoundError, UnauthorizedError, ValidationError
from app.security.hashing import hash_secret, verify_secret
from app.services.base import BaseService
from app.lib.notifications import send_otp_email


class MfaService(BaseService):
    def __init__(self):
        super().__init__()
        self.users_col = db["users"]
        self.mfa_col = db["mfa_methods"]

    async def setup_totp(self, user_id: str) -> Dict[str, str]:
        """Generate a new TOTP secret and return the secret key and otpauth provisioning URI."""
        user = await self.users_col.find_one({"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id})
        if not user:
            raise NotFoundError("User", user_id)

        secret = pyotp.random_base32()
        email = user.get("email", "user@securevault.app")
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(name=email, issuer_name="SecureVault")

        # Save pending secret temporarily
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        await self.users_col.update_one(query, {"$set": {"pendingTotpSecret": secret}})

        return {
            "secret": secret,
            "provisioning_uri": provisioning_uri,
            "issuer": "SecureVault",
            "account": email,
        }

    async def enable_totp(self, user_id: str, code: str) -> Dict[str, Any]:
        """Verify the test TOTP code against the pending secret and activate TOTP MFA."""
        user = await self.users_col.find_one({"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id})
        if not user:
            raise NotFoundError("User", user_id)

        pending_secret = user.get("pendingTotpSecret")
        if not pending_secret:
            raise ValidationError("No pending TOTP setup found. Please initiate setup first.")

        totp = pyotp.TOTP(pending_secret)
        if not totp.verify(code, valid_window=1):
            raise UnauthorizedError("Invalid TOTP verification code. Please check your authenticator app.")

        # Generate 10 backup recovery codes
        raw_recovery_codes, hashed_recovery_codes = self._generate_recovery_codes_pair()

        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        await self.users_col.update_one(
            query,
            {
                "$set": {
                    "twoFactorEnabled": True,
                    "twoFactorType": "TOTP",
                    "twoFactorSecret": pending_secret,
                    "recoveryCodes": hashed_recovery_codes,
                    "twoFactorEnabledAt": datetime.now(timezone.utc).isoformat(),
                },
                "$unset": {"pendingTotpSecret": ""},
            },
        )

        self.logger.info("TOTP MFA successfully enabled for user %s", user_id)
        return {
            "enabled": True,
            "message": "Two-Factor Authentication is now active.",
            "recovery_codes": raw_recovery_codes,
        }

    async def disable_mfa(self, user_id: str, password_or_code: str) -> Dict[str, Any]:
        """Disable MFA after verifying account password or current TOTP code."""
        user = await self.users_col.find_one({"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id})
        if not user:
            raise NotFoundError("User", user_id)

        # Allow either password or valid TOTP code to disable
        verified = False
        if verify_secret(password_or_code, user.get("password", "")):
            verified = True
        elif user.get("twoFactorSecret"):
            totp = pyotp.TOTP(user["twoFactorSecret"])
            if totp.verify(password_or_code, valid_window=1):
                verified = True

        if not verified:
            raise UnauthorizedError("Invalid credentials. Cannot disable MFA.")

        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        await self.users_col.update_one(
            query,
            {
                "$set": {"twoFactorEnabled": False},
                "$unset": {
                    "twoFactorType": "",
                    "twoFactorSecret": "",
                    "recoveryCodes": "",
                },
            },
        )
        self.logger.info("MFA disabled for user %s", user_id)
        return {"enabled": False, "message": "Two-Factor Authentication has been disabled."}

    async def verify_totp(self, user_id: str, code: str) -> bool:
        """Verify an incoming TOTP code during login."""
        user = await self.users_col.find_one({"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id})
        if not user or not user.get("twoFactorSecret"):
            raise UnauthorizedError("MFA is not configured for this account")

        totp = pyotp.TOTP(user["twoFactorSecret"])
        if not totp.verify(code, valid_window=1):
            raise UnauthorizedError("Invalid MFA verification code")
        return True

    async def verify_recovery_code(self, user_id: str, code: str) -> bool:
        """Verify and burn a single-use backup recovery code."""
        user = await self.users_col.find_one({"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id})
        if not user:
            raise NotFoundError("User", user_id)

        hashed_codes: List[str] = user.get("recoveryCodes", [])
        matched_hash = None
        for h in hashed_codes:
            if verify_secret(code.strip(), h):
                matched_hash = h
                break

        if not matched_hash:
            raise UnauthorizedError("Invalid or already-used recovery code.")

        # Burn the code (remove from active list)
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        await self.users_col.update_one(query, {"$pull": {"recoveryCodes": matched_hash}})
        self.logger.warning("Recovery code burned for user %s (%d remaining)", user_id, len(hashed_codes) - 1)
        return True

    async def regenerate_recovery_codes(self, user_id: str) -> List[str]:
        """Regenerate a fresh set of 10 backup codes."""
        raw_codes, hashed_codes = self._generate_recovery_codes_pair()
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        await self.users_col.update_one(query, {"$set": {"recoveryCodes": hashed_codes}})
        return raw_codes

    def _generate_recovery_codes_pair(self) -> tuple[List[str], List[str]]:
        raw_codes = [secrets.token_hex(4).upper() for _ in range(10)]  # e.g., 'A1B2C3D4'
        hashed_codes = [hash_secret(c) for c in raw_codes]
        return raw_codes, hashed_codes
