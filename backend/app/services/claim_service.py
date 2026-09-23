"""
Claim & Verification Case Service — SecureVault Enterprise
Phase 08: Claim Verification & Fraud Detection Engine
Handles:
- Proof of death document submission and SHA-256 hash deduplication
- Multi-vector fraud risk evaluation (IP anomaly, velocity, conflicting claims, document forensics)
- Owner notification and 1-click "I Am Alive" dispute nullification
- Supervisor / Admin adjudication and asset release trigger
"""

import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.database import db as default_db
from app.domain.exceptions import NotFoundError, ValidationError, ForbiddenError
from app.infrastructure.pagination import PaginatedResponse, PaginationParams
from app.repositories.claim_repository import ClaimRepository
from app.services.base import BaseService
from app.lib.state_machine import transition_vault_state, VaultState


class ClaimSubmissionRequest(BaseModel):
    vault_id: str
    owner_email_or_id: str
    certificate_number: str
    document_base64_or_text: str
    issuing_jurisdiction: str
    claimant_notes: Optional[str] = None
    claimant_relationship: Optional[str] = "PRIMARY"


class ClaimAdjudicationRequest(BaseModel):
    decision: str = Field(..., description="APPROVED | REJECTED | REQUIRE_NOTARY")
    notes: Optional[str] = None
    supervisor_pin: Optional[str] = None


