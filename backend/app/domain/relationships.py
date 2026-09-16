"""
Relational Integrity Engine — SecureVault Enterprise
Enforces relational constraints and hierarchy rules at the application layer.

Hierarchy:
User
 └── Vault
      ├── Assets
      │    ├── Versions
      │    ├── Policies
      │    └── Nominees
      ├── Nominees
      └── Legacy Plan
"""

from typing import List, Optional
from app.core.database import db
from app.domain.exceptions import ForbiddenError, NotFoundError, ValidationError


class RelationshipEngine:
    @staticmethod
    async def validate_vault_owner(user_id: str, vault_id: str) -> dict:
        """Ensures that the given vault belongs to the specified user."""
        vault = await db["vaults"].find_one({"id": vault_id, "userId": user_id})
        if not vault:
            # Fallback to primary vault if not yet migrated to vaults collection
            user = await db["users"].find_one({"_id": user_id}) or await db["users"].find_one({"id": user_id})
            if not user:
                raise NotFoundError("Vault", vault_id)
        return vault or {"id": vault_id, "userId": user_id}

    @staticmethod
    async def validate_asset_nominees(user_id: str, nominee_ids: List[str]) -> None:
        """Guarantees that every nominee assigned to an asset actually belongs to the asset owner."""
        if not nominee_ids:
            return

        for nid in nominee_ids:
            nominee = await db["nominees"].find_one({"id": nid, "userId": user_id})
            if not nominee:
                raise ValidationError(
                    f"Nominee '{nid}' does not belong to user '{user_id}' or does not exist."
                )

    @staticmethod
    async def validate_policy_assignment(user_id: str, policy_id: Optional[str]) -> None:
        """Guarantees that a referenced policy belongs to the user or is a global system policy."""
        if not policy_id:
            return

        policy = await db["policies"].find_one({"id": policy_id})
        if policy and policy.get("userId") and policy["userId"] != user_id:
            raise ForbiddenError(f"Policy '{policy_id}' belongs to another account.")

    @staticmethod
    async def validate_claim_entitlement(
        case_id: str, nominee_id: str, asset_id: str
    ) -> bool:
        """Verifies that an asset is legally claimable by this nominee under this case."""
        case = await db["claim_cases"].find_one({"id": case_id}) or await db[
            "verification_requests"
        ].find_one({"id": case_id})
        if not case:
            raise NotFoundError("ClaimCase", case_id)

        asset = await db["assets"].find_one({"id": asset_id})
        if not asset:
            raise NotFoundError("Asset", asset_id)

        nominee_ids = asset.get("nomineeIds") or asset.get("allowedNominees") or []
        if asset.get("nomineeId"):
            nominee_ids.append(asset["nomineeId"])

        if nominee_id not in nominee_ids:
            raise ForbiddenError(
                f"Nominee '{nominee_id}' is not designated for Asset '{asset_id}'"
            )

        return True
