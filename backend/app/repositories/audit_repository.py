"""
Audit Repository — SecureVault Enterprise
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from app.core.database import db
from app.repositories.base import BaseRepository
from app.infrastructure.pagination import PaginationParams


class AuditRepository(BaseRepository):
    def __init__(self):
        super().__init__(db["audit_logs"])

    async def log_event(
        self,
        user_id: str,
        action: str,
        status: str = "SUCCESS",
        ip_address: str = "unknown",
        user_agent: str = "unknown",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        event = {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "action": action,
            "status": status,
            "ipAddress": ip_address,
            "userAgent": user_agent,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        return await self.insert(event)

    async def get_user_activity(
        self, user_id: str, params: Optional[PaginationParams] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        return await self.find_many({"userId": user_id}, params=params)
