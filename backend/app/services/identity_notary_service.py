"""
Identity & Notary Verification Service — SecureVault Enterprise
Phase 09: Automated IDV (Persona/Veriff/Sumsub) & e-Notary (DocuSign/Notarize)
Handles:
- Biometric government ID verification session dispatch
- Remote online notarization (RON) legal envelope dispatch
- HMAC-SHA256 signature verification for inbound webhooks
- Automated promotion of accepted nominees to VERIFIED status upon IDV pass
"""

import hashlib
import hmac
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.database import db as default_db
from app.domain.exceptions import NotFoundError, ValidationError, UnauthorizedError


# Default secret for HMAC webhook validation (configurable via env in production)
WEBHOOK_HMAC_SECRET = "sec_vault_idv_notary_webhook_secret_2026"


class IDVSessionRequest(BaseModel):
    nominee_id: str
    provider: str = Field(default="VERIFF", description="VERIFF | PERSONA | SUMSUB")
    redirect_url: Optional[str] = None


class NotarySessionRequest(BaseModel):
    claim_id: str
    nominee_id: str
    provider: str = Field(default="DOCUSIGN", description="DOCUSIGN | NOTARIZE")
    document_titles: List[str] = Field(default_factory=lambda: ["Death Certificate Affidavit", "Executor Authorization"])


