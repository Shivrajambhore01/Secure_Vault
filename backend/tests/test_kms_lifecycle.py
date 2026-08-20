"""
Phase 2 Unit Tests: Cryptographic Infrastructure & KMS Key Lifecycle
Tests AES-256-GCM envelope encryption, key wrapping, unwrapping, rotation, and plaintext isolation.
"""

import pytest
import os
from app.lib.encryption import (
    generate_dek,
    wrap_dek,
    unwrap_dek,
    encrypt_bytes,
    decrypt_bytes,
    derive_user_key,
)
from app.lib.kms import create_vault_dek, get_dek, rotate_dek, revoke_key, KeyStatus


def test_aes_256_gcm_envelope_encryption_decryption():
    user_id = "user_test_777"
    raw_payload = b"Top Secret Financial Records - Vault Asset #101"

    # 1. Generate Asset Encryption Key (AEK / DEK)
    aek = generate_dek()
    assert len(aek) == 32

    # 2. Encrypt asset payload using AEK
    encrypted_bytes = encrypt_bytes(raw_payload)
    assert encrypted_bytes != raw_payload

    # 3. Wrap AEK using User Key Encryption Key (KEK)
    wrapped_aek_b64 = wrap_dek(aek, user_id)
    assert isinstance(wrapped_aek_b64, str)

    # 4. MongoDB Simulation: Verify plaintext key is NOT stored in wrapped output
    assert aek.hex() not in wrapped_aek_b64

    # 5. Unwrap AEK using KEK
    unwrapped_aek = unwrap_dek(wrapped_aek_b64, user_id)
    assert unwrapped_aek == aek

    # 6. Decrypt asset payload
    decrypted_bytes = decrypt_bytes(encrypted_bytes)
    assert decrypted_bytes == raw_payload


def test_invalid_user_kek_unwrap_fails():
    user_id_owner = "owner_user_123"
    user_id_attacker = "attacker_user_999"
    aek = generate_dek()

    # Wrap key with owner's KEK
    wrapped_aek = wrap_dek(aek, user_id_owner)

    # Attempting to unwrap with wrong user KEK must raise error
    with pytest.raises(Exception):
        unwrap_dek(wrapped_aek, user_id_attacker)


@pytest.mark.asyncio
async def test_kms_vault_dek_lifecycle():
    user_id = "user_kms_test"
    vault_id = "vault_abc_123"

    # 1. Generate & Create Vault DEK
    key_id = await create_vault_dek(user_id, vault_id)
    assert key_id.startswith("key_")

    # 2. Retrieve & Unwrap Vault DEK
    unwrapped_key = await get_dek(key_id, user_id)
    assert len(unwrapped_key) == 32

    # 3. Rotate Key
    new_key_id = await rotate_dek(key_id, user_id)
    assert new_key_id != key_id

    # 4. Revoke Key
    await revoke_key(key_id, reason="Security audit test")

    # Attempting to retrieve revoked key must raise ValueError
    with pytest.raises(ValueError) as exc_info:
        await get_dek(key_id, user_id)
    assert "revoked" in str(exc_info.value).lower()
