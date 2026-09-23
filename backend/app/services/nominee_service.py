"""
Nominee Service — SecureVault Enterprise
Handles tiered beneficiary management, cryptographic invitations,
asset allocation matrix synchronization, and verification lifecycle.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.database import db
from app.domain.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.domain.value_objects import NomineeStatus, NomineeType, ReleaseCondition
from app.repositories.nominee_repository import NomineeRepository
from app.repositories.asset_repository import AssetRepository
from app.repositories.audit_repository import AuditRepository
from app.services.base import BaseService


class NomineeService(BaseService):
    def __init__(
        self,
        nominee_repo: Optional[NomineeRepository] = None,
        asset_repo: Optional[AssetRepository] = None,
        audit_repo: Optional[AuditRepository] = None,
    ):
        super().__init__()
        self.nominee_repo = nominee_repo or NomineeRepository()
        self.asset_repo = asset_repo or AssetRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.assets_col = db["assets"]
        self.verifications_col = db["nominee_verifications"]

    async def list_nominees(
        self,
        user_id: str,
        status: Optional[str] = None,
        tier: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List user's nominees with enriched asset allocation counts."""
        nominees = await self.nominee_repo.get_by_user(user_id, status=status, tier=tier)
        for nom in nominees:
            allocations = nom.get("assetAllocations", [])
            nom["allocatedAssetCount"] = len(allocations)
            nom["isPrimary"] = nom.get("tier", "PRIMARY") == "PRIMARY"
        return nominees

    async def get_nominee(self, user_id: str, nominee_id: str) -> Dict[str, Any]:
        """Get nominee details and their verification status."""
        nominee = await self.nominee_repo.find_one({"id": nominee_id, "userId": user_id})
        if not nominee:
            raise NotFoundError("Nominee", nominee_id)

        # Attach verification status if available
        verification = await self.verifications_col.find_one({"nomineeId": nominee_id})
        nominee["verification"] = verification or {"overallStatus": "PENDING"}
        return nominee

    async def add_or_update_nominee(
        self,
        user_id: str,
        name: str,
        email: str,
        relationship: str,
        phone: Optional[str] = None,
        tier: str = "PRIMARY",
        notes: Optional[str] = None,
        nominee_id: Optional[str] = None,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Create or update a tiered nominee and issue an invitation token."""
        target_id = nominee_id or str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        normalized_email = email.lower().strip()

        # Check duplicate email for user if creating new
        if not nominee_id:
            existing = await self.nominee_repo.get_by_email_and_user(normalized_email, user_id)
            if existing:
                raise ConflictError(f"A nominee with email {normalized_email} already exists")

        # Validate tier
        valid_tiers = [t.value for t in NomineeType]
        normalized_tier = tier.upper() if tier.upper() in valid_tiers else "PRIMARY"

        invitation_token = secrets.token_urlsafe(32)
        invitation_expires = (now + timedelta(days=14)).isoformat()

        doc: Dict[str, Any] = {
            "id": target_id,
            "userId": user_id,
            "name": name.strip(),
            "email": normalized_email,
            "relationship": relationship.strip(),
            "phone": phone.strip() if phone else None,
            "tier": normalized_tier,
            "notes": notes.strip() if notes else None,
            "updatedAt": now_iso,
        }

        if nominee_id:
            await self.nominee_repo.update_one(
                {"id": target_id, "userId": user_id},
                {"$set": doc},
            )
            action = "NOMINEE_UPDATE"
        else:
            doc["createdAt"] = now_iso
            doc["status"] = NomineeStatus.INVITED.value
            doc["invitationToken"] = invitation_token
            doc["invitationExpiresAt"] = invitation_expires
            doc["assetAllocations"] = []
            doc["accessToken"] = f"acc_{secrets.token_hex(16)}"
            await self.nominee_repo.insert(doc)
            action = "NOMINEE_CREATE"

        await self.audit_repo.log_event(
            user_id,
            action,
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"nomineeId": target_id, "name": name, "email": normalized_email, "tier": normalized_tier},
        )

        return {
            "nominee_id": target_id,
            "status": doc.get("status", "INVITED"),
            "invitation_token": doc.get("invitationToken", invitation_token),
            "invitation_link": f"/nominee/invite/{doc.get('invitationToken', invitation_token)}",
            "message": "Nominee saved successfully",
        }

    async def resend_invitation(
        self,
        user_id: str,
        nominee_id: str,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Regenerate invitation token and reset expiration."""
        nominee = await self.nominee_repo.find_one({"id": nominee_id, "userId": user_id})
        if not nominee:
            raise NotFoundError("Nominee", nominee_id)

        new_token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=14)).isoformat()

        await self.nominee_repo.update_one(
            {"id": nominee_id, "userId": user_id},
            {
                "$set": {
                    "invitationToken": new_token,
                    "invitationExpiresAt": expires_at,
                    "status": NomineeStatus.INVITED.value,
                    "updatedAt": now.isoformat(),
                }
            },
        )

        await self.audit_repo.log_event(
            user_id,
            "NOMINEE_INVITE_RESENT",
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"nomineeId": nominee_id, "email": nominee.get("email")},
        )

        return {
            "nominee_id": nominee_id,
            "invitation_token": new_token,
            "invitation_link": f"/nominee/invite/{new_token}",
            "expires_at": expires_at,
        }

    async def accept_invitation(
        self,
        invitation_token: str,
        confirmation_phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Public onboarding endpoint for an invited nominee to accept nomination."""
        nominee = await self.nominee_repo.find_one({"invitationToken": invitation_token})
        if not nominee:
            raise NotFoundError("Invitation", "Invalid or expired invitation token")

        now = datetime.now(timezone.utc)
        expires_at_str = nominee.get("invitationExpiresAt")
        if expires_at_str:
            expires_at = datetime.fromisoformat(expires_at_str)
            if now > expires_at:
                raise ValidationError("Invitation link has expired. Please contact the vault owner.")

        update_fields: Dict[str, Any] = {
            "status": NomineeStatus.ACCEPTED.value,
            "acceptedAt": now.isoformat(),
            "invitationToken": None,  # Burn invitation token
            "updatedAt": now.isoformat(),
        }
        if confirmation_phone:
            update_fields["phone"] = confirmation_phone

        await self.nominee_repo.update_one(
            {"id": nominee["id"]},
            {"$set": update_fields},
        )

        # Initialize verification record
        await self.verifications_col.update_one(
            {"nomineeId": nominee["id"]},
            {
                "$set": {
                    "id": f"ver_{uuid.uuid4().hex[:12]}",
                    "nomineeId": nominee["id"],
                    "userId": nominee["userId"],
                    "emailOtpVerified": True,
                    "overallStatus": "IN_REVIEW",
                    "updatedAt": now.isoformat(),
                }
            },
            upsert=True,
        )

        return {
            "success": True,
            "nominee_id": nominee["id"],
            "name": nominee["name"],
            "status": NomineeStatus.ACCEPTED.value,
            "message": "Invitation accepted successfully. Verification workflow initialized.",
        }

    async def update_allocations(
        self,
        user_id: str,
        nominee_id: str,
        allocations: List[Dict[str, Any]],
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """
        Assign assets to a nominee with percentage shares and release conditions.
        Maintains bidirectional referential integrity with the assets collection.
        """
        nominee = await self.nominee_repo.find_one({"id": nominee_id, "userId": user_id})
        if not nominee:
            raise NotFoundError("Nominee", nominee_id)

        # Validate that all asset IDs belong to user
        requested_asset_ids = [a["assetId"] for a in allocations if "assetId" in a]
        if requested_asset_ids:
            user_asset_count = await self.assets_col.count_documents({
                "id": {"$in": requested_asset_ids},
                "userId": user_id,
            })
            if user_asset_count != len(requested_asset_ids):
                raise ForbiddenError("One or more assets do not belong to your vault")

        # Format allocation records
        sanitized_allocations = []
        for alloc in allocations:
            share = float(alloc.get("sharePercentage", 100.0))
            share = max(0.0, min(100.0, share))
            condition = alloc.get("releaseCondition", ReleaseCondition.IMMEDIATE_ON_CLAIM.value)
            sanitized_allocations.append({
                "assetId": alloc["assetId"],
                "sharePercentage": share,
                "releaseCondition": condition,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            })

        # Save to nominee
        await self.nominee_repo.update_one(
            {"id": nominee_id, "userId": user_id},
            {"$set": {"assetAllocations": sanitized_allocations, "updatedAt": datetime.now(timezone.utc).isoformat()}},
        )

        # Bidirectional sync:
        # 1. Unlink nominee from any asset not in new allocations
        await self.assets_col.update_many(
            {"userId": user_id, "id": {"$nin": requested_asset_ids}},
            {"$pull": {"nomineeIds": nominee_id, "allowedNominees": nominee_id}},
        )

        # 2. Link nominee into all newly allocated assets
        if requested_asset_ids:
            await self.assets_col.update_many(
                {"userId": user_id, "id": {"$in": requested_asset_ids}},
                {"$addToSet": {"nomineeIds": nominee_id, "allowedNominees": nominee_id}},
            )

        await self.audit_repo.log_event(
            user_id,
            "NOMINEE_ALLOCATIONS_UPDATED",
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"nomineeId": nominee_id, "allocatedCount": len(sanitized_allocations)},
        )

        return {
            "nominee_id": nominee_id,
            "allocated_count": len(sanitized_allocations),
            "allocations": sanitized_allocations,
            "message": "Asset allocations synchronized successfully",
        }

    async def get_allocation_matrix(self, user_id: str) -> Dict[str, Any]:
        """
        Generate the complete bipartite allocation graph of Nominees <-> Assets.
        """
        nominees = await self.nominee_repo.get_by_user(user_id)
        assets_cursor = self.assets_col.find({"userId": user_id}, {"fileData": 0})
        assets = await assets_cursor.to_list(length=500)

        # Nominee map
        nominee_matrix = []
        for nom in nominees:
            allocs = nom.get("assetAllocations", [])
            nominee_matrix.append({
                "nomineeId": nom["id"],
                "name": nom["name"],
                "email": nom["email"],
                "tier": nom.get("tier", "PRIMARY"),
                "status": nom.get("status", "INVITED"),
                "relationship": nom.get("relationship"),
                "allocations": allocs,
                "assetCount": len(allocs),
            })

        # Asset map
        asset_matrix = []
        unallocated_assets = []
        for asset in assets:
            assigned_nominees = asset.get("nomineeIds", [])
            item = {
                "assetId": asset["id"],
                "name": asset["name"],
                "type": asset.get("type", "DOCUMENTS"),
                "sensitivity": asset.get("sensitivity", "MEDIUM"),
                "assignedNomineeIds": assigned_nominees,
                "assignedNomineeCount": len(assigned_nominees),
            }
            asset_matrix.append(item)
            if not assigned_nominees:
                unallocated_assets.append(item)

        total_assets = len(assets)
        covered_assets = total_assets - len(unallocated_assets)
        coverage_pct = round((covered_assets / total_assets) * 100, 1) if total_assets > 0 else 100.0

        return {
            "total_nominees": len(nominees),
            "total_assets": total_assets,
            "covered_assets": covered_assets,
            "unallocated_assets_count": len(unallocated_assets),
            "coverage_percentage": coverage_pct,
            "nominees": nominee_matrix,
            "assets": asset_matrix,
            "unallocated_assets": unallocated_assets,
        }

    async def revoke_nominee(
        self,
        user_id: str,
        nominee_id: str,
        reason: Optional[str] = None,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Revoke a nominee's claim and access rights and unbind from all assets."""
        nominee = await self.nominee_repo.find_one({"id": nominee_id, "userId": user_id})
        if not nominee:
            raise NotFoundError("Nominee", nominee_id)

        now_iso = datetime.now(timezone.utc).isoformat()

        # Update nominee status to REVOKED and wipe active tokens
        await self.nominee_repo.update_one(
            {"id": nominee_id, "userId": user_id},
            {
                "$set": {
                    "status": NomineeStatus.REVOKED.value,
                    "revokedAt": now_iso,
                    "revocationReason": reason or "Revoked by vault owner",
                    "accessToken": None,
                    "invitationToken": None,
                    "assetAllocations": [],
                    "updatedAt": now_iso,
                }
            },
        )

        # Unlink from all assets
        await self.assets_col.update_many(
            {"userId": user_id},
            {"$pull": {"nomineeIds": nominee_id, "allowedNominees": nominee_id}},
        )

        await self.audit_repo.log_event(
            user_id,
            "NOMINEE_REVOKED",
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"nomineeId": nominee_id, "reason": reason},
        )

        return {"nominee_id": nominee_id, "status": NomineeStatus.REVOKED.value, "message": "Nominee revoked successfully"}

    async def delete_nominee(
        self,
        user_id: str,
        nominee_id: str,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> None:
        """Permanently delete a nominee and clean up all asset bindings."""
        nominee = await self.nominee_repo.find_one({"id": nominee_id, "userId": user_id})
        if not nominee:
            raise NotFoundError("Nominee", nominee_id)

        # Remove from assets
        await self.assets_col.update_many(
            {"userId": user_id},
            {"$pull": {"nomineeIds": nominee_id, "allowedNominees": nominee_id}},
        )

        # Remove verifications
        await self.verifications_col.delete_many({"nomineeId": nominee_id})

        # Delete nominee
        await self.nominee_repo.delete_one({"id": nominee_id, "userId": user_id})

        await self.audit_repo.log_event(
            user_id,
            "NOMINEE_DELETE",
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"nomineeId": nominee_id},
        )
