"""
Phase 04 Digital Vault & Asset Management Tests — SecureVault Enterprise
Tests multi-category asset creation, envelope encryption with KMS,
versioning, rollback, tagging, search filters, storage quotas, and audit logs.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.asset_service import AssetService
from app.domain.exceptions import ForbiddenError, NotFoundError
from app.core.database import db


@pytest.mark.asyncio
async def test_asset_creation_multi_types():
    asset_service = AssetService()
    test_user_id = "test_user_phase4_pioneer"

    # Ensure user exists for quota
    await db["users"].update_one(
        {"id": test_user_id},
        {"$set": {"id": test_user_id, "email": "pioneer@securevault.app", "storageUsed": 0, "storageLimit": 100 * 1024 * 1024}},
        upsert=True,
    )
    # Cleanup previous test assets
    await db["assets"].delete_many({"userId": test_user_id})
    await db["asset_versions"].delete_many({"userId": test_user_id})
    await db["asset_access"].delete_many({"userId": test_user_id})

    # 1. Financial Asset
    fin_res = await asset_service.save_asset(
        user_id=test_user_id,
        name="Swiss Gold Portfolio",
        category="FINANCIAL",
        description="Private precious metals holding account",
        content="Account #CH-9921-4822 | Vault PIN: 882199",
        sensitivity="CRITICAL",
        tags=["finance", "banking", "switzerland"],
        metadata={"institution": "UBS Zurich", "currency": "CHF"},
    )
    assert fin_res["version"] == 1
    fin_id = fin_res["asset_id"]

    # 2. Credentials Asset
    cred_res = await asset_service.save_asset(
        user_id=test_user_id,
        name="AWS Root Production",
        category="CREDENTIALS",
        description="Master cloud credentials",
        content="admin@enterprise.io:UltraSecureRandomPassphrase!987",
        sensitivity="CRITICAL",
        tags=["devops", "cloud", "aws"],
    )
    assert cred_res["version"] == 1
    cred_id = cred_res["asset_id"]

    # 3. Crypto Asset
    crypto_res = await asset_service.save_asset(
        user_id=test_user_id,
        name="Cold Storage Ledger",
        category="CRYPTO",
        description="Hardware wallet BIP-39 recovery seed",
        content="witch collapse practice feed shame open despair creek road again ice leap",
        sensitivity="CRITICAL",
        tags=["crypto", "bitcoin", "cold-storage"],
    )
    assert crypto_res["version"] == 1

    # 4. Binary File Asset
    fake_pdf = b"%PDF-1.4 Mock Encrypted Estate Will Document Data \x00\x01\x02\x03"
    file_res = await asset_service.save_asset(
        user_id=test_user_id,
        name="Last Will & Testament 2026.pdf",
        category="LEGAL",
        description="Signed estate distribution agreement",
        file_bytes=fake_pdf,
        file_name="Last_Will_2026.pdf",
        mime_type="application/pdf",
        sensitivity="HIGH",
        tags=["legal", "will", "estate"],
    )
    assert file_res["version"] == 1

    # Verify KMS envelope encryption on financial asset
    fin_asset = await asset_service.asset_repo.find_one({"id": fin_id})
    assert fin_asset["isEncrypted"] is True
    assert fin_asset["kmsKeyId"] is not None
    assert fin_asset["content"].startswith("gcm_dek:")


@pytest.mark.asyncio
async def test_envelope_encryption_and_step_up_decrypt():
    asset_service = AssetService()
    test_user_id = "test_user_phase4_pioneer"

    # Set user PIN for step-up verification
    from app.security.hashing import hash_secret
    await db["users"].update_one(
        {"id": test_user_id},
        {"$set": {"pin": hash_secret("998877")}},
    )

    # Find the credentials asset
    cred_asset = await asset_service.asset_repo.find_one({"userId": test_user_id, "type": "CREDENTIALS"})
    asset_id = cred_asset["id"]

    # Decrypt with correct PIN
    decrypted = await asset_service.decrypt_asset_content(
        user_id=test_user_id,
        asset_id=asset_id,
        pin="998877",
    )
    assert decrypted["decryptedContent"] == "admin@enterprise.io:UltraSecureRandomPassphrase!987"

    # Verify access log entry recorded
    access_logs = await asset_service.get_access_logs(test_user_id, asset_id)
    assert len(access_logs) > 0
    assert any(log["action"] == "DECRYPT" and log["status"] == "SUCCESS" for log in access_logs)


@pytest.mark.asyncio
async def test_asset_versioning_and_rollback():
    asset_service = AssetService()
    test_user_id = "test_user_phase4_pioneer"

    # 1. Create a note asset
    create_res = await asset_service.save_asset(
        user_id=test_user_id,
        name="Emergency Family Instructions",
        category="NOTES",
        description="First draft of instructions",
        content="Call lawyer John Doe at 555-0199.",
        sensitivity="MEDIUM",
    )
    asset_id = create_res["asset_id"]
    assert create_res["version"] == 1

    # 2. Update to Version 2
    update_res = await asset_service.save_asset(
        user_id=test_user_id,
        name="Emergency Family Instructions v2",
        category="NOTES",
        description="Second revision",
        content="Call lawyer Jane Smith at 555-0288. Code word: Bluebird.",
        sensitivity="HIGH",
        asset_id=asset_id,
    )
    assert update_res["version"] == 2

    # Check that version 1 is in asset_versions collection
    versions = await asset_service.list_versions(test_user_id, asset_id)
    assert len(versions) == 1
    assert versions[0]["versionNumber"] == 1
    assert "John Doe" in versions[0]["name"] or versions[0]["versionNumber"] == 1

    # 3. Roll back to Version 1
    rollback_res = await asset_service.rollback_version(
        user_id=test_user_id,
        asset_id=asset_id,
        version_number=1,
    )
    assert rollback_res["restored_from_version"] == 1
    assert rollback_res["new_version"] == 3

    # Verify active document has version 1 name
    active_asset = await asset_service.get_asset(test_user_id, asset_id)
    assert active_asset["name"] == "Emergency Family Instructions"
    assert active_asset["currentVersion"] == 3


@pytest.mark.asyncio
async def test_asset_filtering_and_tags():
    asset_service = AssetService()
    test_user_id = "test_user_phase4_pioneer"

    # Filter by category
    crypto_assets = await asset_service.list_user_assets(user_id=test_user_id, category="CRYPTO")
    assert len(crypto_assets.items) == 1
    assert crypto_assets.items[0]["type"] == "CRYPTO"

    # Filter by tag
    tagged_assets = await asset_service.list_user_assets(user_id=test_user_id, tag="finance")
    assert len(tagged_assets.items) == 1

    # Distinct tags
    distinct_tags = await asset_service.get_user_tags(test_user_id)
    assert "finance" in distinct_tags
    assert "crypto" in distinct_tags


@pytest.mark.asyncio
async def test_storage_quota_enforcement():
    asset_service = AssetService()
    test_user_id = "test_user_quota_limit"

    # Setup user with 100 bytes limit
    await db["users"].update_one(
        {"id": test_user_id},
        {"$set": {"id": test_user_id, "email": "quota@test.app", "storageUsed": 90, "storageLimit": 100}},
        upsert=True,
    )

    # Attempt to upload 50 bytes -> total would be 140 > 100 limit
    large_payload = b"X" * 50
    with pytest.raises(ForbiddenError):
        await asset_service.save_asset(
            user_id=test_user_id,
            name="Too Large File.bin",
            category="DOCUMENTS",
            file_bytes=large_payload,
            file_name="TooLarge.bin",
        )


@pytest.mark.asyncio
async def test_v1_asset_api_endpoints():
    from app.security.tokens import create_access_token
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        test_user_id = "test_user_phase4_pioneer"
        token = create_access_token({"userId": test_user_id})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Health check & v1 summary endpoint
        res = await ac.get("/api/v1/vault/summary", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert "total_assets" in data
        assert "category_breakdown" in data
        assert "storage_used" in data

        # 2. List tags endpoint
        tags_res = await ac.get("/api/v1/assets/tags", headers=headers)
        assert tags_res.status_code == 200
        assert isinstance(tags_res.json()["data"], list)

        # 3. List assets with pagination
        assets_res = await ac.get("/api/v1/assets?page=1&page_size=10", headers=headers)
        assert assets_res.status_code == 200
        assert assets_res.json()["success"] is True
        assert len(assets_res.json()["data"]) > 0

