"""
Policy Repository — SecureVault Enterprise
"""

from typing import Any, Dict, List, Optional
from app.core.database import db
from app.repositories.base import BaseRepository


class PolicyRepository(BaseRepository):
    def __init__(self):
        super().__init__(db["policies"])

    async def get_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        docs, _ = await self.find_many({"userId": user_id})
        return docs

    async def get_default_policy(self, user_id: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({"userId": user_id, "isDefault": True})
