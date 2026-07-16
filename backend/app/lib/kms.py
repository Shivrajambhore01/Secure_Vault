"""
Software Key Management Service (KMS) — SecureVault Enterprise

Provides a simulated Hardware Security Module (HSM) style key management system.
In production, this would be replaced by AWS KMS, Azure Key Vault, or HashiCorp Vault.

Key Management Features:
  1. Key Generation — per-user and per-vault key material
  2. Key Storage     — encrypted key metadata in MongoDB (never raw keys in DB)
  3. Key Rotation    — generate new key version while maintaining decrypt ability
  4. Key Revocation  — mark key as revoked, preventing any future decryption
  5. Key Audit Trail — every key operation logged immutably

Key Hierarchy:
  Master Encryption Key (MEK)  → from ENCRYPTION_KEY env config
       ↓ wraps
  Key Encryption Key (KEK)     → per-user, derived via HKDF
       ↓ wraps
  Data Encryption Key (DEK)    → per-vault/file, stored as wrapped blob in MongoDB

Collections:
  kms_keys — key metadata records (no raw key bytes stored)
  kms_audit — every key lifecycle event
"""

import secrets
import uuid
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from app.core.database import db
from app.lib.encryption import (
    generate_dek,
    wrap_dek,
    unwrap_dek,
    encrypt_gcm,
    decrypt_gcm,
)

logger = logging.getLogger("securevault.kms")

kms_keys_col = db["kms_keys"]
kms_audit_col = db["kms_audit"]


class KeyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ROTATED = "ROTATED"      # Superseded by a newer version but still decryptable
    REVOKED = "REVOKED"      # Permanently disabled — cannot decrypt


class KeyType(str, Enum):
    USER_KEK = "USER_KEK"    # Key Encryption Key — wraps vault DEKs
    VAULT_DEK = "VAULT_DEK"  # Data Encryption Key — encrypts vault content
    FILE_DEK = "FILE_DEK"    # Data Encryption Key — encrypts uploaded files


# ─────────────────────────────────────────────────────────────────────
# Internal Audit Helpers
# ─────────────────────────────────────────────────────────────────────

