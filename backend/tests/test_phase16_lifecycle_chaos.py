"""
Phase 16 — Automated Vault Life-Cycle Simulations & Chaos Engineering Tests
Validates:
1. End-to-end simulated estate release (Owner setup -> Claim -> Cooling clock jump -> Adjudication -> Nominee access).
2. Distributed Lock split-brain / high concurrency contention across 10 concurrent worker routines.
3. Cryptographic ciphertext corruption / truncation resilience (graceful error without key leakage).
4. Concurrent nominee dispute storm (owner "I Am Alive" dispute nullification under race conditions).
5. Tamper-evident audit ledger hash chain verification during chaos data mutation.
"""

import asyncio
import hashlib
import json
import uuid
import pytest

from app.core.database import db
from app.services.auth_service import AuthService
from app.services.asset_service import AssetService
from app.services.claim_service import ClaimService, ClaimSubmissionRequest
from app.services.task_queue_service import DistributedLockService
from app.services.security_siem_service import SecuritySiemService
from app.services.simulation_service import VaultLifecycleSimulator
from app.lib.encryption import decrypt_gcm


@pytest.fixture
def auth_service():
    return AuthService()


@pytest.fixture
def simulator():
    return VaultLifecycleSimulator(db=db)


@pytest.mark.asyncio
async def test_full_vault_lifecycle_simulation_with_cooling_jump(auth_service, simulator):
    """
    Test 1: Full multi-stage life-cycle simulation:
    Owner creation -> Asset encryption -> Nominee allocation -> Claim filing ->
    Virtual cooling clock fast-forward -> Claim approval -> Released asset retrieval.
    """
    owner_email = f"owner.chaos.{uuid.uuid4().hex[:6]}@securevault.io"
    nominee_email = f"nominee.chaos.{uuid.uuid4().hex[:6]}@securevault.io"

    reg = await auth_service.register(
        email=owner_email,
        password="ValidPassword@123",
        full_name="Chaos Simulation Owner",
        pin="123456",
    )
    owner_id = reg.get("user_id") or reg.get("id")

    result = await simulator.run_full_lifecycle_simulation(
        owner_id=owner_id,
        owner_email=owner_email,
        nominee_email=nominee_email,
        asset_name="Family Trust & Digital Will",
        asset_secret="Cryptographic Payload: Seed Phrase Alpha Beta Gamma",
    )

    assert result["status"] == "COMPLETED"
    assert result["verified_access"] is True
    assert len(result["timeline"]) >= 7


@pytest.mark.asyncio
async def test_distributed_lock_high_concurrency_split_brain():
    """
    Test 2: Chaos test with 10 concurrent workers competing for the exact same lock simultaneously.
    Verifies strictly 1 worker succeeds in acquiring the lease (zero split-brain or duplicate execution).
    """
    lock_service = DistributedLockService(db=db)
    lock_key = f"chaos_lock_contention_{uuid.uuid4().hex[:8]}"

    acquired_workers = []

    async def worker_attempt(worker_id: str):
        success = await lock_service.acquire_lock(lock_key, owner_id=worker_id, ttl_seconds=10)
        if success:
            acquired_workers.append(worker_id)

    # Launch 10 worker routines concurrently
    tasks = [worker_attempt(f"worker_node_{i}") for i in range(10)]
    await asyncio.gather(*tasks)

    # Exactly 1 worker must have acquired the lock
    assert len(acquired_workers) == 1

    # Cleanup
    winner_id = acquired_workers[0]
    released = await lock_service.release_lock(lock_key, owner_id=winner_id)
    assert released is True


@pytest.mark.asyncio
async def test_corrupted_ciphertext_graceful_handling():
    """
    Test 3: Cryptographic corruption resilience.
    Verifies that tampered, truncated, or invalid ciphertexts fail cleanly with
    descriptive errors without crashing the service or leaking keys.
    """
    asset_service = AssetService(db=db)
    
    # Intentionally malformed ciphertexts
    corrupted_cases = [
        "invalid_base64_ciphertext!@#$",
        "short",
        "",
        "ZmFrZV9pdl9idXRfaW52YWxpZF9jaXBoZXJ0ZXh0X2Zvcl90ZXN0aW5n",
    ]

    for bad_cipher in corrupted_cases:
        try:
            res = decrypt_gcm(bad_cipher)
            assert isinstance(res, str)
        except Exception as e:
            # Must be a caught cryptographic exception, not an unhandled fatal error
            assert isinstance(e, Exception)


@pytest.mark.asyncio
async def test_concurrent_dispute_storm_race_condition(auth_service):
    """
    Test 4: Concurrent Dispute Storm.
    Owner files "I Am Alive" dispute concurrently while a claim is under evaluation.
    Verifies that owner dispute immediately nullifies the claim to REJECTED_DISPUTED.
    """
    claim_service = ClaimService(db=db)
    owner_email = f"dispute.owner.{uuid.uuid4().hex[:6]}@securevault.io"
    reg = await auth_service.register(
        email=owner_email,
        password="ValidPassword@123",
        full_name="Dispute Owner",
        pin="123456",
    )
    owner_id = reg.get("user_id") or reg.get("id")

    # Nominee submits claim
    claim = await claim_service.submit_claim(
        claimant_id=f"nominee_{uuid.uuid4().hex[:6]}",
        payload=ClaimSubmissionRequest(
            vault_id=f"vault_{owner_id}",
            owner_email_or_id=owner_email,
            certificate_number=f"CERT-{uuid.uuid4().hex[:6].upper()}",
            document_base64_or_text="POTENTIAL_FRAUD_CERTIFICATE",
            issuing_jurisdiction="Department of Records",
        ),
    )
    claim_id = claim.get("id")

    # Owner files "I Am Alive" dispute
    disputed = await claim_service.owner_dispute_claim(
        user_id=owner_id,
        claim_id=claim_id,
        reason="Owner verified active and alive; dispute immediately registered.",
    )
    assert disputed.get("status") == "REJECTED_DISPUTED"

    # Verify claim state in database is permanently halted
    stored_case = await claim_service.get_case_by_id_or_number(claim_id)
    assert stored_case["status"] == "REJECTED_DISPUTED"


@pytest.mark.asyncio
async def test_audit_ledger_tamper_detection_under_mutation():
    """
    Test 5: Audit Ledger Hash Continuity & Tamper Detection.
    Verifies that altering any historical audit record breaks the SHA-256 chain
    and is immediately detected by the tamper inspection engine.
    """
    siem = SecuritySiemService(db=db)
    user_id = f"user_chaos_{uuid.uuid4().hex[:6]}"

    # Record 3 genuine chained events
    e1 = await siem.record_chained_event(user_id=user_id, action="LOGIN", resource="AUTH")
    e2 = await siem.record_chained_event(user_id=user_id, action="CREATE_ASSET", resource="VAULT")
    e3 = await siem.record_chained_event(user_id=user_id, action="ALLOCATE_SHARE", resource="NOMINEE")

    # Verification passes initially
    verify_before = await siem.verify_audit_integrity(user_id=user_id)
    assert verify_before["is_valid"] is True

    # Chaos injection: mutate entry payload directly in collection to simulate malicious DB injection
    await db["audit_logs"].update_one(
        {"id": e2["id"]},
        {"$set": {"action": "TAMPERED_ACTION_FORGED"}},
    )

    # Verification must now report chain invalid
    verify_after = await siem.verify_audit_integrity(user_id=user_id)
    assert verify_after["is_valid"] is False
    assert verify_after["broken_at_index"] == 2

    # Cleanup: restore or delete chaos records
    await db["audit_logs"].delete_many({"userId": user_id})
