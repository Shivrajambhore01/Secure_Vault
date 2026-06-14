"""AES-256-CBC encryption/decryption — exact port of backend/lib/encryption.ts."""

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.backends import default_backend
import os

from app.core.config import get_settings

settings = get_settings()

ENCRYPTION_KEY = settings.ENCRYPTION_KEY[:32].encode("utf-8")
IV_LENGTH = 16


def encrypt(text: str) -> str:
    """Encrypt text using AES-256-CBC. Returns iv_hex:ciphertext_hex."""
    iv = os.urandom(IV_LENGTH)
    cipher = Cipher(algorithms.AES(ENCRYPTION_KEY), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()

    # PKCS7 padding (Node.js crypto uses this by default)
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(text.encode("utf-8")) + padder.finalize()

    encrypted = encryptor.update(padded_data) + encryptor.finalize()
    return iv.hex() + ":" + encrypted.hex()


def decrypt(text: str) -> str:
    """Decrypt text from iv_hex:ciphertext_hex format."""
    parts = text.split(":")
    iv_string = parts[0]
    encrypted_text = ":".join(parts[1:])

    iv = bytes.fromhex(iv_string)
    encrypted_data = bytes.fromhex(encrypted_text)

    cipher = Cipher(algorithms.AES(ENCRYPTION_KEY), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()

    decrypted_padded = decryptor.update(encrypted_data) + decryptor.finalize()

    # Remove PKCS7 padding
    unpadder = padding.PKCS7(128).unpadder()
    decrypted = unpadder.update(decrypted_padded) + unpadder.finalize()

    return decrypted.decode("utf-8")