async def _kms_audit(
    key_id: str,
    operation: str,
    actor_id: str = "system",
    reason: str = "",
):
    await kms_audit_col.insert_one({
        "id": str(uuid.uuid4()),
        "keyId": key_id,
        "operation": operation,     # CREATED | WRAPPED | UNWRAPPED | ROTATED | REVOKED | VERIFIED
        "actorId": actor_id,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


# ─────────────────────────────────────────────────────────────────────
# Key Lifecycle Operations
# ─────────────────────────────────────────────────────────────────────

async def create_vault_dek(
    user_id: str,
    vault_id: str,
    actor_id: str = "system",
) -> str:
    """
    Generate a new DEK for a vault item and store its wrapped form.

    Returns the key_id that must be stored in the vault document metadata.
    The raw DEK is NEVER stored — only the wrapped (encrypted) form.
    """
    key_id = f"key_{secrets.token_hex(16)}"
    raw_dek = generate_dek()                    # Random 256-bit key
    wrapped = wrap_dek(raw_dek, user_id)        # Encrypt DEK with user's KEK

    await kms_keys_col.insert_one({
        "keyId": key_id,
        "keyType": KeyType.VAULT_DEK,
        "userId": user_id,
        "vaultId": vault_id,
        "wrappedDek": wrapped,                  # Encrypted DEK (safe to store)
        "algorithm": "AES-256-GCM",
        "version": 1,
        "status": KeyStatus.ACTIVE,
        "previousKeyId": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "rotatedAt": None,
        "revokedAt": None,
    })

    await _kms_audit(key_id, "CREATED", actor_id, f"New DEK for vault {vault_id}")
    logger.info("KMS: Created DEK key_id=%s for user=%s vault=%s", key_id, user_id, vault_id)
    return key_id


async def get_dek(key_id: str, user_id: str, actor_id: str = "system") -> bytes:
    """
    Retrieve and unwrap a DEK for decryption.
    Raises ValueError if key is revoked or not found.
    """
    key_rec = await kms_keys_col.find_one({"keyId": key_id})
    if not key_rec:
        raise ValueError(f"KMS: Key not found: {key_id}")

    if key_rec["status"] == KeyStatus.REVOKED:
        await _kms_audit(key_id, "UNWRAP_DENIED", actor_id, "Key is revoked")
        raise ValueError(f"KMS: Key {key_id} has been revoked and cannot be used for decryption.")

    if key_rec["userId"] != user_id:
        await _kms_audit(key_id, "UNWRAP_DENIED", actor_id, "User ID mismatch")
        raise PermissionError(f"KMS: Key {key_id} does not belong to user {user_id}")

    raw_dek = unwrap_dek(key_rec["wrappedDek"], user_id)
    await _kms_audit(key_id, "UNWRAPPED", actor_id)
    return raw_dek


async def rotate_dek(key_id: str, user_id: str, actor_id: str = "system") -> str:
    """
    Rotate an existing key by generating a new DEK version.
    The old key is marked ROTATED (not deleted) to allow decrypting legacy data.

    Returns the new key_id.
    """
    old_key = await kms_keys_col.find_one({"keyId": key_id})
    if not old_key:
        raise ValueError(f"KMS: Cannot rotate — key not found: {key_id}")
    if old_key["status"] == KeyStatus.REVOKED:
        raise ValueError(f"KMS: Cannot rotate a revoked key: {key_id}")

    # Generate new version
    new_key_id = f"key_{secrets.token_hex(16)}"
    new_dek = generate_dek()
    new_wrapped = wrap_dek(new_dek, user_id)
    now = datetime.now(timezone.utc).isoformat()

    # Mark old key as ROTATED
    await kms_keys_col.update_one(
        {"keyId": key_id},
        {"$set": {"status": KeyStatus.ROTATED, "rotatedAt": now}},
    )

    # Insert new key record
    await kms_keys_col.insert_one({
        "keyId": new_key_id,
        "keyType": old_key["keyType"],
        "userId": user_id,
        "vaultId": old_key.get("vaultId"),
        "wrappedDek": new_wrapped,
        "algorithm": "AES-256-GCM",
        "version": old_key.get("version", 1) + 1,
        "status": KeyStatus.ACTIVE,
        "previousKeyId": key_id,       # Points back to old key for audit trail
        "createdAt": now,
        "rotatedAt": None,
        "revokedAt": None,
    })

    await _kms_audit(key_id, "ROTATED", actor_id, f"Rotated to new key {new_key_id}")
    await _kms_audit(new_key_id, "CREATED", actor_id, f"Rotation from {key_id}")
    logger.info("KMS: Rotated key %s → new key %s", key_id, new_key_id)
    return new_key_id


async def revoke_key(key_id: str, actor_id: str = "system", reason: str = "") -> None:
    """
    Permanently revoke a key. This prevents any future unwrapping.
    All vault data encrypted with this key becomes inaccessible.
    This is an irreversible operation — use with extreme caution.
    """
    key_rec = await kms_keys_col.find_one({"keyId": key_id})
    if not key_rec:
        raise ValueError(f"KMS: Cannot revoke — key not found: {key_id}")

    await kms_keys_col.update_one(
        {"keyId": key_id},
        {"$set": {
            "status": KeyStatus.REVOKED,
            "revokedAt": datetime.now(timezone.utc).isoformat(),
            "revokedBy": actor_id,
            "revokeReason": reason,
        }},
    )
    await _kms_audit(key_id, "REVOKED", actor_id, reason or "No reason provided")
    logger.warning("KMS: Key REVOKED key_id=%s by actor=%s reason=%s", key_id, actor_id, reason)


async def get_key_metadata(key_id: str) -> Optional[dict]:
    """Return key metadata (without the wrapped DEK bytes)."""
    rec = await kms_keys_col.find_one({"keyId": key_id}, {"wrappedDek": 0, "_id": 0})
    return rec


async def list_user_keys(user_id: str) -> list[dict]:
    """List all key metadata for a user (no raw DEK values)."""
    cursor = kms_keys_col.find({"userId": user_id}, {"wrappedDek": 0, "_id": 0})
    return await cursor.to_list(length=None)


async def get_kms_audit_trail(key_id: str) -> list[dict]:
    """Return the full audit trail for a key."""
    cursor = kms_audit_col.find({"keyId": key_id}, {"_id": 0}).sort("timestamp", 1)
    return await cursor.to_list(length=None)
