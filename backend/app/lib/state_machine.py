"""
Centralized State Machine Engine — SecureVault Enterprise
Single Source of Truth for all Vault & Death Claim State Transitions.

All workflow status mutations across API routes and schedulers MUST route
through transition_vault_state() to guarantee transition guard validation.
"""

import logging
from enum import Enum
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import HTTPException

from app.core.database import db

logger = logging.getLogger("securevault.state_machine")

workflows_col = db["verification_workflows"]
users_col = db["users"]


class VaultState(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE_WARNING_1 = "INACTIVE_WARNING_1"
    INACTIVE_WARNING_2 = "INACTIVE_WARNING_2"
    CLAIM_INITIATED = "CLAIM_INITIATED"
    CLAIM_HALTED = "CLAIM_HALTED"
    COOLING_PERIOD = "COOLING_PERIOD"
    NOMINEE_VERIFICATION = "NOMINEE_VERIFICATION"
    ADMIN_REVIEW = "ADMIN_REVIEW"
    CLAIM_REJECTED = "CLAIM_REJECTED"
    DUAL_APPROVAL_PENDING = "DUAL_APPROVAL_PENDING"
    KEY_RELEASE_GRANTED = "KEY_RELEASE_GRANTED"
    ASSET_RELEASED = "ASSET_RELEASED"


# Legal State Transition Table with Explicit Guards
LEGAL_TRANSITIONS: Dict[VaultState, list[VaultState]] = {
    VaultState.ACTIVE: [
        VaultState.INACTIVE_WARNING_1,
        VaultState.CLAIM_INITIATED,
    ],
    VaultState.INACTIVE_WARNING_1: [
        VaultState.INACTIVE_WARNING_2,
        VaultState.ACTIVE,               # Re-engaged
    ],
    VaultState.INACTIVE_WARNING_2: [
        VaultState.CLAIM_INITIATED,
        VaultState.ACTIVE,               # Re-engaged
    ],
    VaultState.CLAIM_INITIATED: [
        VaultState.COOLING_PERIOD,
        VaultState.CLAIM_HALTED,          # Owner emergency halt
    ],
    VaultState.COOLING_PERIOD: [
        VaultState.NOMINEE_VERIFICATION,
        VaultState.CLAIM_HALTED,          # Owner emergency halt
    ],
    VaultState.NOMINEE_VERIFICATION: [
        VaultState.ADMIN_REVIEW,
        VaultState.CLAIM_REJECTED,
        VaultState.CLAIM_HALTED,
    ],
    VaultState.ADMIN_REVIEW: [
        VaultState.DUAL_APPROVAL_PENDING,
        VaultState.CLAIM_REJECTED,
        VaultState.CLAIM_HALTED,
    ],
    VaultState.DUAL_APPROVAL_PENDING: [
        VaultState.KEY_RELEASE_GRANTED,
        VaultState.CLAIM_REJECTED,
    ],
    VaultState.KEY_RELEASE_GRANTED: [
        VaultState.ASSET_RELEASED,
    ],
    VaultState.CLAIM_HALTED: [
        VaultState.ACTIVE,               # Restored after security review
    ],
    VaultState.CLAIM_REJECTED: [],        # Terminal state (requires new claim submission)
    VaultState.ASSET_RELEASED: [],       # Terminal state
}


def is_transition_allowed(current_state: str, new_state: str) -> bool:
    """
    Validates if transitioning from current_state to new_state is legally allowed.
    """
    try:
        current_enum = VaultState(current_state)
        new_enum = VaultState(new_state)
    except ValueError:
        return False

    allowed_targets = LEGAL_TRANSITIONS.get(current_enum, [])
    return new_enum in allowed_targets


async def transition_vault_state(
    user_id: str,
    target_state: str,
    actor_id: str = "system",
    reason: str = "",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Centralized execution of state transition for a user vault workflow.
    Validates transition guards, updates MongoDB, and logs an immutable audit event.
    """
    # Fetch existing workflow
    workflow = await workflows_col.find_one({"userId": user_id})
    current_state = workflow.get("status", VaultState.ACTIVE.value) if workflow else VaultState.ACTIVE.value

    # Allow idempotent re-set of same state
    if current_state == target_state:
        return workflow or {"userId": user_id, "status": target_state}

    # Validate transition against state machine rules
    if not is_transition_allowed(current_state, target_state):
        error_msg = (
            f"Invalid State Transition: Cannot transition vault for user '{user_id}' "
            f"from '{current_state}' to '{target_state}'."
        )
        logger.error(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

    now = datetime.now(timezone.utc).isoformat()
    update_fields = {
        "status": target_state,
        "updatedAt": now,
        "lastTransitionBy": actor_id,
        "lastTransitionReason": reason,
    }
    if metadata:
        update_fields["transitionMetadata"] = metadata

    # Update workflow collection
    await workflows_col.update_one(
        {"userId": user_id},
        {"$set": update_fields, "$push": {"history": {"from": current_state, "to": target_state, "timestamp": now, "actor": actor_id}}},
        upsert=True,
    )

    # Sync status to users collection
    await users_col.update_one(
        {"_id": db["users"].find_one({"_id": user_id}) or {"_id": user_id}},
        {"$set": {"status": target_state, "updatedAt": now}},
    )

    # Immutable Audit Log
    from app.lib.audit import write_audit_log
    await write_audit_log(
        user_id,
        "STATE_TRANSITION",
        "SUCCESS",
        "system",
        "SecureVault State Machine",
        {"from": current_state, "to": target_state, "actor": actor_id, "reason": reason}
    )

    logger.info(f"State Machine Transition SUCCESS: User={user_id} {current_state} ──► {target_state} (By: {actor_id})")
    return await workflows_col.find_one({"userId": user_id})
