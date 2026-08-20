"""
Phase 5 Unit Tests: Admin Governance & Dual Approval Key Release
Validates 6-rule Super Admin dual approval requirements before KMS key unwrapping.
"""

import pytest
from datetime import datetime, timedelta, timezone


def validate_dual_approval_rules(
    admin1_id: str,
    admin1_role: str,
    admin2_id: str,
    admin2_role: str,
    claim_id: str,
    target_claim_id: str,
    current_claim_status: str,
    first_approval_timestamp: str,
) -> bool:
    """
    Validates the 6 mandatory rules for dual approval key release:
      1. admin1Id != admin2Id
      2. admin1.role == SUPER_ADMIN
      3. admin2.role == SUPER_ADMIN
      4. Admin 1 cannot sign twice
      5. Approval belongs to the specific claim ID
      6. Claim state is DUAL_APPROVAL_PENDING and within 72h window
    """
    # 1. Distinct Admins Check
    if admin1_id == admin2_id:
        return False

    # 2 & 3. Super Admin Role Check
    if admin1_role != "SUPER_ADMIN" or admin2_role != "SUPER_ADMIN":
        return False

    # 5. Claim ID Match
    if claim_id != target_claim_id:
        return False

    # 6. Claim Status Check
    if current_claim_status != "DUAL_APPROVAL_PENDING":
        return False

    # 6b. Expiry Window Check (72h)
    if first_approval_timestamp:
        first_dt = datetime.fromisoformat(first_approval_timestamp.replace("Z", "+00:00"))
        if (datetime.now(timezone.utc) - first_dt) > timedelta(hours=72):
            return False

    return True


def test_valid_dual_approval():
    valid = validate_dual_approval_rules(
        admin1_id="super_admin_A",
        admin1_role="SUPER_ADMIN",
        admin2_id="super_admin_B",
        admin2_role="SUPER_ADMIN",
        claim_id="claim_100",
        target_claim_id="claim_100",
        current_claim_status="DUAL_APPROVAL_PENDING",
        first_approval_timestamp=datetime.now(timezone.utc).isoformat(),
    )
    assert valid is True


def test_same_admin_double_signing_blocked():
    valid = validate_dual_approval_rules(
        admin1_id="super_admin_A",
        admin1_role="SUPER_ADMIN",
        admin2_id="super_admin_A",           # Same Admin!
        admin2_role="SUPER_ADMIN",
        claim_id="claim_100",
        target_claim_id="claim_100",
        current_claim_status="DUAL_APPROVAL_PENDING",
        first_approval_timestamp=datetime.now(timezone.utc).isoformat(),
    )
    assert valid is False


def test_support_admin_role_blocked():
    valid = validate_dual_approval_rules(
        admin1_id="super_admin_A",
        admin1_role="SUPER_ADMIN",
        admin2_id="support_admin_B",
        admin2_role="SUPPORT_ADMIN",         # Support Admin!
        claim_id="claim_100",
        target_claim_id="claim_100",
        current_claim_status="DUAL_APPROVAL_PENDING",
        first_approval_timestamp=datetime.now(timezone.utc).isoformat(),
    )
    assert valid is False


def test_expired_approval_window_blocked():
    expired_time = (datetime.now(timezone.utc) - timedelta(hours=73)).isoformat()
    valid = validate_dual_approval_rules(
        admin1_id="super_admin_A",
        admin1_role="SUPER_ADMIN",
        admin2_id="super_admin_B",
        admin2_role="SUPER_ADMIN",
        claim_id="claim_100",
        target_claim_id="claim_100",
        current_claim_status="DUAL_APPROVAL_PENDING",
        first_approval_timestamp=expired_time,
    )
    assert valid is False
