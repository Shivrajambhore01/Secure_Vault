"""
Phase 11: Social Recovery & Emergency Escrow Tests — SecureVault Enterprise
Tests:
- Shamir's Secret Sharing (SSS) mathematical split and exact reconstruction
- Guardian shard distribution and threshold configuration
- Shard collection and automated 72-hour timelock escrow trigger
- Vault owner 1-click abort protection
- Full API v1 /recovery endpoints integration
"""

import pytest
import secrets
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db
from app.security.tokens import create_access_token
from app.services.social_recovery_service import (
    SocialRecoveryService,
    SocialRecoverySetupRequest,
    RecoveryClaimInitiateRequest,
    SubmitShardRequest,
    GuardianContact,
)
from app.domain.exceptions import ValidationError


@pytest.fixture
def recovery_service():
    return SocialRecoveryService(db)


def test_shamir_mathematical_split_and_reconstruct():
    secret_hex = secrets.token_hex(32)  # 256-bit random secret
    k = 3
    n = 5

    # 1. Split into 5 shards
    shards = SocialRecoveryService.split_secret(secret_hex, k=k, n=n)
    assert len(shards) == 5
    for s in shards:
        assert s.startswith("secshard-")

    # 2. Reconstruct with subset of 3 shards [0, 1, 2]
    subset_a = [shards[0], shards[1], shards[2]]
    recovered_a = SocialRecoveryService.reconstruct_secret(subset_a)
    assert recovered_a == secret_hex

    # 3. Reconstruct with another distinct subset of 3 shards [1, 3, 4]
    subset_b = [shards[1], shards[3], shards[4]]
    recovered_b = SocialRecoveryService.reconstruct_secret(subset_b)
    assert recovered_b == secret_hex

    # 4. Reconstruct with non-adjacent subset [0, 2, 4]
    subset_c = [shards[0], shards[2], shards[4]]
    recovered_c = SocialRecoveryService.reconstruct_secret(subset_c)
    assert recovered_c == secret_hex

    # 5. Fewer than k shares (e.g. 2 shares) cannot produce the valid secret
    subset_sub = [shards[0], shards[1]]
    recovered_sub = SocialRecoveryService.reconstruct_secret(subset_sub)
    assert recovered_sub != secret_hex


@pytest.mark.asyncio
async def test_social_recovery_setup_and_guardians(recovery_service):
    user_id = f"test_owner_p11_setup_{uuid.uuid4().hex[:8]}"
    guardians = [
        GuardianContact(name=f"Guardian {i}", email=f"guard_{i}_{uuid.uuid4().hex[:4]}@example.com")
        for i in range(5)
    ]

    # Valid 3-of-5 setup
    req = SocialRecoverySetupRequest(threshold_k=3, total_shards_n=5, guardians=guardians)
    res = await recovery_service.setup_social_recovery(user_id=user_id, payload=req)

    assert res["config"]["thresholdK"] == 3
    assert res["config"]["totalShardsN"] == 5
    assert len(res["config"]["guardians"]) == 5
    assert res["master_recovery_key"] is not None

    # Check database persistence
    in_db = await db.social_recovery_configs.find_one({"userId": user_id, "status": "ACTIVE"})
    assert in_db is not None
    shards_in_db = await db.recovery_shards.count_documents({"configId": in_db["id"]})
    assert shards_in_db == 5

    # Validation check: mismatch between n and guardian count must fail
    with pytest.raises(ValidationError):
        await recovery_service.setup_social_recovery(
            user_id=user_id,
            payload=SocialRecoverySetupRequest(
                threshold_k=3,
                total_shards_n=5,
                guardians=guardians[:4],  # only 4
            )
        )


