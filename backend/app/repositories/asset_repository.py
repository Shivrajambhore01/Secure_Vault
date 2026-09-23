"""
Asset Repository — SecureVault Enterprise
"""

from typing import Any, Dict, List, Optional, Tuple
from app.core.database import db
from app.repositories.base import BaseRepository
from app.infrastructure.pagination import PaginationParams


class AssetRepository(BaseRepository):
    def __init__(self):
        super().__init__(db["assets"])

    async def get_by_user(
        self,
        user_id: str,
        category: Optional[str] = None,
        sensitivity: Optional[str] = None,
        tag: Optional[str] = None,
        search: Optional[str] = None,
        params: Optional[PaginationParams] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        query: Dict[str, Any] = {"userId": user_id}
        if category and category.upper() != "ALL":
            query["type"] = category.upper()
        if sensitivity and sensitivity.upper() != "ALL":
            query["sensitivity"] = sensitivity.upper()
        if tag and tag.strip():
            query["tags"] = tag.strip()

        search_term = search or (params.search if params else None)
        if search_term and search_term.strip():
            regex = {"$regex": search_term.strip(), "$options": "i"}
            query["$or"] = [
                {"name": regex},
                {"description": regex},
                {"tags": regex},
                {"fileName": regex},
            ]

        return await self.find_many(query, params=params)

    async def get_by_nominee(self, nominee_id: str) -> List[Dict[str, Any]]:
        query = {
            "$or": [
                {"nomineeId": nominee_id},
                {"nomineeIds": nominee_id},
                {"allowedNominees": nominee_id},
            ]
        }
        docs, _ = await self.find_many(query)
        return docs

    async def get_distinct_tags(self, user_id: str) -> List[str]:
        return await self.collection.distinct("tags", {"userId": user_id})
