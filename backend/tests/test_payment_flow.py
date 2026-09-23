"""
Test Payment Flow & Encryption Integrity.
"""

from app.lib.encryption import encrypt_bytes, decrypt_bytes
from app.core.plans import PAID_PLANS

def test_paid_plans_set():
    """Verify only 'pro' and 'premium' are valid paid upgrade targets."""
    assert PAID_PLANS == {"pro", "premium"}
    assert "free" not in PAID_PLANS

def test_screenshot_encryption_and_decryption_cycle():
    """Verify screenshot binary data is encrypted and decrypted losslessly."""
    raw_image_data = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"TEST_IMAGE_DATA_12345" * 10
    encrypted = encrypt_bytes(raw_image_data)
    assert encrypted != raw_image_data

    decrypted = decrypt_bytes(encrypted)
    assert decrypted == raw_image_data
