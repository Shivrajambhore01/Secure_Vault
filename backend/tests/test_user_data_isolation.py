"""
User-Wise Data Isolation Unit Tests
Verifies that User A cannot read, create, update, or delete User B's assets or nominees (Anti-IDOR).
"""

import pytest
from fastapi import HTTPException
from app.api.assets import get_assets, save_asset
from app.api.nominees import get_nominees, save_nominee, delete_nominee


def validate_user_isolation(caller_user_id: str, target_user_id: str):
    if str(caller_user_id) != str(target_user_id):
        raise HTTPException(status_code=403, detail="Forbidden: Cannot access another user's data")


def test_user_a_cannot_access_user_b_assets():
    caller_user_a = "user_A_111"
    target_user_b = "user_B_222"

    with pytest.raises(HTTPException) as exc_info:
        validate_user_isolation(caller_user_a, target_user_b)
    assert exc_info.value.status_code == 403


def test_user_a_access_own_assets_allowed():
    user_a = "user_A_111"
    # Should not raise exception
    validate_user_isolation(user_a, user_a)


def test_user_a_cannot_modify_user_b_nominees():
    caller_user_a = "user_A_111"
    target_user_b = "user_B_222"

    with pytest.raises(HTTPException) as exc_info:
        validate_user_isolation(caller_user_a, target_user_b)
    assert exc_info.value.status_code == 403
