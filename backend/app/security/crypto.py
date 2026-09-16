"""
Cryptographic Façade — SecureVault Enterprise
Exposes clean interfaces for AES-256-GCM envelope encryption and decryption.
"""

from app.lib.encryption import (
    encrypt_gcm,
    decrypt_gcm,
    encrypt_bytes,
    decrypt_bytes,
    derive_user_key,
    generate_dek,
    wrap_dek,
    unwrap_dek,
)


class CryptoService:
    @staticmethod
    def encrypt_text(plaintext: str) -> str:
        return encrypt_gcm(plaintext)

    @staticmethod
    def decrypt_text(ciphertext: str) -> str:
        return decrypt_gcm(ciphertext)

    @staticmethod
    def encrypt_binary(data: bytes) -> bytes:
        return encrypt_bytes(data)

    @staticmethod
    def decrypt_binary(data: bytes) -> bytes:
        return decrypt_bytes(data)
