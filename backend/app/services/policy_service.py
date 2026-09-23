"""
Legacy Planning & Release Policy Engine Service — SecureVault Enterprise
Phase 07
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.database import db as default_db
from app.domain.exceptions import (
    NotFoundError,
    ValidationError,
    ForbiddenError,
)
from app.domain.schemas.policy import PolicyVersionSchema, PolicyExecutionSchema


class PolicyCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = None
    condition_type: str = Field(
        default="IMMEDIATE_ON_TRIGGER",
        description="IMMEDIATE_ON_TRIGGER | AFTER_COOLING_PERIOD | MULTI_APPROVAL | DATE_LOCKED"
    )
    cooling_period_days: int = Field(default=14, ge=0, le=365)
    required_approvals_count: int = Field(default=2, ge=1, le=10)
    authorized_approver_ids: List[str] = Field(default_factory=list)
    unlock_date: Optional[str] = None
    asset_ids: List[str] = Field(default_factory=list)
    beneficiary_ids: List[str] = Field(default_factory=list)


class PolicyUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    condition_type: Optional[str] = None
    cooling_period_days: Optional[int] = None
    required_approvals_count: Optional[int] = None
    authorized_approver_ids: Optional[List[str]] = None
    unlock_date: Optional[str] = None
    asset_ids: Optional[List[str]] = None
    beneficiary_ids: Optional[List[str]] = None
    status: Optional[str] = None


class PolicyApprovalRequest(BaseModel):
    approver_id: str
    approver_name: Optional[str] = "Authorized Nominee"
    signature_token: Optional[str] = None
    notes: Optional[str] = None


class PolicyService:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self.db = db if db is not None else default_db

    async def create_policy(self, user_id: str, payload: PolicyCreateRequest) -> Dict[str, Any]:
        """Create a release policy and optionally link assets."""
        now = datetime.now(timezone.utc).isoformat()
        policy_id = f"pol_{uuid.uuid4().hex[:12]}"

        # Validate date lock if applicable
        if payload.condition_type == "DATE_LOCKED" and not payload.unlock_date:
            raise ValidationError("Unlock date is required for DATE_LOCKED policy condition.")

        policy_doc = {
            "id": policy_id,
            "userId": user_id,
            "name": payload.name,
            "description": payload.description or "",
            "conditionType": payload.condition_type,
            "coolingPeriodDays": payload.cooling_period_days,
            "requiredApprovalsCount": payload.required_approvals_count,
            "authorizedApproverIds": payload.authorized_approver_ids,
            "unlockDate": payload.unlock_date,
            "assetIds": payload.asset_ids,
            "beneficiaryIds": payload.beneficiary_ids,
            "approvals": [],
            "status": "ACTIVE",
            "version": 1,
            "createdAt": now,
            "updatedAt": now,
        }

        await self.db.policies.insert_one(policy_doc)

        # Link policy ID to specified assets
        if payload.asset_ids:
            await self.db.assets.update_many(
                {"id": {"$in": payload.asset_ids}, "userId": user_id},
                {"$set": {"policyId": policy_id, "updatedAt": now}}
            )

        # Audit log
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "CREATE_RELEASE_POLICY",
            "resource": "POLICY",
            "resourceId": policy_id,
            "details": {
                "name": payload.name,
                "conditionType": payload.condition_type,
                "assetCount": len(payload.asset_ids),
            },
            "timestamp": now,
        })

        policy_doc.pop("_id", None)
        return policy_doc

    async def list_policies(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieve all legacy policies for a user."""
        cursor = self.db.policies.find({"userId": user_id}).sort("createdAt", -1)
        policies = []
        async for doc in cursor:
            doc.pop("_id", None)
            policies.append(doc)
        return policies

    async def get_policy(self, user_id: str, policy_id: str) -> Dict[str, Any]:
        """Retrieve a specific policy with full details."""
        policy = await self.db.policies.find_one({"id": policy_id, "userId": user_id})
        if not policy:
            raise NotFoundError("Policy", policy_id)
        policy.pop("_id", None)
        return policy

    async def update_policy(self, user_id: str, policy_id: str, payload: PolicyUpdateRequest) -> Dict[str, Any]:
        """Update policy directives and snapshot existing version."""
        existing = await self.db.policies.find_one({"id": policy_id, "userId": user_id})
        if not existing:
            raise NotFoundError("Policy", policy_id)

        now = datetime.now(timezone.utc).isoformat()
        current_version = existing.get("version", 1)

        # Snapshot current version before updating
        version_doc = {
            "id": f"pver_{uuid.uuid4().hex[:12]}",
            "policyId": policy_id,
            "versionNumber": current_version,
            "conditions": [{
                "conditionType": existing.get("conditionType"),
                "coolingPeriodDays": existing.get("coolingPeriodDays"),
                "requiredApprovalsCount": existing.get("requiredApprovalsCount"),
                "unlockDate": existing.get("unlockDate"),
            }],
            "actions": [{
                "assetIds": existing.get("assetIds", []),
                "beneficiaryIds": existing.get("beneficiaryIds", []),
            }],
            "changeSummary": f"Automated revision snapshot v{current_version}",
            "createdBy": user_id,
            "createdAt": now,
        }
        await self.db.policy_versions.insert_one(version_doc)

        update_dict: Dict[str, Any] = {"updatedAt": now, "version": current_version + 1}

        if payload.name is not None:
            update_dict["name"] = payload.name
        if payload.description is not None:
            update_dict["description"] = payload.description
        if payload.condition_type is not None:
            update_dict["conditionType"] = payload.condition_type
        if payload.cooling_period_days is not None:
            update_dict["coolingPeriodDays"] = payload.cooling_period_days
        if payload.required_approvals_count is not None:
            update_dict["requiredApprovalsCount"] = payload.required_approvals_count
        if payload.authorized_approver_ids is not None:
            update_dict["authorizedApproverIds"] = payload.authorized_approver_ids
        if payload.unlock_date is not None:
            update_dict["unlockDate"] = payload.unlock_date
        if payload.status is not None:
            update_dict["status"] = payload.status
        if payload.beneficiary_ids is not None:
            update_dict["beneficiaryIds"] = payload.beneficiary_ids

        # Handle asset rebinding if asset_ids modified
        if payload.asset_ids is not None:
            old_asset_ids = existing.get("assetIds", [])
            update_dict["assetIds"] = payload.asset_ids

            # Unlink removed assets
            removed_ids = list(set(old_asset_ids) - set(payload.asset_ids))
            if removed_ids:
                await self.db.assets.update_many(
                    {"id": {"$in": removed_ids}, "userId": user_id},
                    {"$set": {"policyId": None, "updatedAt": now}}
                )

            # Link newly attached assets
            new_ids = list(set(payload.asset_ids) - set(old_asset_ids))
            if new_ids:
                await self.db.assets.update_many(
                    {"id": {"$in": new_ids}, "userId": user_id},
                    {"$set": {"policyId": policy_id, "updatedAt": now}}
                )

        await self.db.policies.update_one({"id": policy_id}, {"$set": update_dict})
        updated = await self.db.policies.find_one({"id": policy_id})
        if updated:
            updated.pop("_id", None)
        return updated or {}

    async def delete_policy(self, user_id: str, policy_id: str) -> bool:
        """Delete a release policy and detach from all assets."""
        existing = await self.db.policies.find_one({"id": policy_id, "userId": user_id})
        if not existing:
            raise NotFoundError("Policy", policy_id)

        # Detach assets
        await self.db.assets.update_many(
            {"policyId": policy_id, "userId": user_id},
            {"$set": {"policyId": None}}
        )

        await self.db.policies.delete_one({"id": policy_id})
        return True

    async def submit_policy_approval(
        self,
        user_id: str,
        policy_id: str,
        approval_in: PolicyApprovalRequest
    ) -> Dict[str, Any]:
        """Submit an M-of-N multi-party consensus approval."""
        policy = await self.db.policies.find_one({"id": policy_id, "userId": user_id})
        if not policy:
            raise NotFoundError("Policy", policy_id)

        approvals = policy.get("approvals", [])

        # Check for duplicate approval from same approver
        for app in approvals:
            if app.get("approverId") == approval_in.approver_id:
                raise ValidationError("Approver has already submitted approval for this policy.")

        now = datetime.now(timezone.utc).isoformat()
        approval_entry = {
            "id": f"appr_{uuid.uuid4().hex[:10]}",
            "approverId": approval_in.approver_id,
            "approverName": approval_in.approver_name,
            "signatureToken": approval_in.signature_token or uuid.uuid4().hex,
            "notes": approval_in.notes or "Cryptographic approval authorized.",
            "approvedAt": now,
        }

        approvals.append(approval_entry)
        required_count = policy.get("requiredApprovalsCount", 2)
        is_fulfilled = len(approvals) >= required_count
        new_status = "FULFILLED" if is_fulfilled else policy.get("status", "ACTIVE")

        await self.db.policies.update_one(
            {"id": policy_id},
            {
                "$set": {
                    "approvals": approvals,
                    "status": new_status,
                    "updatedAt": now,
                }
            }
        )

        # Audit log
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "SUBMIT_POLICY_APPROVAL",
            "resource": "POLICY",
            "resourceId": policy_id,
            "details": {
                "approverId": approval_in.approver_id,
                "currentCount": len(approvals),
                "requiredCount": required_count,
                "isFulfilled": is_fulfilled,
            },
            "timestamp": now,
        })

        return {
            "policyId": policy_id,
            "approvalsCount": len(approvals),
            "requiredCount": required_count,
            "isFulfilled": is_fulfilled,
            "status": new_status,
            "latestApproval": approval_entry,
        }

    async def evaluate_asset_release(
        self,
        user_id: str,
        asset_id: str,
        nominee_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate if an asset's release policy allows disclosure to a nominee.
        Context can include switch status, trigger timestamps, etc.
        """
        context = context or {}
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        asset = await self.db.assets.find_one({"id": asset_id, "userId": user_id})
        if not asset:
            raise NotFoundError("Asset", asset_id)

        policy_id = asset.get("policyId")
        policy = None
        if policy_id:
            policy = await self.db.policies.find_one({"id": policy_id, "userId": user_id})

        # If no explicit policy attached, fallback to standard immediate release
        if not policy:
            return {
                "is_unlocked": True,
                "reason": "Default policy: Immediate release upon authorized beneficiary claim.",
                "condition_type": "IMMEDIATE_ON_TRIGGER",
                "unfulfilled_requirements": [],
                "unlock_date": now_iso,
                "status": "FULFILLED",
            }

        cond_type = policy.get("conditionType", "IMMEDIATE_ON_TRIGGER")
        unfulfilled: List[str] = []
        is_unlocked = True
        reason = "All policy directives satisfied."

        # 1. Evaluate DATE_LOCKED
        if cond_type == "DATE_LOCKED":
            unlock_date_str = policy.get("unlockDate")
            if unlock_date_str:
                try:
                    unlock_dt = datetime.fromisoformat(unlock_date_str.replace("Z", "+00:00"))
                    if now < unlock_dt:
                        is_unlocked = False
                        days_left = (unlock_dt - now).days
                        msg = f"Asset time-locked until {unlock_dt.strftime('%Y-%m-%d')} ({days_left} days remaining)."
                        unfulfilled.append(msg)
                        reason = msg
                except Exception:
                    pass

        # 2. Evaluate AFTER_COOLING_PERIOD
        elif cond_type == "AFTER_COOLING_PERIOD":
            cooling_days = policy.get("coolingPeriodDays", 14)
            triggered_at_str = context.get("switch_triggered_at")
            if not triggered_at_str:
                # If switch hasn't triggered yet, cooling hasn't started or finished
                is_unlocked = False
                msg = f"Requires switch trigger and subsequent {cooling_days}-day cooling buffer."
                unfulfilled.append(msg)
                reason = msg
            else:
                try:
                    trig_dt = datetime.fromisoformat(triggered_at_str.replace("Z", "+00:00"))
                    cooling_end = trig_dt + timedelta(days=cooling_days)
                    if now < cooling_end:
                        is_unlocked = False
                        days_left = max(1, (cooling_end - now).days)
                        msg = f"Cooling period active. {days_left} days remaining until unlock."
                        unfulfilled.append(msg)
                        reason = msg
                except Exception:
                    pass

        # 3. Evaluate MULTI_APPROVAL (M-of-N)
        elif cond_type == "MULTI_APPROVAL":
            required = policy.get("requiredApprovalsCount", 2)
            approvals = policy.get("approvals", [])
            if len(approvals) < required:
                is_unlocked = False
                remaining = required - len(approvals)
                msg = f"Consensus not reached: {len(approvals)}/{required} approvals recorded ({remaining} more required)."
                unfulfilled.append(msg)
                reason = msg

        # Record execution event into policy_executions collection
        exec_doc = {
            "id": f"pexec_{uuid.uuid4().hex[:12]}",
            "policyId": policy_id,
            "vaultId": asset.get("vaultId", "default"),
            "assetId": asset_id,
            "nomineeId": nominee_id,
            "triggeredByEvent": context.get("event", "MANUAL_EVALUATION"),
            "resultAllowed": is_unlocked,
            "unfulfilledRequirements": unfulfilled,
            "executedAt": now_iso,
        }
        await self.db.policy_executions.insert_one(exec_doc)

        return {
            "is_unlocked": is_unlocked,
            "reason": reason,
            "condition_type": cond_type,
            "unfulfilled_requirements": unfulfilled,
            "unlock_date": policy.get("unlockDate") or now_iso,
            "status": "FULFILLED" if is_unlocked else "LOCKED",
            "policy_id": policy_id,
            "policy_name": policy.get("name"),
            "approvals_recorded": len(policy.get("approvals", [])),
            "required_approvals": policy.get("requiredApprovalsCount", 0),
        }
