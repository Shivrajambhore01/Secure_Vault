"""
User Repository — SecureVault Enterprise
"""

from typing import Any, Dict, Optional
from bson import ObjectId
from app.core.database import db
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    def __init__(self):
        super().__init__(db["users"])

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({"email": email.lower().strip()})

    async def update_last_active(self, user_id: str, timestamp_iso: str) -> None:
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        await self.update_one(query, {"$set": {"lastActive": timestamp_iso, "logoutTime": None}})

    async def update_storage_usage(self, user_id: str, delta_bytes: int) -> None:
        query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
        await self.update_one(query, {"$inc": {"storageUsed": delta_bytes}})