@pytest.mark.asyncio
async def test_recovery_shard_collection_and_timelock_trigger(recovery_service):
    user_id = f"test_owner_p11_coll_{uuid.uuid4().hex[:8]}"
    email = f"owner_coll_{uuid.uuid4().hex[:6]}@example.com"

    # Pre-insert user
    await db.users.insert_one({
        "id": user_id,
        "email": email,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    # Setup 2-of-3 recovery
    guardians = [
        GuardianContact(name="Alice", email=f"alice_{uuid.uuid4().hex[:4]}@example.com"),
        GuardianContact(name="Bob", email=f"bob_{uuid.uuid4().hex[:4]}@example.com"),
        GuardianContact(name="Charlie", email=f"charlie_{uuid.uuid4().hex[:4]}@example.com"),
    ]
    setup_res = await recovery_service.setup_social_recovery(
        user_id=user_id,
        payload=SocialRecoverySetupRequest(threshold_k=2, total_shards_n=3, guardians=guardians)
    )
    config_id = setup_res["config"]["id"]

    # Fetch generated shards for guardians
    shard_docs = []
    async for s in db.recovery_shards.find({"configId": config_id}):
        shard_docs.append(s["shardValue"])

    # 1. Initiate Recovery Case
    case = await recovery_service.initiate_recovery_case(
        payload=RecoveryClaimInitiateRequest(target_email=email, claimant_name="Alice (Guardian)")
    )
    case_id = case["id"]
    assert case["status"] == "COLLECTING_SHARDS"

    # 2. Submit Shard 1 (threshold is 2)
    sub1 = await recovery_service.submit_recovery_shard(
        case_id=case_id,
        payload=SubmitShardRequest(shard_string=shard_docs[0])
    )
    assert sub1["shardsSubmitted"] == 1
    assert sub1["thresholdReached"] is False
    assert sub1["status"] == "COLLECTING_SHARDS"

    # 3. Submit Shard 2 (threshold reached!) -> Engages 72h Timelock Escrow
    sub2 = await recovery_service.submit_recovery_shard(
        case_id=case_id,
        payload=SubmitShardRequest(shard_string=shard_docs[1])
    )
    assert sub2["shardsSubmitted"] == 2
    assert sub2["thresholdReached"] is True
    assert sub2["status"] == "ESCROW_TIMELOCK"
    assert sub2["timelockEndsAt"] is not None


@pytest.mark.asyncio
async def test_owner_abort_nullifies_recovery(recovery_service):
    user_id = f"test_owner_p11_abort_{uuid.uuid4().hex[:8]}"
    email = f"owner_abort_{uuid.uuid4().hex[:6]}@example.com"

    await db.users.insert_one({"id": user_id, "email": email})

    guardians = [
        GuardianContact(name="G1", email=f"g1_{uuid.uuid4().hex[:4]}@example.com"),
        GuardianContact(name="G2", email=f"g2_{uuid.uuid4().hex[:4]}@example.com"),
    ]
    setup_res = await recovery_service.setup_social_recovery(
        user_id=user_id,
        payload=SocialRecoverySetupRequest(threshold_k=2, total_shards_n=2, guardians=guardians)
    )
    case = await recovery_service.initiate_recovery_case(
        payload=RecoveryClaimInitiateRequest(target_email=email, claimant_name="Attacker")
    )

    # Owner aborts
    cancel_res = await recovery_service.cancel_recovery(
        user_id=user_id,
        case_id=case["id"],
        reason="Owner aborting fraudulent recovery attempt",
    )
    assert cancel_res["status"] == "ABORTED_BY_OWNER"

    # In database
    in_db = await db.account_recovery_cases.find_one({"id": case["id"]})
    assert in_db["status"] == "ABORTED_BY_OWNER"
    assert in_db.get("reconstructedKey") is None


@pytest.mark.asyncio
async def test_v1_recovery_api_endpoints_integration():
    user_id = f"test_user_p11_api_{uuid.uuid4().hex[:8]}"
    email = f"api_owner_{uuid.uuid4().hex[:6]}@example.com"
    token = create_access_token(data={"sub": user_id, "email": email})
    headers = {"Authorization": f"Bearer {token}"}

    await db.users.insert_one({"id": user_id, "email": email})

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Setup Social Recovery via API
        setup_res = await client.post(
            "/api/v1/recovery/social/setup",
            headers=headers,
            json={
                "threshold_k": 2,
                "total_shards_n": 3,
                "guardians": [
                    {"name": "Guardian A", "email": "a@example.com", "relationship": "Spouse"},
                    {"name": "Guardian B", "email": "b@example.com", "relationship": "Brother"},
                    {"name": "Guardian C", "email": "c@example.com", "relationship": "Attorney"},
                ]
            }
        )
        assert setup_res.status_code == 201
        data = setup_res.json()["data"]
        config_id = data["config"]["id"]

        # 2. Get Social Recovery Config
        get_cfg = await client.get("/api/v1/recovery/social/config", headers=headers)
        assert get_cfg.status_code == 200
        assert get_cfg.json()["data"]["configured"] is True

        # 3. Initiate Recovery Case
        init_res = await client.post(
            "/api/v1/recovery/cases/initiate",
            json={"target_email": email, "claimant_name": "Guardian A"}
        )
        assert init_res.status_code == 201
        case_id = init_res.json()["data"]["id"]

        # 4. Get Case Status
        status_res = await client.get(f"/api/v1/recovery/cases/{case_id}/status")
        assert status_res.status_code == 200
        assert status_res.json()["data"]["status"] == "COLLECTING_SHARDS"

        # 5. Owner Cancel Recovery
        cancel_res = await client.post(
            f"/api/v1/recovery/cases/{case_id}/cancel",
            headers=headers,
            json={"reason": "Testing API abort"}
        )
        assert cancel_res.status_code == 200
        assert cancel_res.json()["data"]["status"] == "ABORTED_BY_OWNER"
