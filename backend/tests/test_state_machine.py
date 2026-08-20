"""
Phase 3 Unit Tests: Centralized State Machine Engine
Validates state transition guards across all 11 legal states and blocks unauthorized jumps.
"""

import pytest
from fastapi import HTTPException
from app.lib.state_machine import VaultState, is_transition_allowed, transition_vault_state


def test_valid_state_transitions():
    assert is_transition_allowed("ACTIVE", "INACTIVE_WARNING_1") is True
    assert is_transition_allowed("INACTIVE_WARNING_1", "INACTIVE_WARNING_2") is True
    assert is_transition_allowed("INACTIVE_WARNING_2", "CLAIM_INITIATED") is True
    assert is_transition_allowed("CLAIM_INITIATED", "COOLING_PERIOD") is True
    assert is_transition_allowed("COOLING_PERIOD", "NOMINEE_VERIFICATION") is True
    assert is_transition_allowed("NOMINEE_VERIFICATION", "ADMIN_REVIEW") is True
    assert is_transition_allowed("ADMIN_REVIEW", "DUAL_APPROVAL_PENDING") is True
    assert is_transition_allowed("DUAL_APPROVAL_PENDING", "KEY_RELEASE_GRANTED") is True
    assert is_transition_allowed("KEY_RELEASE_GRANTED", "ASSET_RELEASED") is True


def test_owner_halt_and_rejection_transitions():
    assert is_transition_allowed("CLAIM_INITIATED", "CLAIM_HALTED") is True
    assert is_transition_allowed("COOLING_PERIOD", "CLAIM_HALTED") is True
    assert is_transition_allowed("CLAIM_HALTED", "ACTIVE") is True
    assert is_transition_allowed("ADMIN_REVIEW", "CLAIM_REJECTED") is True


def test_invalid_state_transitions_blocked():
    # Direct jump from ACTIVE to ASSET_RELEASED must be blocked
    assert is_transition_allowed("ACTIVE", "ASSET_RELEASED") is False
    # Direct jump from NOMINEE_VERIFICATION to KEY_RELEASE_GRANTED must be blocked
    assert is_transition_allowed("NOMINEE_VERIFICATION", "KEY_RELEASE_GRANTED") is False
    # Direct jump from INACTIVE_WARNING_1 to DUAL_APPROVAL_PENDING must be blocked
    assert is_transition_allowed("INACTIVE_WARNING_1", "DUAL_APPROVAL_PENDING") is False


@pytest.mark.asyncio
async def test_transition_vault_state_raises_http_400_on_invalid_jump(monkeypatch):
    user_id = "user_invalid_jump_test"
    from unittest.mock import AsyncMock
    from app.lib import state_machine
    monkeypatch.setattr(state_machine.workflows_col, "find_one", AsyncMock(return_value={"userId": user_id, "status": "ACTIVE"}))

    with pytest.raises(HTTPException) as exc_info:
        await transition_vault_state(user_id, target_state="ASSET_RELEASED", actor_id="attacker")
    assert exc_info.value.status_code == 400
    assert "Invalid State Transition" in str(exc_info.value.detail)
