"""
Security Operations Center (SOC) & SIEM Threat Detection Service — SecureVault Enterprise
Phase 10:
- Cryptographic hash-chained tamper-evident audit ledger
- SIEM anomaly & threat detection (impossible travel, bulk secret decryption velocity, brute force)
- Automated threat containment (session termination, vault lockdown)
"""

import hashlib
import json
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.database import db as default_db
from app.domain.exceptions import NotFoundError, ValidationError, ForbiddenError

GENESIS_HASH = "0" * 64


class AuditStreamBroadcaster:
    """Manages active subscriber asyncio.Queues for real-time SSE audit streaming."""
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def publish(self, event: Dict[str, Any]) -> None:
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                    q.put_nowait(event)
                except Exception:
                    pass


audit_broadcaster = AuditStreamBroadcaster()


class ContainmentActionRequest(BaseModel):
    action: str = Field(..., description="REVOKE_ALL_SESSIONS | LOCK_VAULT | ENFORCE_MFA")
    reason: Optional[str] = "Manual administrative lockdown executed via SOC"


class SecuritySiemService:
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self.db = db if db is not None else default_db

    @staticmethod
    def compute_entry_hash(
        prev_hash: str,
        timestamp: str,
        user_id: str,
        action: str,
        resource: str,
        resource_id: str,
        metadata: Dict[str, Any],
    ) -> str:
        """Compute tamper-evident SHA-256 block hash for an audit ledger entry."""
        canon_meta = json.dumps(metadata or {}, sort_keys=True)
        block_str = f"{prev_hash}:{timestamp}:{user_id}:{action}:{resource}:{resource_id}:{canon_meta}"
        return hashlib.sha256(block_str.encode("utf-8")).hexdigest()

    async def record_chained_event(
        self,
        user_id: str,
        action: str,
        resource: str,
        resource_id: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Record an audit event appended to the cryptographic hash chain."""
        metadata = metadata or {}
        now = datetime.now(timezone.utc).isoformat()

        # Retrieve the latest entry in the user's ledger chain
        latest = await self.db.audit_logs.find_one(
            {"userId": user_id, "chainIndex": {"$exists": True}},
            sort=[("chainIndex", -1)]
        )

        if latest and latest.get("entryHash"):
            prev_hash = latest["entryHash"]
            chain_index = latest.get("chainIndex", 1) + 1
        else:
            prev_hash = GENESIS_HASH
            chain_index = 1

        entry_hash = self.compute_entry_hash(
            prev_hash=prev_hash,
            timestamp=now,
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            metadata=metadata,
        )

        log_id = f"aud_{uuid.uuid4().hex[:14]}"
        log_doc = {
            "id": log_id,
            "userId": user_id,
            "action": action,
            "resource": resource,
            "resourceId": resource_id,
            "metadata": metadata,
            "ip": ip,
            "userAgent": user_agent,
            "prevHash": prev_hash,
            "entryHash": entry_hash,
            "chainIndex": chain_index,
            "timestamp": now,
        }

        await self.db.audit_logs.insert_one(log_doc)
        log_doc.pop("_id", None)
        audit_broadcaster.publish(dict(log_doc))
        return log_doc

    async def verify_audit_integrity(self, user_id: str) -> Dict[str, Any]:
        """
        Verify the complete cryptographic hash chain for a user.
        Validates sequential linking and individual block hash correctness.
        """
        cursor = self.db.audit_logs.find(
            {"userId": user_id, "chainIndex": {"$exists": True}}
        ).sort("chainIndex", 1)

        expected_prev_hash = GENESIS_HASH
        count = 0
        async for entry in cursor:
            count += 1
            # 1. Check prevHash link
            if entry.get("prevHash") != expected_prev_hash:
                return {
                    "is_valid": False,
                    "broken_at_index": entry.get("chainIndex"),
                    "broken_at_id": entry.get("id"),
                    "reason": f"Chain break at index {entry.get('chainIndex')}: prevHash mismatch.",
                    "total_verified": count - 1,
                }

            # 2. Recompute current hash
            recomputed = self.compute_entry_hash(
                prev_hash=entry["prevHash"],
                timestamp=entry["timestamp"],
                user_id=entry["userId"],
                action=entry["action"],
                resource=entry["resource"],
                resource_id=entry.get("resourceId", ""),
                metadata=entry.get("metadata", {}),
            )

            if recomputed != entry.get("entryHash"):
                return {
                    "is_valid": False,
                    "broken_at_index": entry.get("chainIndex"),
                    "broken_at_id": entry.get("id"),
                    "reason": f"Tampered record at index {entry.get('chainIndex')}: hash signature invalid.",
                    "total_verified": count - 1,
                }

            expected_prev_hash = entry["entryHash"]

        return {
            "is_valid": True,
            "total_verified": count,
            "head_hash": expected_prev_hash,
            "message": "Cryptographic audit chain intact. Zero tampering detected.",
        }

    async def list_audit_events(
        self,
        user_id: str,
        limit: int = 50,
        page: int = 1,
        action: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Retrieve paginated audit logs for the SOC Explorer."""
        query: Dict[str, Any] = {"userId": user_id}
        if action:
            query["action"] = action

        skip = (page - 1) * limit
        cursor = self.db.audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            doc.pop("_id", None)
            items.append(doc)

        total = await self.db.audit_logs.count_documents(query)
        return {"items": items, "total": total, "page": page, "limit": limit}

    async def evaluate_threat_signals(
        self,
        user_id: str,
        event_type: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        SIEM Anomaly Detector:
        - Impossible Travel (geographic velocity check)
        - Bulk Decrypt Anomaly (> 5 secret decryptions in 60s)
        - Brute Force Login Velocity (>= 5 failed attempts in 5m)
        """
        context = context or {}
        threat_detected = False
        threat_type = None
        severity = "LOW"
        details = {}
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        # 1. Check Bulk Secret Decryption Anomaly
        if event_type in ["ASSET_DECRYPT", "BULK_EXPORT"]:
            one_minute_ago = (now - timedelta(seconds=60)).isoformat()
            recent_decrypts = await self.db.audit_logs.count_documents({
                "userId": user_id,
                "action": "DECRYPT_ASSET_SECRET",
                "timestamp": {"$gte": one_minute_ago},
            })

            # Check if this addition would breach threshold (>= 5)
            if recent_decrypts >= 4:
                threat_detected = True
                threat_type = "BULK_DECRYPT_ANOMALY"
                severity = "CRITICAL"
                details = {
                    "recentCount": recent_decrypts + 1,
                    "windowSeconds": 60,
                    "description": "Rapid consecutive secret decryptions detected. Possible credential harvesting.",
                }

        # 2. Check Impossible Travel
        elif event_type == "LOGIN_SUCCESS":
            current_country = context.get("country", "US")
            current_city = context.get("city", "New York")

            # Look up previous login
            prev_login = await self.db.audit_logs.find_one(
                {"userId": user_id, "action": "LOGIN"},
                sort=[("timestamp", -1)]
            )
            if prev_login:
                prev_time_str = prev_login.get("timestamp")
                prev_meta = prev_login.get("metadata", {})
                prev_country = prev_meta.get("country") or "US"

                if prev_time_str and prev_country != current_country:
                    try:
                        prev_time = datetime.fromisoformat(prev_time_str.replace("Z", "+00:00"))
                        elapsed_seconds = (now - prev_time).total_seconds()
                        # If different country in under 15 minutes (900 seconds) -> Impossible Travel
                        if elapsed_seconds < 900:
                            threat_detected = True
                            threat_type = "IMPOSSIBLE_TRAVEL"
                            severity = "HIGH"
                            details = {
                                "fromLocation": f"{prev_login.get('ip')} ({prev_country})",
                                "toLocation": f"{context.get('ip')} ({current_country})",
                                "elapsedSeconds": int(elapsed_seconds),
                                "description": f"Impossible travel: session relocated from {prev_country} to {current_country} in {int(elapsed_seconds)}s.",
                            }
                    except Exception:
                        pass

        # 3. Check Brute Force Attack
        elif event_type == "LOGIN_FAILED":
            five_mins_ago = (now - timedelta(minutes=5)).isoformat()
            failed_count = await self.db.audit_logs.count_documents({
                "userId": user_id,
                "action": "LOGIN_FAILED",
                "timestamp": {"$gte": five_mins_ago},
            })
            if failed_count >= 4:
                threat_detected = True
                threat_type = "BRUTE_FORCE_ATTACK"
                severity = "HIGH"
                details = {
                    "failedAttempts": failed_count + 1,
                    "windowMinutes": 5,
                    "description": "High frequency of failed authentication attempts detected.",
                }

        # If threat identified, log to security_threats
        if threat_detected:
            threat_id = f"thr_{uuid.uuid4().hex[:12]}"
            threat_doc = {
                "id": threat_id,
                "userId": user_id,
                "threatType": threat_type,
                "severity": severity,
                "details": details,
                "status": "ACTIVE",
                "createdAt": now_iso,
            }
            await self.db.security_threats.insert_one(threat_doc)

            # Also log chained audit event
            await self.record_chained_event(
                user_id=user_id,
                action=f"THREAT_DETECTED_{threat_type}",
                resource="SECURITY",
                resource_id=threat_id,
                metadata=details,
            )

        return {
            "threat_detected": threat_detected,
            "threat_type": threat_type,
            "severity": severity,
            "details": details,
        }

    async def list_active_threats(self, user_id: str) -> List[Dict[str, Any]]:
        """List active security incidents and SIEM flags."""
        cursor = self.db.security_threats.find(
            {"userId": user_id, "status": "ACTIVE"}
        ).sort("createdAt", -1)
        threats = []
        async for doc in cursor:
            doc.pop("_id", None)
            threats.append(doc)
        return threats

    async def execute_containment_action(
        self,
        user_id: str,
        payload: ContainmentActionRequest,
    ) -> Dict[str, Any]:
        """Execute immediate SOC containment action."""
        now = datetime.now(timezone.utc).isoformat()
        action = payload.action

        if action not in ["REVOKE_ALL_SESSIONS", "LOCK_VAULT", "ENFORCE_MFA"]:
            raise ValidationError("Action must be REVOKE_ALL_SESSIONS, LOCK_VAULT, or ENFORCE_MFA.")

        if action == "REVOKE_ALL_SESSIONS":
            # Invalidate all user sessions
            res = await self.db.user_sessions.update_many(
                {"userId": user_id, "status": "ACTIVE"},
                {"$set": {"status": "REVOKED", "revokedAt": now, "reason": payload.reason}}
            )
            affected_count = res.modified_count

        elif action == "LOCK_VAULT":
            await self.db.users.update_one(
                {"$or": [{"id": user_id}, {"_id": user_id}]},
                {"$set": {"isVaultLocked": True, "vaultLockedAt": now}}
            )
            affected_count = 1

        elif action == "ENFORCE_MFA":
            await self.db.users.update_one(
                {"$or": [{"id": user_id}, {"_id": user_id}]},
                {"$set": {"stepUpMfaRequired": True}}
            )
            affected_count = 1

        # Mark active threats as MITIGATED
        await self.db.security_threats.update_many(
            {"userId": user_id, "status": "ACTIVE"},
            {"$set": {"status": "MITIGATED", "mitigatedAt": now, "mitigationAction": action}}
        )

        # Log chained audit event
        await self.record_chained_event(
            user_id=user_id,
            action=f"CONTAINMENT_{action}",
            resource="SECURITY",
            resource_id=user_id,
            metadata={"reason": payload.reason, "affectedCount": affected_count},
        )

        return {
            "success": True,
            "action": action,
            "affectedCount": affected_count,
            "status": "CONTAINED",
            "timestamp": now,
        }
