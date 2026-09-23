"""
User Service — SecureVault Enterprise
Profile management, heartbeat processing, and vault storage quotas.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from app.domain.exceptions import NotFoundError
from app.repositories.user_repository import UserRepository
from app.services.base import BaseService


class UserService(BaseService):
    def __init__(self, user_repo: Optional[UserRepository] = None):
        super().__init__()
        self.user_repo = user_repo or UserRepository()

    async def get_profile(self, user_id: str) -> Dict[str, Any]:
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        # Exclude secrets
        user.pop("password", None)
        user.pop("pin", None)
        return user

    async def record_heartbeat(self, user_id: str) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        await self.user_repo.update_last_active(user_id, now_iso)
        return {"status": "ok", "last_active": now_iso}

    async def update_inactivity_settings(self, user_id: str, period_months: float) -> Dict[str, Any]:
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        await self.user_repo.update_one({"id": user_id}, {"$set": {"inactivityPeriod": period_months}})
        return {"message": "Inactivity setting updated", "inactivity_period": period_months}
