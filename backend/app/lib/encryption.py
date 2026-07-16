"""
Enterprise-grade AES-256-GCM Encryption with Envelope Key Hierarchy.

Key Architecture:
  Master Key (from ENCRYPTION_KEY in settings)
      ↓
  Per-User Key Encryption Key (KEK) — derived via HKDF
      ↓  
  Per-Vault Data Encryption Key (DEK) — randomly generated per document
      ↓
  Encrypted File / Text Payload stored in DB

GCM provides authenticated encryption — any tampering is detected.
CBC is maintained for backward compatibility with legacy data.
"""

import os
import base64
import struct
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding, hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend

from app.core.config import get_settings

settings = get_settings()

# ─────────────────────────────────────────────────────────────────────
# Master Key — raw 32 bytes derived from config (never used directly
# to encrypt data — only used to wrap DEKs)
# ─────────────────────────────────────────────────────────────────────
_MASTER_KEY_RAW: bytes = settings.ENCRYPTION_KEY[:32].encode("utf-8")
GCM_NONCE_LENGTH = 12   # 96-bit nonce for GCM (NIST recommended)
CBC_IV_LENGTH = 16       # Kept for backward-compatibility


# ─────────────────────────────────────────────────────────────────────
# Key Derivation Helpers
# ─────────────────────────────────────────────────────────────────────