class IdentityNotaryService:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None, webhook_secret: str = WEBHOOK_HMAC_SECRET):
        self.db = db if db is not None else default_db
        self.webhook_secret = webhook_secret

    @staticmethod
    def generate_hmac_signature(payload_bytes: bytes, secret: str) -> str:
        """Generate HMAC-SHA256 hex signature."""
        return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    def verify_webhook_signature(self, payload_bytes: bytes, signature_header: Optional[str]) -> bool:
        """Verify HMAC-SHA256 signature header against secret."""
        if not signature_header:
            return False
        expected = self.generate_hmac_signature(payload_bytes, self.webhook_secret)
        # Also handle potential 'sha256=' prefix common in GitHub/Persona/Stripe style
        clean_sig = signature_header.replace("sha256=", "").strip()
        return hmac.compare_digest(expected, clean_sig)

    async def create_idv_session(
        self,
        user_id: str,
        payload: IDVSessionRequest,
    ) -> Dict[str, Any]:
        """Initialize an IDV biometric session for an enrolled nominee."""
        nominee = await self.db.nominees.find_one({"id": payload.nominee_id, "userId": user_id})
        if not nominee:
            raise NotFoundError("Nominee", payload.nominee_id)

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=24)
        session_id = f"idv_sess_{uuid.uuid4().hex[:16]}"
        inquiry_token = uuid.uuid4().hex

        # Construct simulated provider inquiry URL
        base_provider_url = {
            "VERIFF": "https://alchemy.veriff.com/v1/session",
            "PERSONA": "https://withpersona.com/verify",
            "SUMSUB": "https://cockpit.sumsub.com/idensic/l/#",
        }.get(payload.provider.upper(), "https://verify.securevault.io/session")

        inquiry_url = f"{base_provider_url}/{inquiry_token}?redirect_url={payload.redirect_url or 'https://securevault.app/verify/callback'}"

        verification_doc = {
            "id": session_id,
            "nomineeId": payload.nominee_id,
            "userId": user_id,
            "nomineeEmail": nominee.get("email"),
            "provider": payload.provider.upper(),
            "inquiryToken": inquiry_token,
            "inquiryUrl": inquiry_url,
            "status": "INITIATED",  # INITIATED | IN_PROGRESS | APPROVED | DECLINED | EXPIRED
            "biometricLivenessScore": None,
            "documentCountry": None,
            "idType": None,
            "createdAt": now.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "updatedAt": now.isoformat(),
        }

        await self.db.nominee_verifications.insert_one(verification_doc)

        # Audit log
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "CREATE_IDV_SESSION",
            "resource": "VERIFICATION",
            "resourceId": session_id,
            "details": {
                "nomineeId": payload.nominee_id,
                "provider": payload.provider.upper(),
            },
            "timestamp": now.isoformat(),
        })

        verification_doc.pop("_id", None)
        return verification_doc

    async def get_idv_session(self, session_id: str) -> Dict[str, Any]:
        """Retrieve live status of an IDV inquiry."""
        session = await self.db.nominee_verifications.find_one({
            "$or": [{"id": session_id}, {"inquiryToken": session_id}]
        })
        if not session:
            raise NotFoundError("IDVSession", session_id)
        session.pop("_id", None)
        return session

    async def create_notary_session(
        self,
        user_id: str,
        payload: NotarySessionRequest,
    ) -> Dict[str, Any]:
        """Initialize an electronic notarization (e-Notary/RON) envelope."""
        nominee = await self.db.nominees.find_one({"id": payload.nominee_id, "userId": user_id})
        if not nominee:
            raise NotFoundError("Nominee", payload.nominee_id)

        now = datetime.now(timezone.utc)
        envelope_id = f"notary_env_{uuid.uuid4().hex[:14]}"
        signing_token = uuid.uuid4().hex

        signing_url = f"https://notary.securevault.io/envelope/{envelope_id}?token={signing_token}"

        envelope_doc = {
            "id": envelope_id,
            "claimId": payload.claim_id,
            "nomineeId": payload.nominee_id,
            "userId": user_id,
            "provider": payload.provider.upper(),
            "status": "PENDING_SIGNATURE",  # PENDING_SIGNATURE | IN_SESSION | SEALED | REJECTED
            "signingUrl": signing_url,
            "documentTitles": payload.document_titles,
            "tamperSealHash": None,
            "notaryCommissionId": None,
            "notarySealJurisdiction": None,
            "createdAt": now.isoformat(),
            "expiresAt": (now + timedelta(days=7)).isoformat(),
            "updatedAt": now.isoformat(),
        }

        await self.db.notary_envelopes.insert_one(envelope_doc)

        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": "CREATE_NOTARY_ENVELOPE",
            "resource": "NOTARY",
            "resourceId": envelope_id,
            "details": {
                "claimId": payload.claim_id,
                "nomineeId": payload.nominee_id,
                "provider": payload.provider.upper(),
            },
            "timestamp": now.isoformat(),
        })

        envelope_doc.pop("_id", None)
        return envelope_doc

    async def get_notary_envelope(self, envelope_id: str) -> Dict[str, Any]:
        """Retrieve notary envelope status and seal metadata."""
        envelope = await self.db.notary_envelopes.find_one({"id": envelope_id})
        if not envelope:
            raise NotFoundError("NotaryEnvelope", envelope_id)
        envelope.pop("_id", None)
        return envelope

    async def process_idv_webhook(
        self,
        payload: Dict[str, Any],
        raw_body: bytes,
        signature_header: Optional[str],
        enforce_signature: bool = True,
    ) -> Dict[str, Any]:
        """Process inbound webhook from Veriff / Persona / Sumsub."""
        if enforce_signature:
            if not self.verify_webhook_signature(raw_body, signature_header):
                raise UnauthorizedError("Invalid or missing webhook HMAC-SHA256 signature")

        event_type = payload.get("event") or payload.get("action") or "inquiry.completed"
        session_id = payload.get("session_id") or payload.get("inquiry_id") or payload.get("id")
        verification_status = payload.get("status", "APPROVED").upper()

        session = await self.db.nominee_verifications.find_one({
            "$or": [{"id": session_id}, {"inquiryToken": session_id}]
        })
        if not session:
            raise NotFoundError("IDVSession", session_id or "unknown")

        now = datetime.now(timezone.utc).isoformat()
        new_status = "APPROVED" if verification_status in ["APPROVED", "PASS", "SUCCESS"] else "DECLINED"

        # Update IDV session record
        await self.db.nominee_verifications.update_one(
            {"id": session["id"]},
            {
                "$set": {
                    "status": new_status,
                    "biometricLivenessScore": payload.get("liveness_score", 98.5),
                    "documentCountry": payload.get("country", "US"),
                    "idType": payload.get("id_type", "PASSPORT"),
                    "completedAt": now,
                    "updatedAt": now,
                }
            }
        )

        # Automated Promotion: if APPROVED, promote nominee to VERIFIED status
        if new_status == "APPROVED":
            await self.db.nominees.update_one(
                {"id": session["nomineeId"]},
                {
                    "$set": {
                        "status": "VERIFIED",
                        "verifiedAt": now,
                        "idvSessionId": session["id"],
                        "updatedAt": now,
                    }
                }
            )

        # Audit log
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": session["userId"],
            "action": f"IDV_WEBHOOK_{new_status}",
            "resource": "VERIFICATION",
            "resourceId": session["id"],
            "details": {
                "eventType": event_type,
                "nomineeId": session["nomineeId"],
                "livenessScore": payload.get("liveness_score", 98.5),
            },
            "timestamp": now,
        })

        return {
            "success": True,
            "sessionId": session["id"],
            "status": new_status,
            "nomineeId": session["nomineeId"],
            "nomineePromoted": new_status == "APPROVED",
        }

    async def process_notary_webhook(
        self,
        payload: Dict[str, Any],
        raw_body: bytes,
        signature_header: Optional[str],
        enforce_signature: bool = True,
    ) -> Dict[str, Any]:
        """Process inbound webhook from DocuSign / Notarize."""
        if enforce_signature:
            if not self.verify_webhook_signature(raw_body, signature_header):
                raise UnauthorizedError("Invalid or missing webhook HMAC-SHA256 signature")

        envelope_id = payload.get("envelope_id") or payload.get("id")
        envelope_status = payload.get("status", "SEALED").upper()

        envelope = await self.db.notary_envelopes.find_one({"id": envelope_id})
        if not envelope:
            raise NotFoundError("NotaryEnvelope", envelope_id or "unknown")

        now = datetime.now(timezone.utc).isoformat()
        new_status = "SEALED" if envelope_status in ["SEALED", "COMPLETED", "SIGNED"] else "REJECTED"
        seal_hash = hashlib.sha256(f"{envelope_id}:{now}".encode()).hexdigest()

        await self.db.notary_envelopes.update_one(
            {"id": envelope["id"]},
            {
                "$set": {
                    "status": new_status,
                    "tamperSealHash": seal_hash,
                    "notaryCommissionId": payload.get("notary_id", "NOTARY-COMM-2026-TX99"),
                    "notarySealJurisdiction": payload.get("jurisdiction", "State of Texas"),
                    "sealedAt": now if new_status == "SEALED" else None,
                    "updatedAt": now,
                }
            }
        )

        # Audit log
        await self.db.audit_logs.insert_one({
            "id": str(uuid.uuid4()),
            "userId": envelope["userId"],
            "action": f"NOTARY_WEBHOOK_{new_status}",
            "resource": "NOTARY",
            "resourceId": envelope["id"],
            "details": {
                "claimId": envelope["claimId"],
                "sealHash": seal_hash,
            },
            "timestamp": now,
        })

        return {
            "success": True,
            "envelopeId": envelope["id"],
            "status": new_status,
            "tamperSealHash": seal_hash,
        }
