"""
Phase 07: Legacy Planning & Release Policy Engine Tests — SecureVault Enterprise
Tests:
- Policy CRUD and bidirectional asset link synchronization
- Policy version snapshotting
- Condition evaluation (IMMEDIATE_ON_TRIGGER, AFTER_COOLING_PERIOD, DATE_LOCKED)
- Multi-party consensus (M-of-N approvals) with duplicate prevention
- Full API v1 /policies integration endpoints
"""

import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db
from app.security.tokens import create_access_token
from app.services.policy_service import (
    PolicyService,
    PolicyCreateRequest,
    PolicyUpdateRequest,
    PolicyApprovalRequest,
)
from app.domain.exceptions import ValidationError


@pytest.fixture
def policy_service():
    return PolicyService(db)


@pytest.mark.asyncio
async def test_policy_crud_and_asset_linking(policy_service):
    user_id = f"test_user_p7_crud_{uuid.uuid4().hex[:8]}"
    asset_id = f"ast_p7_{uuid.uuid4().hex[:8]}"

    # Setup dummy asset
    await db.assets.insert_one({
        "id": asset_id,
        "userId": user_id,
        "title": "Crypto Cold Storage Passphrase",
        "category": "CRYPTO",
        "policyId": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    # 1. Create policy
    create_req = PolicyCreateRequest(
        name="Crypto Cold Storage Release Directive",
        description="Release to primary heirs upon verified trigger",
        condition_type="IMMEDIATE_ON_TRIGGER",
        asset_ids=[asset_id],
        beneficiary_ids=["nom_123"],
    )
    policy = await policy_service.create_policy(user_id, create_req)
    assert policy["id"].startswith("pol_")
    assert policy["name"] == "Crypto Cold Storage Release Directive"
    assert policy["version"] == 1

    # Verify asset was linked
    linked_asset = await db.assets.find_one({"id": asset_id})
    assert linked_asset["policyId"] == policy["id"]

    # 2. Get policy
    fetched = await policy_service.get_policy(user_id, policy["id"])
    assert fetched["id"] == policy["id"]

    # 3. Update policy (snapshot versioning)
    update_req = PolicyUpdateRequest(
        name="Updated Crypto Directive",
        cooling_period_days=21,
    )
    updated = await policy_service.update_policy(user_id, policy["id"], update_req)
    assert updated["name"] == "Updated Crypto Directive"
    assert updated["coolingPeriodDays"] == 21
    assert updated["version"] == 2

    # Check version snapshot
    snapshot = await db.policy_versions.find_one({"policyId": policy["id"]})
    assert snapshot is not None
    assert snapshot["versionNumber"] == 1

    # 4. Delete policy and check asset unlinking
    deleted = await policy_service.delete_policy(user_id, policy["id"])
    assert deleted is True

    unlinked_asset = await db.assets.find_one({"id": asset_id})
    assert unlinked_asset.get("policyId") is None


@pytest.mark.asyncio
async def test_immediate_and_cooling_evaluation(policy_service):
    user_id = f"test_user_p7_eval_{uuid.uuid4().hex[:8]}"
    asset_id = f"ast_p7_eval_{uuid.uuid4().hex[:8]}"
    nominee_id = f"nom_p7_{uuid.uuid4().hex[:8]}"

    await db.assets.insert_one({
        "id": asset_id,
        "userId": user_id,
        "title": "Family Living Trust Deed",
        "category": "LEGAL",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    # Test 1: Immediate on trigger
    imm_policy = await policy_service.create_policy(
        user_id,
        PolicyCreateRequest(
            name="Immediate Trust Deed Release",
            condition_type="IMMEDIATE_ON_TRIGGER",
            asset_ids=[asset_id],
        )
    )

    eval_imm = await policy_service.evaluate_asset_release(
        user_id=user_id,
        asset_id=asset_id,
        nominee_id=nominee_id,
    )
    assert eval_imm["is_unlocked"] is True
    assert eval_imm["status"] == "FULFILLED"

    # Test 2: Cooling period policy (14 days buffer)
    await policy_service.delete_policy(user_id, imm_policy["id"])

    cool_policy = await policy_service.create_policy(
        user_id,
        PolicyCreateRequest(
            name="Cooling Buffer Release",
            condition_type="AFTER_COOLING_PERIOD",
            cooling_period_days=14,
            asset_ids=[asset_id],
        )
    )

    # 2a: Switch not triggered yet
    eval_cool_pre = await policy_service.evaluate_asset_release(
        user_id=user_id,
        asset_id=asset_id,
        nominee_id=nominee_id,
        context={"switch_triggered_at": None}
    )
    assert eval_cool_pre["is_unlocked"] is False
    assert "Requires switch trigger" in eval_cool_pre["reason"]

    # 2b: Triggered 5 days ago (less than 14 days)
    five_days_ago = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    eval_cool_mid = await policy_service.evaluate_asset_release(
        user_id=user_id,
        asset_id=asset_id,
        nominee_id=nominee_id,
        context={"switch_triggered_at": five_days_ago}
    )
    assert eval_cool_mid["is_unlocked"] is False
    assert "Cooling period active" in eval_cool_mid["reason"]

    # 2c: Triggered 15 days ago (exceeds 14 days)
    fifteen_days_ago = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
    eval_cool_post = await policy_service.evaluate_asset_release(
        user_id=user_id,
        asset_id=asset_id,
        nominee_id=nominee_id,
        context={"switch_triggered_at": fifteen_days_ago}
    )
    assert eval_cool_post["is_unlocked"] is True


@pytest.mark.asyncio
async def test_future_date_time_lock(policy_service):
    user_id = f"test_user_p7_date_{uuid.uuid4().hex[:8]}"
    asset_id = f"ast_p7_date_{uuid.uuid4().hex[:8]}"
    nominee_id = f"nom_p7_child_{uuid.uuid4().hex[:8]}"

    await db.assets.insert_one({
        "id": asset_id,
        "userId": user_id,
        "title": "College Trust Fund Credentials",
        "category": "FINANCIAL",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    # 1. Date lock in the future (30 days from now)
    future_date = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    policy = await policy_service.create_policy(
        user_id,
        PolicyCreateRequest(
            name="18th Birthday Milestone Unlock",
            condition_type="DATE_LOCKED",
            unlock_date=future_date,
            asset_ids=[asset_id],
        )
    )

    eval_future = await policy_service.evaluate_asset_release(
        user_id=user_id,
        asset_id=asset_id,
        nominee_id=nominee_id,
    )
    assert eval_future["is_unlocked"] is False
    assert "time-locked until" in eval_future["reason"]

    # 2. Update to a date in the past
    past_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    await policy_service.update_policy(
        user_id,
        policy["id"],
        PolicyUpdateRequest(unlock_date=past_date)
    )

    eval_past = await policy_service.evaluate_asset_release(
        user_id=user_id,
        asset_id=asset_id,
        nominee_id=nominee_id,
    )
    assert eval_past["is_unlocked"] is True


@pytest.mark.asyncio
async def test_multi_party_consensus_threshold(policy_service):
    user_id = f"test_user_p7_consensus_{uuid.uuid4().hex[:8]}"
    asset_id = f"ast_p7_consensus_{uuid.uuid4().hex[:8]}"
    nominee_a = f"nom_a_{uuid.uuid4().hex[:6]}"
    nominee_b = f"nom_b_{uuid.uuid4().hex[:6]}"

    await db.assets.insert_one({
        "id": asset_id,
        "userId": user_id,
        "title": "Corporate Master Key",
        "category": "CREDENTIALS",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    # Create 2-of-2 multi-party approval policy
    policy = await policy_service.create_policy(
        user_id,
        PolicyCreateRequest(
            name="Executive Dual-Key Consensus",
            condition_type="MULTI_APPROVAL",
            required_approvals_count=2,
            authorized_approver_ids=[nominee_a, nominee_b],
            asset_ids=[asset_id],
        )
    )

    # Initial evaluation: 0/2 approvals -> LOCKED
    eval_0 = await policy_service.evaluate_asset_release(user_id, asset_id, nominee_a)
    assert eval_0["is_unlocked"] is False
    assert eval_0["approvals_recorded"] == 0

    # Approver A submits approval
    res_a = await policy_service.submit_policy_approval(
        user_id=user_id,
        policy_id=policy["id"],
        approval_in=PolicyApprovalRequest(
            approver_id=nominee_a,
            approver_name="Primary Trustee A",
            notes="Authorized release from Trustee A",
        )
    )
    assert res_a["approvalsCount"] == 1
    assert res_a["isFulfilled"] is False

    # Evaluation after 1 approval: still LOCKED
    eval_1 = await policy_service.evaluate_asset_release(user_id, asset_id, nominee_a)
    assert eval_1["is_unlocked"] is False
    assert eval_1["approvals_recorded"] == 1

    # Duplicate submission from Approver A must raise ValidationError
    with pytest.raises(ValidationError):
        await policy_service.submit_policy_approval(
            user_id=user_id,
            policy_id=policy["id"],
            approval_in=PolicyApprovalRequest(approver_id=nominee_a)
        )

    # Approver B submits approval -> fulfills 2/2 threshold
    res_b = await policy_service.submit_policy_approval(
        user_id=user_id,
        policy_id=policy["id"],
        approval_in=PolicyApprovalRequest(
            approver_id=nominee_b,
            approver_name="Secondary Trustee B",
            notes="Authorized release from Trustee B",
        )
    )
    assert res_b["approvalsCount"] == 2
    assert res_b["isFulfilled"] is True
    assert res_b["status"] == "FULFILLED"

    # Evaluation after 2 approvals: UNLOCKED
    eval_2 = await policy_service.evaluate_asset_release(user_id, asset_id, nominee_b)
    assert eval_2["is_unlocked"] is True
    assert eval_2["status"] == "FULFILLED"


@pytest.mark.asyncio
async def test_v1_policies_endpoints_integration():
    user_id = f"test_user_p7_api_{uuid.uuid4().hex[:8]}"
    token = create_access_token(data={"sub": user_id, "email": "policy_api@example.com"})
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create Policy
        create_res = await client.post(
            "/api/v1/policies",
            headers=headers,
            json={
                "name": "API Test Release Policy",
                "description": "Integration test policy",
                "condition_type": "MULTI_APPROVAL",
                "required_approvals_count": 2,
                "asset_ids": [],
            }
        )
        assert create_res.status_code == 201
        data = create_res.json()["data"]
        policy_id = data["id"]
        assert data["name"] == "API Test Release Policy"

        # 2. List Policies
        list_res = await client.get("/api/v1/policies", headers=headers)
        assert list_res.status_code == 200
        items = list_res.json()["data"]
        assert any(p["id"] == policy_id for p in items)

        # 3. Get Single Policy
        get_res = await client.get(f"/api/v1/policies/{policy_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["data"]["id"] == policy_id

        # 4. Submit Approval via API
        appr_res = await client.post(
            f"/api/v1/policies/{policy_id}/approve",
            headers=headers,
            json={
                "approver_id": "nom_test_api_1",
                "approver_name": "Test Nominee One",
                "notes": "API test approval",
            }
        )
        assert appr_res.status_code == 200
        appr_data = appr_res.json()["data"]
        assert appr_data["approvalsCount"] == 1

        # 5. Delete Policy
        del_res = await client.delete(f"/api/v1/policies/{policy_id}", headers=headers)
        assert del_res.status_code == 200