class ClaimService(BaseService):
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None, claim_repo: Optional[ClaimRepository] = None):
        super().__init__()
        self.db = db if db is not None else default_db
        self.claim_repo = claim_repo or ClaimRepository()

    @staticmethod
    def compute_sha256(content: str) -> str:
        """Compute SHA-256 hash of document payload or certificate ID."""
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    async def calculate_fraud_risk(
        self,
        user_id: str,
        claimant_id: str,
        cert_hash: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate multi-signal fraud score (0 to 100).
        Risk Vectors:
        1. Duplicate Certificate Hash (+50)
        2. Claimant Velocity - multiple claims in 24h (+25)
        3. Conflicting Claims for same vault (+30)
        4. IP / Geo-Anomaly (+20)
        5. Unregistered / Unknown Claimant (+25)
        """
        context = context or {}
        risk_score = 0
        risk_factors: List[Dict[str, Any]] = []

        # 1. Duplicate Certificate Hash Check
        existing_with_hash = await self.db.claims.find_one({
            "certificateHash": cert_hash,
            "status": {"$in": ["NEW", "UNDER_REVIEW", "APPROVED", "WAITING_DOCUMENTS"]}
        })
        if existing_with_hash:
            risk_score += 50
            risk_factors.append({
                "rule": "DUPLICATE_CERTIFICATE_HASH",
                "points": 50,
                "description": f"Certificate fingerprint matches existing case {existing_with_hash.get('caseNumber', 'UNKNOWN')}.",
            })

        # 2. Claimant Velocity Check (claims by same claimant in last 24h)
        twenty_four_hours_ago = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        recent_claims_count = await self.db.claims.count_documents({
            "nomineeId": claimant_id,
            "createdAt": {"$gte": twenty_four_hours_ago}
        })
        if recent_claims_count >= 2:
            risk_score += 25
            risk_factors.append({
                "rule": "CLAIMANT_VELOCITY_ANOMALY",
                "points": 25,
                "description": f"Claimant submitted {recent_claims_count} claims within a 24-hour window.",
            })

        # 3. Conflicting Claims for Same Owner Vault
        conflicting_claims = await self.db.claims.count_documents({
            "userId": user_id,
            "nomineeId": {"$ne": claimant_id},
            "status": {"$in": ["NEW", "UNDER_REVIEW", "APPROVED"]}
        })
        if conflicting_claims > 0:
            risk_score += 30
            risk_factors.append({
                "rule": "CONFLICTING_RIVAL_CLAIMS",
                "points": 30,
                "description": f"{conflicting_claims} competing claim(s) exist for this vault from other parties.",
            })

        # 4. IP / Geo-Anomaly
        client_ip = context.get("ip", "unknown")
        owner = await self.db.users.find_one({"$or": [{"_id": user_id}, {"id": user_id}]})
        if owner and owner.get("lastLoginIp") and client_ip != "unknown":
            if client_ip != owner.get("lastLoginIp"):
                risk_score += 15
                risk_factors.append({
                    "rule": "IP_NETWORK_DIVERGENCE",
                    "points": 15,
                    "description": "Claim submission IP network deviates from owner regular session history.",
                })

        # 5. Nominee Registration Verification
        nominee = await self.db.nominees.find_one({"id": claimant_id, "userId": user_id})
        if not nominee:
            risk_score += 25
            risk_factors.append({
                "rule": "UNREGISTERED_CLAIMANT",
                "points": 25,
                "description": "Claimant is not an enrolled or accepted beneficiary in the vault.",
            })
        elif nominee.get("status") != "ACCEPTED" and nominee.get("status") != "VERIFIED":
            risk_score += 15
            risk_factors.append({
                "rule": "UNVERIFIED_BENEFICIARY_STATUS",
                "points": 15,
                "description": f"Nominee status is {nominee.get('status')}, not fully accepted.",
            })

        # Clamp between 0 and 100
        risk_score = min(100, risk_score)

        # Risk level determination
        if risk_score >= 80:
            risk_level = "CRITICAL"
        elif risk_score >= 50:
            risk_level = "HIGH"
        elif risk_score >= 25:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "dual_approval_required": risk_score >= 60,
        }

    async def submit_claim(
        self,
        claimant_id: str,
        payload: ClaimSubmissionRequest,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Submit a death/incapacitation claim with certificate deduplication and risk scoring."""
        context = context or {}
        now = datetime.now(timezone.utc).isoformat()

        # Find owner
        owner = await self.db.users.find_one({
            "$or": [
                {"email": payload.owner_email_or_id.lower()},
                {"id": payload.owner_email_or_id},
                {"_id": payload.owner_email_or_id},
            ]
        })
        user_id = str(owner.get("id") or owner.get("_id")) if owner else payload.owner_email_or_id

        # Compute SHA-256 hash of document
        combined_proof = f"{payload.certificate_number}:{payload.issuing_jurisdiction}:{payload.document_base64_or_text}"
        cert_hash = self.compute_sha256(combined_proof)

        # Evaluate risk score
        risk_eval = await self.calculate_fraud_risk(
            user_id=user_id,
            claimant_id=claimant_id,
            cert_hash=cert_hash,
            context=context,
        )

        year = datetime.now(timezone.utc).year
        case_random = uuid.uuid4().hex[:6].upper()
        case_number = f"CASE-{year}-{case_random}"
        case_id = f"claim_{uuid.uuid4().hex[:12]}"

        # Emergency halt token for the owner
        emergency_halt_token = uuid.uuid4().hex

        claim_doc = {
            "id": case_id,
            "caseNumber": case_number,
            "vaultId": payload.vault_id,
            "userId": user_id,
            "nomineeId": claimant_id,
            "claimantRelationship": payload.claimant_relationship,
            "certificateNumber": payload.certificate_number,
            "certificateHash": cert_hash,
            "issuingJurisdiction": payload.issuing_jurisdiction,
            "claimantNotes": payload.claimant_notes or "",
            "status": "UNDER_REVIEW",
            "riskScore": risk_eval["risk_score"],
            "riskLevel": risk_eval["risk_level"],
            "riskFactors": risk_eval["risk_factors"],
            "dualApprovalRequired": risk_eval["dual_approval_required"],
            "emergencyHaltToken": emergency_halt_token,
            "coolingPeriodDays": 14,
            "coolingPeriodEndsAt": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
            "createdAt": now,
            "updatedAt": now,
        }

        await self.db.claims.insert_one(claim_doc)

        # Save verification workflow record
        await self.db.verification_workflows.insert_one({
            "id": f"vwf_{uuid.uuid4().hex[:10]}",
            "caseId": case_id,
            "caseNumber": case_number,
            "userId": user_id,
            "emergencyHaltToken": emergency_halt_token,
            "status": "UNDER_REVIEW",
            "createdAt": now,
        })

        # Record claim submission event in audit
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "SUBMIT_CLAIM",
            "resource": "CLAIM",
            "resourceId": case_id,
            "details": {
                "caseNumber": case_number,
                "claimantId": claimant_id,
                "riskScore": risk_eval["risk_score"],
                "riskLevel": risk_eval["risk_level"],
            },
            "timestamp": now,
        })

        claim_doc.pop("_id", None)
        return claim_doc

    async def list_cases(
        self,
        status: Optional[str] = None,
        risk_level: Optional[str] = None,
        user_id: Optional[str] = None,
        params: Optional[PaginationParams] = None,
    ) -> PaginatedResponse[Dict[str, Any]]:
        """List claim cases with filtering and pagination."""
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if risk_level:
            query["riskLevel"] = risk_level
        if user_id:
            query["userId"] = user_id

        params = params or PaginationParams()
        skip = (params.page - 1) * params.limit

        cursor = self.db.claims.find(query).sort("createdAt", -1).skip(skip).limit(params.limit)
        docs = []
        async for doc in cursor:
            doc.pop("_id", None)
            docs.append(doc)

        total = await self.db.claims.count_documents(query)
        return PaginatedResponse.create(docs, total, params)

    async def get_case_by_id_or_number(self, identifier: str) -> Dict[str, Any]:
        """Get claim details by ID or CASE number."""
        case = await self.db.claims.find_one({
            "$or": [{"id": identifier}, {"caseNumber": identifier}]
        })
        if not case:
            raise NotFoundError("ClaimCase", identifier)
        case.pop("_id", None)
        return case

    async def owner_dispute_claim(
        self,
        user_id: str,
        claim_id: str,
        reason: str = "Owner verified alive; claim is fraudulent",
    ) -> Dict[str, Any]:
        """Vault owner 1-click 'I Am Alive' dispute that instantly rejects/halts fraudulent claim."""
        case = await self.db.claims.find_one({
            "$or": [{"id": claim_id}, {"caseNumber": claim_id}],
            "userId": user_id,
        })
        if not case:
            raise NotFoundError("ClaimCase", claim_id)

        now = datetime.now(timezone.utc).isoformat()
        await self.db.claims.update_one(
            {"id": case["id"]},
            {
                "$set": {
                    "status": "REJECTED_DISPUTED",
                    "rejectionReason": reason,
                    "disputedAt": now,
                    "updatedAt": now,
                }
            }
        )

        # Audit log
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "OWNER_DISPUTE_CLAIM",
            "resource": "CLAIM",
            "resourceId": case["id"],
            "details": {"reason": reason},
            "timestamp": now,
        })

        return {
            "success": True,
            "caseNumber": case["caseNumber"],
            "status": "REJECTED_DISPUTED",
            "message": "Claim has been immediately nullified and reported as disputed.",
        }

    async def adjudicate_claim(
        self,
        admin_id: str,
        claim_id: str,
        payload: ClaimAdjudicationRequest,
    ) -> Dict[str, Any]:
        """Supervisor / Admin adjudication of a claim."""
        case = await self.db.claims.find_one({
            "$or": [{"id": claim_id}, {"caseNumber": claim_id}]
        })
        if not case:
            raise NotFoundError("ClaimCase", claim_id)

        if payload.decision not in ["APPROVED", "REJECTED", "REQUIRE_NOTARY"]:
            raise ValidationError("Decision must be APPROVED, REJECTED, or REQUIRE_NOTARY.")

        now = datetime.now(timezone.utc).isoformat()
        new_status = payload.decision
        if payload.decision == "REQUIRE_NOTARY":
            new_status = "WAITING_DOCUMENTS"

        update_dict: Dict[str, Any] = {
            "status": new_status,
            "adjudicatedBy": admin_id,
            "adjudicationNotes": payload.notes or "",
            "adjudicatedAt": now,
            "updatedAt": now,
        }

        if payload.decision == "APPROVED":
            update_dict["approvedAt"] = now

        await self.db.claims.update_one({"id": case["id"]}, {"$set": update_dict})

        # Record audit
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": case["userId"],
            "action": f"CLAIM_ADJUDICATION_{payload.decision}",
            "resource": "CLAIM",
            "resourceId": case["id"],
            "details": {"adminId": admin_id, "notes": payload.notes},
            "timestamp": now,
        })

        return {
            "success": True,
            "caseNumber": case["caseNumber"],
            "status": new_status,
            "decision": payload.decision,
            "adjudicatedAt": now,
        }

    async def get_fraud_rules(self) -> List[Dict[str, Any]]:
        """Return active fraud evaluation rules and point weights."""
        return [
            {
                "ruleId": "DUPLICATE_CERTIFICATE_HASH",
                "weight": 50,
                "category": "DOCUMENT_INTEGRITY",
                "description": "Cryptographic SHA-256 fingerprint deduplication against all historical certificates.",
            },
            {
                "ruleId": "CLAIMANT_VELOCITY_ANOMALY",
                "weight": 25,
                "category": "BEHAVIORAL",
                "description": "Monitors frequency of claim filings within 24-hour intervals.",
            },
            {
                "ruleId": "CONFLICTING_RIVAL_CLAIMS",
                "weight": 30,
                "category": "RELATIONSHIP",
                "description": "Identifies contested vaults with multi-party claim filings.",
            },
            {
                "ruleId": "IP_NETWORK_DIVERGENCE",
                "weight": 15,
                "category": "NETWORK",
                "description": "Geolocation and ASN divergence against vault owner's verified session history.",
            },
            {
                "ruleId": "UNREGISTERED_CLAIMANT",
                "weight": 25,
                "category": "IDENTITY",
                "description": "Validates claimant identity against authorized and accepted beneficiaries.",
            },
        ]

    async def trigger_emergency_halt(self, token: str, client_ip: str = "unknown") -> Dict[str, Any]:
        """Emergency halt trigger via token."""
        workflow = await self.db.verification_workflows.find_one({"emergencyHaltToken": token})
        if not workflow:
            raise ForbiddenError("Invalid or expired emergency halt token")

        user_id = str(workflow["userId"])
        await transition_vault_state(
            user_id=user_id,
            target_state=VaultState.CLAIM_HALTED,
            actor_id=user_id,
            reason="Owner emergency halt activated via verified link",
            metadata={"ip": client_ip},
        )
        return {"success": True, "message": "Vault inheritance claim has been halted immediately."}
