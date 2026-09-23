"""
Session & Device Management Service — SecureVault Enterprise
Tracks active sessions, device fingerprints, concurrency caps, and revocations.
"""

import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import Request

from app.core.database import db
from app.domain.exceptions import NotFoundError, UnauthorizedError
from app.services.base import BaseService

MAX_CONCURRENT_SESSIONS = 5


class SessionService(BaseService):
    def __init__(self):
        super().__init__()
        self.sessions_col = db["user_sessions"]
        self.devices_col = db["devices"]

    def _extract_device_info(self, request: Request) -> Dict[str, str]:
        ua_raw = request.headers.get("user-agent", "unknown")
        ua = ua_raw.lower()
        browser = "Unknown Browser"
        os_name = "Unknown OS"

        if "firefox/" in ua:
            browser = "Firefox"
        elif "edg/" in ua:
            browser = "Edge"
        elif "chrome/" in ua and "chromium" not in ua:
            browser = "Chrome"
        elif "safari/" in ua and "chrome" not in ua:
            browser = "Safari"
        elif "opera" in ua or "opr/" in ua:
            browser = "Opera"

        if "windows" in ua:
            os_name = "Windows"
        elif "macintosh" in ua or "mac os x" in ua:
            os_name = "macOS"
        elif "linux" in ua and "android" not in ua:
            os_name = "Linux"
        elif "android" in ua:
            os_name = "Android"
        elif "iphone" in ua or "ipad" in ua:
            os_name = "iOS"

        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "127.0.0.1"
        )
        return {"browser": browser, "os": os_name, "ip": ip, "raw_ua": ua_raw}

    async def create_session(
        self,
        user_id: str,
        request: Request,
        token_hash: Optional[str] = None,
        duration_days: int = 7,
    ) -> str:
        dev_info = self._extract_device_info(request)
        session_id = secrets.token_hex(32)
        device_id = hashlib.sha256(f"{user_id}:{dev_info['browser']}:{dev_info['os']}".encode()).hexdigest()[:16]
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=duration_days)

        # Enforce max concurrent sessions via LRU
        active_count = await self.sessions_col.count_documents({"userId": user_id, "status": "ACTIVE"})
        if active_count >= MAX_CONCURRENT_SESSIONS:
            oldest = await self.sessions_col.find_one({"userId": user_id, "status": "ACTIVE"}, sort=[("createdAt", 1)])
            if oldest:
                await self.sessions_col.update_one(
                    {"sessionId": oldest["sessionId"]},
                    {"$set": {"status": "TERMINATED", "terminatedAt": now.isoformat(), "terminationReason": "MAX_CONCURRENT_LIMIT"}},
                )

        # Record session
        session_doc = {
            "sessionId": session_id,
            "userId": user_id,
            "deviceId": device_id,
            "tokenHash": token_hash or "",
            "browser": dev_info["browser"],
            "os": dev_info["os"],
            "ipAddress": dev_info["ip"],
            "userAgent": dev_info["raw_ua"],
            "status": "ACTIVE",
            "createdAt": now.isoformat(),
            "lastSeen": now.isoformat(),
            "expiresAt": expires_at,  # Date object for MongoDB TTL index
        }
        await self.sessions_col.insert_one(session_doc)

        # Record or update device inventory
        await self.devices_col.update_one(
            {"id": device_id, "userId": user_id},
            {
                "$set": {
                    "id": device_id,
                    "userId": user_id,
                    "browser": dev_info["browser"],
                    "os": dev_info["os"],
                    "ipAddress": dev_info["ip"],
                    "lastSeen": now.isoformat(),
                },
                "$setOnInsert": {
                    "isTrusted": False,
                    "firstSeen": now.isoformat(),
                },
            },
            upsert=True,
        )

        return session_id

    async def list_active_sessions(self, user_id: str, current_session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        sessions = await self.sessions_col.find({"userId": user_id, "status": "ACTIVE"}).sort("lastSeen", -1).to_list(20)
        results = []
        for s in sessions:
            results.append({
                "session_id": s["sessionId"],
                "browser": s.get("browser", "Unknown"),
                "os": s.get("os", "Unknown"),
                "ip_address": s.get("ipAddress", "unknown"),
                "created_at": s.get("createdAt"),
                "last_seen": s.get("lastSeen"),
                "is_current": s["sessionId"] == current_session_id,
            })
        return results

    async def terminate_session(self, user_id: str, session_id: str) -> None:
        res = await self.sessions_col.update_one(
            {"sessionId": session_id, "userId": user_id, "status": "ACTIVE"},
            {"$set": {"status": "TERMINATED", "terminatedAt": datetime.now(timezone.utc).isoformat()}},
        )
        if res.matched_count == 0:
            raise NotFoundError("Session", session_id)

    async def terminate_all_other_sessions(self, user_id: str, current_session_id: str) -> int:
        res = await self.sessions_col.update_many(
            {"userId": user_id, "sessionId": {"$ne": current_session_id}, "status": "ACTIVE"},
            {"$set": {"status": "TERMINATED", "terminatedAt": datetime.now(timezone.utc).isoformat()}},
        )
        return res.modified_count

    async def list_devices(self, user_id: str) -> List[Dict[str, Any]]:
        devices = await self.devices_col.find({"userId": user_id}).sort("lastSeen", -1).to_list(20)
        for d in devices:
            d["_id"] = str(d["_id"])
        return devices

    async def set_device_trusted(self, user_id: str, device_id: str, trusted: bool) -> None:
        await self.devices_col.update_one(
            {"id": device_id, "userId": user_id},
            {"$set": {"isTrusted": trusted, "trustedAt": datetime.now(timezone.utc).isoformat() if trusted else None}},
        )
