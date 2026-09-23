"""
Test Limit Enforcement Logic (Storage, File Size, Asset Count, Nominee Count).
"""

import pytest
from app.lib.limit_enforcement import UpgradeRequiredError, check_storage_limit, check_file_size_limit

@pytest.mark.asyncio
async def test_free_storage_limit_exceeded():
    """Free user exceeding 50MB should raise UpgradeRequiredError with status 402."""
    user = {"plan": "free", "storageUsed": 48 * 1024 * 1024}
    new_file_size = 5 * 1024 * 1024  # 5MB -> 48 + 5 = 53MB > 50MB

    with pytest.raises(UpgradeRequiredError) as exc_info:
        await check_storage_limit(user, new_file_size)

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail["limit_type"] == "storage"
    assert exc_info.value.detail["current_plan"] == "free"

@pytest.mark.asyncio
async def test_free_storage_limit_allowed():
    """Free user under 50MB should not raise error."""
    user = {"plan": "free", "storageUsed": 20 * 1024 * 1024}
    new_file_size = 2 * 1024 * 1024  # 20 + 2 = 22MB < 50MB
    await check_storage_limit(user, new_file_size)

@pytest.mark.asyncio
async def test_free_file_size_limit_exceeded():
    """Free user uploading file > 5MB should raise UpgradeRequiredError with status 402."""
    user = {"plan": "free"}
    oversized_file = 6 * 1024 * 1024  # 6MB > 5MB limit

    with pytest.raises(UpgradeRequiredError) as exc_info:
        await check_file_size_limit(user, oversized_file)

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail["limit_type"] == "file_size"

@pytest.mark.asyncio
async def test_pro_file_size_limit_allowed():
    """Pro user uploading 50MB file should be allowed (limit is 100MB)."""
    user = {"plan": "pro"}
    allowed_file = 50 * 1024 * 1024
    await check_file_size_limit(user, allowed_file)

@pytest.mark.asyncio
async def test_pro_file_size_limit_exceeded():
    """Pro user uploading 150MB file should raise error (limit is 100MB)."""
    user = {"plan": "pro"}
    oversized_file = 150 * 1024 * 1024

    with pytest.raises(UpgradeRequiredError) as exc_info:
        await check_file_size_limit(user, oversized_file)

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail["limit_type"] == "file_size"