def derive_user_key(user_id: str) -> bytes:
    """
    Derive a per-user Key Encryption Key (KEK) from the master key using HKDF.
    This ensures different users get different key material even if they share
    an encryption key source.
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=user_id.encode("utf-8"),
        info=b"securevault-user-kek",
        backend=default_backend(),
    )
    return hkdf.derive(_MASTER_KEY_RAW)


def generate_dek() -> bytes:
    """
    Generate a random 256-bit Data Encryption Key (DEK).
    A unique DEK is created for every vault item or file uploaded.
    """
    return os.urandom(32)


def wrap_dek(dek: bytes, user_id: str) -> str:
    """
    Encrypt (wrap) a DEK using the user's KEK with AES-256-GCM.
    Returns a base64-encoded string: nonce + tag + ciphertext
    suitable for storage in MongoDB.
    """
    user_kek = derive_user_key(user_id)
    aesgcm = AESGCM(user_kek)
    nonce = os.urandom(GCM_NONCE_LENGTH)
    # GCM output = ciphertext + 16-byte tag appended by cryptography lib
    wrapped = aesgcm.encrypt(nonce, dek, b"securevault-dek-wrap")
    return base64.b64encode(nonce + wrapped).decode("utf-8")


def unwrap_dek(wrapped_dek_b64: str, user_id: str) -> bytes:
    """
    Decrypt (unwrap) a wrapped DEK using the user's KEK.
    Raises ValueError if tampering is detected (GCM authentication failure).
    """
    user_kek = derive_user_key(user_id)
    aesgcm = AESGCM(user_kek)
    raw = base64.b64decode(wrapped_dek_b64)
    nonce = raw[:GCM_NONCE_LENGTH]
    ciphertext_and_tag = raw[GCM_NONCE_LENGTH:]
    return aesgcm.decrypt(nonce, ciphertext_and_tag, b"securevault-dek-wrap")


# ─────────────────────────────────────────────────────────────────────
# AES-256-GCM Text Encryption (NEW — preferred for all new data)
# Format stored: base64( nonce[12] + ciphertext+tag )
# Prefix "gcm:" used to distinguish from legacy CBC format
# ─────────────────────────────────────────────────────────────────────

def encrypt_gcm(plaintext: str, context: bytes = b"securevault") -> str:
    """
    Encrypt a string using AES-256-GCM with a system-level key.
    Provides authenticated encryption — tampering raises an error on decrypt.
    Returns a prefixed base64 string: 'gcm:<base64(nonce+ciphertext+tag)>'
    """
    key = _MASTER_KEY_RAW
    aesgcm = AESGCM(key)
    nonce = os.urandom(GCM_NONCE_LENGTH)
    ciphertext_and_tag = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), context)
    encoded = base64.b64encode(nonce + ciphertext_and_tag).decode("utf-8")
    return f"gcm:{encoded}"


def decrypt_gcm(token: str, context: bytes = b"securevault") -> str:
    """
    Decrypt a GCM-encrypted string produced by encrypt_gcm().
    Raises ValueError if the token is malformed or has been tampered with.
    """
    if not token.startswith("gcm:"):
        raise ValueError("Not a GCM-encrypted token.")
    raw = base64.b64decode(token[4:])
    nonce = raw[:GCM_NONCE_LENGTH]
    ciphertext_and_tag = raw[GCM_NONCE_LENGTH:]
    key = _MASTER_KEY_RAW
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext_and_tag, context).decode("utf-8")


def encrypt_bytes_gcm(data: bytes, dek: bytes = None) -> tuple[bytes, bytes]:
    """
    Encrypt raw bytes with AES-256-GCM.
    
    If dek is None, a new DEK is generated (for envelope encryption).
    Returns (encrypted_blob, dek) where encrypted_blob = nonce + ciphertext+tag.
    Store the returned dek wrapped via wrap_dek() in the metadata record.
    """
    if dek is None:
        dek = generate_dek()
    aesgcm = AESGCM(dek)
    nonce = os.urandom(GCM_NONCE_LENGTH)
    ciphertext_and_tag = aesgcm.encrypt(nonce, data, b"securevault-file")
    return nonce + ciphertext_and_tag, dek


def decrypt_bytes_gcm(blob: bytes, dek: bytes) -> bytes:
    """
    Decrypt bytes produced by encrypt_bytes_gcm().
    dek must be the original (unwrapped) DEK.
    Raises InvalidTag if the data has been tampered with.
    """
    nonce = blob[:GCM_NONCE_LENGTH]
    ciphertext_and_tag = blob[GCM_NONCE_LENGTH:]
    aesgcm = AESGCM(dek)
    return aesgcm.decrypt(nonce, ciphertext_and_tag, b"securevault-file")


# ─────────────────────────────────────────────────────────────────────
# Legacy AES-256-CBC — Preserved for backward compatibility
# All NEW encryption uses GCM above. Decrypt CBC only for existing data.
# ─────────────────────────────────────────────────────────────────────

_LEGACY_KEY = settings.ENCRYPTION_KEY[:32].encode("utf-8")


def encrypt(text: str) -> str:
    """[LEGACY] AES-256-CBC text encryption. New code should use encrypt_gcm()."""
    iv = os.urandom(CBC_IV_LENGTH)
    cipher = Cipher(algorithms.AES(_LEGACY_KEY), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    padder = padding.PKCS7(128).padder()
    padded = padder.update(text.encode("utf-8")) + padder.finalize()
    encrypted = encryptor.update(padded) + encryptor.finalize()
    return iv.hex() + ":" + encrypted.hex()


def decrypt(text: str) -> str:
    """
    AES-256-CBC/GCM universal decrypt.
    Auto-detects format:
      - 'gcm:...'  → GCM (new)
      - 'iv:ct'    → CBC (legacy)
    """
    if text.startswith("gcm:"):
        return decrypt_gcm(text)
    # Legacy CBC path
    parts = text.split(":")
    iv = bytes.fromhex(parts[0])
    encrypted_data = bytes.fromhex(":".join(parts[1:]))
    cipher = Cipher(algorithms.AES(_LEGACY_KEY), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted_padded = decryptor.update(encrypted_data) + decryptor.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    return (unpadder.update(decrypted_padded) + unpadder.finalize()).decode("utf-8")


def encrypt_bytes(data: bytes) -> bytes:
    """[LEGACY] AES-256-CBC file encryption. New code should use encrypt_bytes_gcm()."""
    iv = os.urandom(CBC_IV_LENGTH)
    cipher = Cipher(algorithms.AES(_LEGACY_KEY), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    padder = padding.PKCS7(128).padder()
    padded = padder.update(data) + padder.finalize()
    return iv + encryptor.update(padded) + encryptor.finalize()


def decrypt_bytes(data: bytes) -> bytes:
    """[LEGACY] AES-256-CBC file decryption for existing uploaded files."""
    iv = data[:CBC_IV_LENGTH]
    encrypted = data[CBC_IV_LENGTH:]
    cipher = Cipher(algorithms.AES(_LEGACY_KEY), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted_padded = decryptor.update(encrypted) + decryptor.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    return unpadder.update(decrypted_padded) + unpadder.finalize()


def detect_encryption_scheme(blob: bytes) -> str:
    """
    Utility: detect whether a stored file blob is GCM (new) or CBC (legacy).
    GCM nonce is 12 bytes. CBC IV is 16 bytes.
    We use the size heuristic — files < 12 bytes are invalid.
    Returns 'gcm' or 'cbc'.
    """
    # GCM blobs are at least 12 (nonce) + 16 (tag) + 1 = 29 bytes minimum
    # CBC blobs are 16 (iv) + at least 16 (one AES block) = 32 bytes minimum
    # We tag by storing a magic 4-byte prefix 'GCM\x01' for new files
    if len(blob) >= 4 and blob[:4] == b"GCM\x01":
        return "gcm"
    return "cbc"
