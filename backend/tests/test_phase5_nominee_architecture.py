"""
Phase 05 Nominee & Beneficiary Architecture Tests — SecureVault Enterprise
Tests tiered beneficiary onboarding, invitation token lifecycle,
asset allocation matrix synchronization, revocation, and public acceptance.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.nominee_service import NomineeService
from app.domain.exceptions import ConflictError, NotFoundError
from app.core.database import db
from app.security.tokens import create_access_token


@pytest.mark.asyncio
async def test_nominee_registration_and_tiers():
    nominee_service = NomineeService()
    test_user_id = "test_user_phase5_benefactor"

    # Cleanup previous runs
    await db["nominees"].delete_many({"userId": test_user_id})
    await db["nominee_verifications"].delete_many({"userId": test_user_id})

    # 1. Primary Nominee (Spouse)
    spouse_res = await nominee_service.add_or_update_nominee(
        user_id=test_user_id,
        name="Eleanor Vance",
        email="eleanor@securevault.app",
        relationship="Spouse",
        phone="+15551234567",
        tier="PRIMARY",
        notes="Primary heir for all real estate and financial accounts.",
    )
    assert spouse_res["status"] == "INVITED"
    assert spouse_res["invitation_token"] is not None
    spouse_id = spouse_res["nominee_id"]

    # 2. Contingent Nominee (Son)
    son_res = await nominee_service.add_or_update_nominee(
        user_id=test_user_id,
        name="Arthur Vance",
        email="arthur@securevault.app",
        relationship="Son",
        phone="+15559876543",
        tier="CONTINGENT",
        notes="Secondary heir if spouse cannot claim.",
    )
    assert son_res["status"] == "INVITED"

    # 3. Executor Nominee (Attorney)
    lawyer_res = await nominee_service.add_or_update_nominee(
        user_id=test_user_id,
        name="Sterling & Partners Legal",
        email="legal@sterlingpartners.com",
        relationship="Attorney",
        tier="EXECUTOR",
    )
    assert lawyer_res["status"] == "INVITED"

    # Duplicate email rejection
    with pytest.raises(ConflictError):
        await nominee_service.add_or_update_nominee(
            user_id=test_user_id,
            name="Eleanor Duplicate",
            email="eleanor@securevault.app",
            relationship="Spouse",
        )

    # Verify listing
    nominees = await nominee_service.list_nominees(test_user_id)
    assert len(nominees) == 3
    primary = [n for n in nominees if n["tier"] == "PRIMARY"]
    assert len(primary) == 1
    assert primary[0]["name"] == "Eleanor Vance"


@pytest.mark.asyncio
async def test_invitation_issuance_and_acceptance():
    nominee_service = NomineeService()
    test_user_id = "test_user_phase5_benefactor"

    nominee = await nominee_service.nominee_repo.find_one({"email": "eleanor@securevault.app", "userId": test_user_id})
    invite_token = nominee["invitationToken"]
    assert invite_token is not None

    # Public acceptance flow
    acc_res = await nominee_service.accept_invitation(
        invitation_token=invite_token,
        confirmation_phone="+15551234567",
    )
    assert acc_res["status"] == "ACCEPTED"
    assert acc_res["success"] is True

    # Check database state
    updated_nominee = await nominee_service.nominee_repo.find_one({"id": nominee["id"]})
    assert updated_nominee["status"] == "ACCEPTED"
    assert updated_nominee["invitationToken"] is None  # Burned

    # Re-acceptance with burned token must fail
    with pytest.raises(NotFoundError):
        await nominee_service.accept_invitation(invitation_token=invite_token)


@pytest.mark.asyncio
async def test_asset_allocation_matrix_and_sync():
    nominee_service = NomineeService()
    test_user_id = "test_user_phase5_benefactor"

    # Setup 2 test assets for this user
    await db["assets"].delete_many({"userId": test_user_id})
    asset1_id = "asset_p5_swiss_bank"
    asset2_id = "asset_p5_family_home"

    await db["assets"].insert_one({
        "id": asset1_id,
        "userId": test_user_id,
        "name": "Swiss Private Account",
        "type": "FINANCIAL",
        "nomineeIds": [],
        "allowedNominees": [],
    })
    await db["assets"].insert_one({
        "id": asset2_id,
        "userId": test_user_id,
        "name": "Primary Residence Deed",
        "type": "LEGAL",
        "nomineeIds": [],
        "allowedNominees": [],
    })

    nominee = await nominee_service.nominee_repo.find_one({"email": "eleanor@securevault.app", "userId": test_user_id})
    nominee_id = nominee["id"]

    # 1. Update allocations for Eleanor: 100% Swiss Bank, 50% Family Home
    alloc_res = await nominee_service.update_allocations(
        user_id=test_user_id,
        nominee_id=nominee_id,
        allocations=[
            {"assetId": asset1_id, "sharePercentage": 100.0, "releaseCondition": "IMMEDIATE_ON_CLAIM"},
            {"assetId": asset2_id, "sharePercentage": 50.0, "releaseCondition": "AFTER_COOLING_PERIOD"},
        ],
    )
    assert alloc_res["allocated_count"] == 2

    # Verify bidirectional sync on assets collection
    asset1 = await db["assets"].find_one({"id": asset1_id})
    assert nominee_id in asset1["nomineeIds"]

    asset2 = await db["assets"].find_one({"id": asset2_id})
    assert nominee_id in asset2["nomineeIds"]

    # 2. Check Bipartite Allocation Matrix
    matrix = await nominee_service.get_allocation_matrix(test_user_id)
    assert matrix["total_assets"] == 2
    assert matrix["covered_assets"] == 2
    assert matrix["coverage_percentage"] == 100.0
    assert len(matrix["unallocated_assets"]) == 0


@pytest.mark.asyncio
async def test_nominee_revocation_and_unlinking():
    nominee_service = NomineeService()
    test_user_id = "test_user_phase5_benefactor"

    nominee = await nominee_service.nominee_repo.find_one({"email": "eleanor@securevault.app", "userId": test_user_id})
    nominee_id = nominee["id"]

    # Revoke nominee
    revoke_res = await nominee_service.revoke_nominee(
        user_id=test_user_id,
        nominee_id=nominee_id,
        reason="Updated trust and will directives",
    )
    assert revoke_res["status"] == "REVOKED"

    # Verify unlinked from assets
    asset1 = await db["assets"].find_one({"id": "asset_p5_swiss_bank"})
    assert nominee_id not in asset1.get("nomineeIds", [])

    # Check matrix reflects unallocated assets
    matrix = await nominee_service.get_allocation_matrix(test_user_id)
    assert matrix["covered_assets"] == 0
    assert matrix["unallocated_assets_count"] == 2


@pytest.mark.asyncio
async def test_v1_nominee_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        test_user_id = "test_user_phase5_benefactor"
        token = create_access_token({"userId": test_user_id})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. List nominees
        res = await ac.get("/api/v1/nominees", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) >= 1

        # 2. Get allocation matrix
        matrix_res = await ac.get("/api/v1/nominees/matrix", headers=headers)
        assert matrix_res.status_code == 200
        matrix_data = matrix_res.json()["data"]
        assert "coverage_percentage" in matrix_data
        assert "nominees" in matrix_data
        assert "assets" in matrix_data
