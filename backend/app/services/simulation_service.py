"""
Automated Vault Life-Cycle Simulator & Chaos Test Harness — SecureVault Enterprise (Phase 16)
Orchestrates simulated multi-stage transitions:
Asset enrollment -> Heartbeat countdown expiration -> Claim submission ->
Notary IDV -> Cooling period time jump -> Policy evaluation -> Asset release.
"""

import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import db as default_db
from app.services.asset_service import AssetService
from app.services.claim_service import ClaimService, ClaimSubmissionRequest, ClaimAdjudicationRequest
from app.services.nominee_service import NomineeService
from app.services.policy_service import PolicyService, PolicyCreateRequest
from app.services.identity_notary_service import IdentityNotaryService
from app.services.security_siem_service import SecuritySiemService


class VaultLifecycleSimulator:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self.db = db if db is not None else default_db
        self.asset_service = AssetService(db=self.db)
        self.nominee_service = NomineeService()
        self.claim_service = ClaimService(db=self.db)
        self.policy_service = PolicyService(db=self.db)
        self.notary_service = IdentityNotaryService(db=self.db)
        self.siem_service = SecuritySiemService(db=self.db)

    async def advance_claim_cooling_period(self, claim_id: str, days_forward: int = 35) -> Dict[str, Any]:
        """
        Simulates virtual clock advancement by shifting coolingPeriodEndsAt into the past.
        Allows deterministically validating time-locked release rules.
        """
        past_time = (datetime.now(timezone.utc) - timedelta(days=days_forward)).isoformat()
        res = await self.db.claims.find_one_and_update(
            {"id": claim_id},
            {"$set": {"coolingPeriodEndsAt": past_time, "coolingPeriodDays": 0}},
            return_document=True,
        )
        if res:
            res.pop("_id", None)
            return res
        return {}

    async def run_full_lifecycle_simulation(
        self,
        owner_id: str,
        owner_email: str,
        nominee_email: str,
        asset_name: str = "Test Living Trust Agreement",
        asset_secret: str = "Confidential Vault Payload",
    ) -> Dict[str, Any]:
        """
        Executes a complete end-to-end vault transition:
        1. Encrypt and store asset
        2. Invite & register primary nominee
        3. Allocate asset to nominee (100% share)
        4. Define release policy
        5. Nominee submits claim with death certificate
        6. Fast-forward cooling period
        7. Adjudicate claim and approve
        8. Verify nominee can access asset payload
        """
        timeline = []

        # 1. Asset enrollment
        asset = await self.asset_service.save_asset(
            user_id=owner_id,
            name=asset_name,
            category="DOCUMENT",
            content=asset_secret,
            sensitivity="CRITICAL",
        )
        asset_id = asset.get("asset_id") or asset.get("id")
        timeline.append({"step": "ASSET_CREATED", "asset_id": asset_id})

        # 2. Nominee enrollment
        nominee = await self.nominee_service.add_or_update_nominee(
            user_id=owner_id,
            name="Jane Beneficiary",
            email=nominee_email,
            relationship="DAUGHTER",
            phone="+15005550006",
            tier="PRIMARY",
        )
        nominee_id = nominee.get("nominee_id")
        timeline.append({"step": "NOMINEE_ENROLLED", "nominee_id": nominee_id})

        # 3. Allocation matrix
        await self.nominee_service.update_allocations(
            user_id=owner_id,
            nominee_id=nominee_id,
            allocations=[
                {"assetId": asset_id, "sharePercentage": 100, "releaseCondition": "UPON_DEATH"}
            ],
        )
        timeline.append({"step": "ASSETS_ALLOCATED", "share": 100})

        # 4. Release Policy definition
        policy = await self.policy_service.create_policy(
            user_id=owner_id,
            payload=PolicyCreateRequest(
                name="Default Estate Release Policy",
                asset_ids=[asset_id],
                condition_type="IMMEDIATE_ON_TRIGGER",
                cooling_period_days=0,
                required_approvals_count=1,
            ),
        )
        timeline.append({"step": "POLICY_CONFIGURED", "policy_id": policy.get("id")})

        # 5. Nominee claim submission
        cert_num = f"CERT-SIM-{uuid.uuid4().hex[:6].upper()}"
        claim = await self.claim_service.submit_claim(
            claimant_id=nominee_id,
            payload=ClaimSubmissionRequest(
                vault_id=f"vault_{owner_id}",
                owner_email_or_id=owner_email,
                certificate_number=cert_num,
                document_base64_or_text="SIMULATED_DEATH_CERTIFICATE_DOCUMENT",
                issuing_jurisdiction="State of California, Dept of Health",
            ),
        )
        claim_id = claim.get("id")
        timeline.append({"step": "CLAIM_SUBMITTED", "claim_id": claim_id})

        # 6. Virtual time jump (advance cooling period)
        await self.advance_claim_cooling_period(claim_id, days_forward=35)
        timeline.append({"step": "COOLING_PERIOD_ELAPSED", "virtual_advance_days": 35})

        # 7. Adjudicate & approve claim
        adjudicated = await self.claim_service.adjudicate_claim(
            admin_id="supervisor_admin",
            claim_id=claim_id,
            payload=ClaimAdjudicationRequest(
                decision="APPROVED",
                notes="Simulated valid proof of death with completed IDV.",
            ),
        )
        timeline.append({"step": "CLAIM_ADJUDICATED", "status": adjudicated.get("status")})

        # 8. Verify asset access
        released_assets = await self.asset_service.asset_repo.get_by_nominee(nominee_id)
        verified_access = any(a.get("id") == asset_id for a in released_assets)
        timeline.append({"step": "RELEASE_VERIFIED", "success": verified_access})

        return {
            "status": "COMPLETED",
            "owner_id": owner_id,
            "nominee_id": nominee_id,
            "asset_id": asset_id,
            "claim_id": claim_id,
            "timeline": timeline,
            "verified_access": verified_access,
        }


simulation_service = VaultLifecycleSimulator()
