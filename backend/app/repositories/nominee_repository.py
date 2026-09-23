"""
Nominee Repository — SecureVault Enterprise
"""

from typing import Any, Dict, List, Optional
from app.core.database import db
from app.repositories.base import BaseRepository


class NomineeRepository(BaseRepository):
    def __init__(self):
        super().__init__(db["nominees"])

    async def get_by_user(
        self,
        user_id: str,
        status: Optional[str] = None,
        tier: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {"userId": user_id}
        if status and status.upper() != "ALL":
            query["status"] = status.upper()
        if tier and tier.upper() != "ALL":
            query["tier"] = tier.upper()
        docs, _ = await self.find_many(query)
        return docs

    async def get_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({
            "$or": [
                {"accessToken": token},
                {"token": token},
                {"invitationToken": token},
            ]
        })

    async def get_by_email_and_user(self, email: str, user_id: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({"email": email.lower().strip(), "userId": user_id})
