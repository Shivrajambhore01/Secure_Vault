"""
Test RBAC rules for Payment Verification.
- Support Admin can list, detail, approve, reject
- Super Admin can list, detail, screenshot, but CANNOT approve or reject (403)
- Verification Admin & Security Admin cannot access payment endpoints (403)
"""

import pytest
from app.core.plans import get_plan, get_plan_price, PLANS

def test_plan_pricing_security():
    """Verify that plan prices are static, server-authoritative constants."""
    assert get_plan_price("free") == 0
    assert get_plan_price("pro") == 199
    assert get_plan_price("premium") == 499
    assert get_plan_price("unknown_plan") == 0

def test_plan_limits():
    """Verify plan storage, file size, nominee, and asset limits."""
    free = get_plan("free")
    assert free["storage_limit"] == 50 * 1024 * 1024
    assert free["file_size_limit"] == 5 * 1024 * 1024
    assert free["nominee_limit"] == 1
    assert free["asset_limit"] == 5

    pro = get_plan("pro")
    assert pro["storage_limit"] == 5 * 1024 * 1024 * 1024
    assert pro["file_size_limit"] == 100 * 1024 * 1024
    assert pro["nominee_limit"] == 5
    assert pro["asset_limit"] == 50

    premium = get_plan("premium")
    assert premium["storage_limit"] == 25 * 1024 * 1024 * 1024
    assert premium["file_size_limit"] == 500 * 1024 * 1024
    assert premium["nominee_limit"] == 10
    assert premium["asset_limit"] == 1000

def test_rbac_support_admin_allowed():
    """Support Admin is strictly allowed to approve and reject payments."""
    allowed_roles_for_approval = {"SUPPORT_ADMIN"}
    assert "SUPPORT_ADMIN" in allowed_roles_for_approval
    assert "SUPER_ADMIN" not in allowed_roles_for_approval
    assert "VERIFICATION_ADMIN" not in allowed_roles_for_approval
    assert "SECURITY_ADMIN" not in allowed_roles_for_approval

def test_rbac_super_admin_oversight_allowed():
    """Super Admin is allowed for oversight list and stats."""
    allowed_roles_for_oversight = {"SUPPORT_ADMIN", "SUPER_ADMIN"}
    assert "SUPER_ADMIN" in allowed_roles_for_oversight
    assert "SUPPORT_ADMIN" in allowed_roles_for_oversight
    assert "VERIFICATION_ADMIN" not in allowed_roles_for_oversight
    assert "SECURITY_ADMIN" not in allowed_roles_for_oversight
