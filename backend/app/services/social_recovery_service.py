"""
Social Recovery & Emergency Escrow Service (Shamir's Secret Sharing) — SecureVault Enterprise
Phase 11:
- Cryptographic threshold key splitting via Shamir's Secret Sharing (k-of-n)
- Guardian shard distribution and tokenized submission
- 72-hour emergency timelock escrow before final key reconstitution
- Vault owner 1-click abort protection
"""

import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field

from app.core.database import db as default_db
from app.domain.exceptions import NotFoundError, ValidationError, ForbiddenError

# 257-bit prime modulus strictly greater than 2^256 (2^256 + 297)
PRIME_MODULUS = 115792089237316195423570985008687907853269984665640564039457584007913129640233


class GuardianContact(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    relationship: str = Field(default="TRUSTED_GUARDIAN")
    phone: Optional[str] = None


class SocialRecoverySetupRequest(BaseModel):
    threshold_k: int = Field(default=3, ge=2, le=10, description="Minimum shards required to reconstruct")
    total_shards_n: int = Field(default=5, ge=2, le=10, description="Total number of guardian shares")
    guardians: List[GuardianContact] = Field(..., min_length=2)


class RecoveryClaimInitiateRequest(BaseModel):
    target_email: EmailStr
    claimant_name: str
    claimant_notes: Optional[str] = "Emergency credential loss recovery initiated"


class SubmitShardRequest(BaseModel):
    shard_string: str
    guardian_identifier: Optional[str] = None


class SocialRecoveryService:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self.db = db if db is not None else default_db

    # --- Shamir's Secret Sharing (SSS) Mathematics ---

    @classmethod
    def split_secret(cls, secret_hex: str, k: int, n: int) -> List[str]:
        """
        Split a 256-bit hexadecimal secret into n shares with a reconstruction threshold of k.
        Returns formatted shard strings: secshard-<index>-<x_hex>-<y_hex>
        """
        if k > n or k < 2:
            raise ValidationError(f"Invalid threshold parameters: k={k} must be <= n={n} and >= 2.")

        secret_int = int(secret_hex, 16)
        if secret_int >= PRIME_MODULUS:
            raise ValidationError("Secret integer exceeds prime field size.")

        # Generate k - 1 random polynomial coefficients: f(x) = S + a1*x + a2*x^2 + ... + ak-1*x^(k-1)
        coefficients = [secret_int] + [
            secrets.randbelow(PRIME_MODULUS - 1) + 1 for _ in range(k - 1)
        ]

        shards = []
        for x in range(1, n + 1):
            # Evaluate polynomial at x
            y = 0
            x_pow = 1
            for coeff in coefficients:
                y = (y + coeff * x_pow) % PRIME_MODULUS
                x_pow = (x_pow * x) % PRIME_MODULUS

            shard_str = f"secshard-{x:02d}-{x:x}-{y:x}"
            shards.append(shard_str)

        return shards

    @classmethod
    def parse_shard(cls, shard_str: str) -> Tuple[int, int]:
        """Parse shard string 'secshard-<idx>-<x_hex>-<y_hex>' into (x, y) integers."""
        parts = shard_str.strip().split("-")
        if len(parts) != 4 or parts[0] != "secshard":
            raise ValidationError("Malformed shard format. Must be secshard-<index>-<x>-<y>.")
        try:
            x = int(parts[2], 16)
            y = int(parts[3], 16)
            return x, y
        except Exception:
            raise ValidationError("Invalid hexadecimal characters in shard payload.")

    @classmethod
    def reconstruct_secret(cls, shard_strings: List[str]) -> str:
        """
        Reconstruct the secret using Lagrange polynomial interpolation at x = 0.
        Requires at least k valid distinct shards.
        """
        points = []
        seen_x = set()
        for s in shard_strings:
            x, y = cls.parse_shard(s)
            if x in seen_x:
                continue  # ignore duplicate shares
            seen_x.add(x)
            points.append((x, y))

        if len(points) < 2:
            raise ValidationError("At least 2 distinct shards are required to attempt reconstruction.")

        secret = 0
        p = PRIME_MODULUS

        for i, (xi, yi) in enumerate(points):
            # Compute Lagrange basis polynomial L_i(0) = product_{j != i} (-xj) / (xi - xj)
            num = 1
            den = 1
            for j, (xj, _) in enumerate(points):
                if i != j:
                    num = (num * (-xj)) % p
                    den = (den * (xi - xj)) % p

            # Modular inverse of denominator: den^(p-2) mod p (Fermat's Little Theorem)
            inv_den = pow(den, p - 2, p)
            li = (num * inv_den) % p
            secret = (secret + yi * li) % p

        # Convert back to 64-character (32-byte) hex
        recovered_hex = f"{secret:064x}"
        return recovered_hex

    # --- Social Recovery Workflows ---

    async def setup_social_recovery(
        self,
        user_id: str,
        payload: SocialRecoverySetupRequest,
    ) -> Dict[str, Any]:
        """Configure Shamir social recovery, split master recovery key, and assign guardians."""
        if len(payload.guardians) != payload.total_shards_n:
            raise ValidationError(
                f"Number of guardians ({len(payload.guardians)}) must match total shards n ({payload.total_shards_n})."
            )

        now = datetime.now(timezone.utc).isoformat()
        master_recovery_key = secrets.token_hex(32)

        # Split secret
        shards = self.split_secret(
            secret_hex=master_recovery_key,
            k=payload.threshold_k,
            n=payload.total_shards_n,
        )

        config_id = f"socrec_{uuid.uuid4().hex[:12]}"

        # Archive any previous configs
        await self.db.social_recovery_configs.update_many(
            {"userId": user_id, "status": "ACTIVE"},
            {"$set": {"status": "SUPERSEDED", "updatedAt": now}}
        )

        # Save guardian records with assigned shards
        guardian_records = []
        for idx, (guardian, shard_str) in enumerate(zip(payload.guardians, shards)):
            guardian_id = f"guard_{uuid.uuid4().hex[:10]}"
            guardian_doc = {
                "id": guardian_id,
                "configId": config_id,
                "userId": user_id,
                "name": guardian.name,
                "email": str(guardian.email).lower(),
                "relationship": guardian.relationship,
                "phone": guardian.phone,
                "shardIndex": idx + 1,
                "shardValue": shard_str,  # in real production, encrypted with guardian's public key
                "createdAt": now,
            }
            await self.db.recovery_shards.insert_one(guardian_doc)
            guardian_records.append({
                "id": guardian_id,
                "name": guardian.name,
                "email": str(guardian.email).lower(),
                "relationship": guardian.relationship,
                "shardIndex": idx + 1,
            })

        config_doc = {
            "id": config_id,
            "userId": user_id,
            "thresholdK": payload.threshold_k,
            "totalShardsN": payload.total_shards_n,
            "guardians": guardian_records,
            "status": "ACTIVE",
            "createdAt": now,
            "updatedAt": now,
        }
        await self.db.social_recovery_configs.insert_one(config_doc)

        # Audit log
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "SETUP_SOCIAL_RECOVERY",
            "resource": "RECOVERY",
            "resourceId": config_id,
            "details": {
                "thresholdK": payload.threshold_k,
                "totalShardsN": payload.total_shards_n,
                "guardianCount": len(guardian_records),
            },
            "timestamp": now,
        })

        config_doc.pop("_id", None)
        # Return summary along with one-time master recovery key confirmation
        return {
            "config": config_doc,
            "master_recovery_key": master_recovery_key,
            "message": f"Successfully configured {payload.threshold_k}-of-{payload.total_shards_n} Shamir recovery scheme.",
        }

    async def get_social_recovery_config(self, user_id: str) -> Dict[str, Any]:
        """Retrieve active social recovery configuration."""
        config = await self.db.social_recovery_configs.find_one({"userId": user_id, "status": "ACTIVE"})
        if not config:
            return {"configured": False, "message": "Social recovery has not been configured."}
        config.pop("_id", None)
        return {"configured": True, "config": config}

    async def initiate_recovery_case(
        self,
        payload: RecoveryClaimInitiateRequest,
    ) -> Dict[str, Any]:
        """Initiate emergency account recovery case for a locked user."""
        target_user = await self.db.users.find_one({"email": str(payload.target_email).lower()})
        if not target_user:
            raise NotFoundError("User", payload.target_email)

        user_id = str(target_user.get("id") or target_user.get("_id"))
        config = await self.db.social_recovery_configs.find_one({"userId": user_id, "status": "ACTIVE"})
        if not config:
            raise ValidationError("The specified account has not configured social guardian recovery.")

        now = datetime.now(timezone.utc).isoformat()
        case_id = f"reccase_{uuid.uuid4().hex[:12]}"
        case_number = f"REC-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:6].upper()}"

        case_doc = {
            "id": case_id,
            "caseNumber": case_number,
            "userId": user_id,
            "targetEmail": str(payload.target_email).lower(),
            "claimantName": payload.claimant_name,
            "claimantNotes": payload.claimant_notes,
            "thresholdK": config["thresholdK"],
            "totalShardsN": config["totalShardsN"],
            "submittedShards": [],
            "status": "COLLECTING_SHARDS",  # COLLECTING_SHARDS | ESCROW_TIMELOCK | RECOVERED | ABORTED_BY_OWNER
            "timelockHours": 72,
            "timelockEndsAt": None,
            "reconstructedKey": None,
            "createdAt": now,
            "updatedAt": now,
        }

        await self.db.account_recovery_cases.insert_one(case_doc)

        # Notify owner with 1-click abort link in audit
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "INITIATE_ACCOUNT_RECOVERY",
            "resource": "RECOVERY",
            "resourceId": case_id,
            "details": {
                "caseNumber": case_number,
                "claimantName": payload.claimant_name,
            },
            "timestamp": now,
        })

        case_doc.pop("_id", None)
        return case_doc

    async def submit_recovery_shard(
        self,
        case_id: str,
        payload: SubmitShardRequest,
    ) -> Dict[str, Any]:
        """Submit a guardian recovery shard towards the threshold."""
        case = await self.db.account_recovery_cases.find_one({"id": case_id})
        if not case:
            raise NotFoundError("RecoveryCase", case_id)

        if case["status"] in ["ABORTED_BY_OWNER", "RECOVERED"]:
            raise ValidationError(f"Cannot submit shard. Case is {case['status']}.")

        # Validate shard syntax
        self.parse_shard(payload.shard_string)

        submitted = case.get("submittedShards", [])
        if payload.shard_string in submitted:
            raise ValidationError("This shard has already been submitted to the case.")

        submitted.append(payload.shard_string)
        threshold_k = case["thresholdK"]
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        update_fields: Dict[str, Any] = {
            "submittedShards": submitted,
            "updatedAt": now_iso,
        }

        # Check if threshold k is satisfied
        reconstructed = None
        if len(submitted) >= threshold_k:
            # Attempt mathematical reconstruction
            reconstructed = self.reconstruct_secret(submitted)
            # Engage 72-Hour Timelock Escrow
            timelock_end = (now + timedelta(hours=72)).isoformat()
            update_fields["status"] = "ESCROW_TIMELOCK"
            update_fields["timelockEndsAt"] = timelock_end
            update_fields["reconstructedKey"] = reconstructed

        await self.db.account_recovery_cases.update_one(
            {"id": case_id},
            {"$set": update_fields}
        )

        return {
            "caseId": case_id,
            "caseNumber": case["caseNumber"],
            "shardsSubmitted": len(submitted),
            "thresholdK": threshold_k,
            "status": update_fields.get("status", case["status"]),
            "thresholdReached": len(submitted) >= threshold_k,
            "timelockEndsAt": update_fields.get("timelockEndsAt"),
        }

    async def cancel_recovery(
        self,
        user_id: str,
        case_id: str,
        reason: str = "Vault owner aborted unauthorized recovery attempt",
    ) -> Dict[str, Any]:
        """Vault owner 1-click abort action that instantly cancels recovery."""
        case = await self.db.account_recovery_cases.find_one({"id": case_id, "userId": user_id})
        if not case:
            raise NotFoundError("RecoveryCase", case_id)

        now = datetime.now(timezone.utc).isoformat()
        await self.db.account_recovery_cases.update_one(
            {"id": case_id},
            {
                "$set": {
                    "status": "ABORTED_BY_OWNER",
                    "abortReason": reason,
                    "abortedAt": now,
                    "updatedAt": now,
                    "reconstructedKey": None,  # scrub reconstructed secret
                }
            }
        )

        # Audit log
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "ABORT_ACCOUNT_RECOVERY",
            "resource": "RECOVERY",
            "resourceId": case_id,
            "details": {"reason": reason},
            "timestamp": now,
        })

        return {
            "success": True,
            "caseId": case_id,
            "status": "ABORTED_BY_OWNER",
            "message": "Account recovery aborted immediately. Master key remains safe.",
        }

    async def get_recovery_case_status(self, case_id: str) -> Dict[str, Any]:
        """Get live status and timelock countdown of a recovery case."""
        case = await self.db.account_recovery_cases.find_one({"id": case_id})
        if not case:
            raise NotFoundError("RecoveryCase", case_id)

        case.pop("_id", None)
        # Hide raw reconstructed key in public status query
        if case.get("reconstructedKey") and case.get("status") != "RECOVERED":
            case["reconstructedKey"] = "REDACTED_DURING_TIMELOCK"

        return case

    async def finalize_recovery(self, case_id: str) -> Dict[str, Any]:
        """Finalize recovery after 72-hour timelock has elapsed."""
        case = await self.db.account_recovery_cases.find_one({"id": case_id})
        if not case:
            raise NotFoundError("RecoveryCase", case_id)

        if case.get("status") == "ABORTED_BY_OWNER":
            raise ForbiddenError("Recovery was aborted by the vault owner.")

        if case.get("status") != "ESCROW_TIMELOCK":
            raise ValidationError("Recovery case is not in ESCROW_TIMELOCK status.")

        timelock_ends_at = case.get("timelockEndsAt")
        if timelock_ends_at:
            end_dt = datetime.fromisoformat(timelock_ends_at.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) < end_dt:
                time_left = (end_dt - datetime.now(timezone.utc)).total_seconds()
                hours_left = int(time_left // 3600)
                raise ForbiddenError(f"72-hour security timelock is still active ({hours_left} hours remaining).")

        now = datetime.now(timezone.utc).isoformat()
        await self.db.account_recovery_cases.update_one(
            {"id": case_id},
            {"$set": {"status": "RECOVERED", "finalizedAt": now, "updatedAt": now}}
        )

        return {
            "success": True,
            "caseId": case_id,
            "status": "RECOVERED",
            "message": "Account recovery verified. Vault access credentials unlocked.",
        }
