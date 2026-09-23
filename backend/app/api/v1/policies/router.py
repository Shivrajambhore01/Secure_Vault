"""
Policies API v1 Router — SecureVault Enterprise
Phase 07: Legacy Planning & Release Policy Engine
Handles:
- Granular release condition policies (Immediate, Cooling Buffer, Multi-Party Consensus, Date-Lock)
- Asset & Nominee policy associations
- M-of-N consensus approval submissions
- Dynamic policy condition evaluation
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Query, Request
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.policy_service import (
    PolicyService,
    PolicyCreateRequest,
    PolicyUpdateRequest,
    PolicyApprovalRequest,
)

router = APIRouter(prefix="/policies", tags=["v1 - Policies"])
policy_service = PolicyService()


class EvaluateReleaseRequest(BaseModel):
    asset_id: str
    nominee_id: str
    context: Optional[Dict[str, Any]] = None


@router.get("")
async def list_policies(request: Request):
    """List all legacy release policies for the authenticated user."""
    user_id = require_authenticated_user(request)
    policies = await policy_service.list_policies(user_id)
    return success_response(data=policies)


@router.post("")
async def create_policy(body: PolicyCreateRequest, request: Request):
    """Create a new release policy with granular condition directives."""
    user_id = require_authenticated_user(request)
    policy = await policy_service.create_policy(user_id, body)
    return success_response(data=policy, status_code=201)


@router.get("/{policy_id}")
async def get_policy(policy_id: str, request: Request):
    """Retrieve full configuration and approval history of a policy."""
    user_id = require_authenticated_user(request)
    policy = await policy_service.get_policy(user_id, policy_id)
    return success_response(data=policy)


@router.put("/{policy_id}")
async def update_policy(policy_id: str, body: PolicyUpdateRequest, request: Request):
    """Update policy conditions, attached assets, or nominee assignments."""
    user_id = require_authenticated_user(request)
    updated = await policy_service.update_policy(user_id, policy_id, body)
    return success_response(data=updated)


@router.delete("/{policy_id}")
async def delete_policy(policy_id: str, request: Request):
    """Delete a release policy and detach it from all vault assets."""
    user_id = require_authenticated_user(request)
    await policy_service.delete_policy(user_id, policy_id)
    return success_response(data={"message": "Policy deleted successfully and detached from assets."})


@router.post("/{policy_id}/approve")
async def submit_policy_approval(policy_id: str, body: PolicyApprovalRequest, request: Request):
    """Submit an M-of-N multi-party consensus approval towards unlocking assets."""
    user_id = require_authenticated_user(request)
    result = await policy_service.submit_policy_approval(user_id, policy_id, body)
    return success_response(data=result)


@router.post("/{policy_id}/evaluate")
async def evaluate_policy_release(policy_id: str, body: EvaluateReleaseRequest, request: Request):
    """
    Evaluate whether policy conditions are satisfied to permit asset disclosure.
    Returns unlocked status, remaining requirements, or time-lock countdowns.
    """
    user_id = require_authenticated_user(request)
    result = await policy_service.evaluate_asset_release(
        user_id=user_id,
        asset_id=body.asset_id,
        nominee_id=body.nominee_id,
        context=body.context,
    )
    return success_response(data=result)
