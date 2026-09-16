"""
Generic Base MongoDB Repository — SecureVault Enterprise
Provides standard asynchronous CRUD, filtering, pagination, and sorting.
"""

from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection
from app.infrastructure.pagination import PaginationParams


class BaseRepository:
    """Base repository encapsulating raw Motor collection interactions."""

    def __init__(self, collection: AsyncIOMotorCollection):
        self.collection = collection

    @staticmethod
    def _normalize_id(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Converts MongoDB _id ObjectId to string id if present."""
        if not doc:
            return None
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
            if "id" not in doc:
                doc["id"] = doc["_id"]
        return doc

    async def find_one(self, filter_query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        doc = await self.collection.find_one(filter_query)
        return self._normalize_id(doc)

    async def find_by_id(self, entity_id: str) -> Optional[Dict[str, Any]]:
        query: Dict[str, Any] = {"id": entity_id}
        if ObjectId.is_valid(entity_id):
            doc = await self.collection.find_one({"$or": [{"id": entity_id}, {"_id": ObjectId(entity_id)}]})
        else:
            doc = await self.collection.find_one(query)
        return self._normalize_id(doc)

    async def find_many(
        self,
        filter_query: Dict[str, Any],
        params: Optional[PaginationParams] = None,
        projection: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        total = await self.collection.count_documents(filter_query)
        if total == 0:
            return [], 0

        cursor = self.collection.find(filter_query, projection)

        if params:
            sort_tuples = params.to_mongo_sort()
            cursor = cursor.sort(sort_tuples).skip(params.skip).limit(params.limit)

        docs = await cursor.to_list(length=params.limit if params else 100)
        return [self._normalize_id(d) for d in docs], total

    async def insert(self, doc: Dict[str, Any]) -> str:
        res = await self.collection.insert_one(doc)
        return str(res.inserted_id)

    async def update_one(
        self, filter_query: Dict[str, Any], update_doc: Dict[str, Any], upsert: bool = False
    ) -> int:
        res = await self.collection.update_one(filter_query, update_doc, upsert=upsert)
        return res.modified_count

    async def delete_one(self, filter_query: Dict[str, Any]) -> int:
        res = await self.collection.delete_one(filter_query)
        return res.deleted_count

    async def count(self, filter_query: Dict[str, Any]) -> int:
        return await self.collection.count_documents(filter_query)
