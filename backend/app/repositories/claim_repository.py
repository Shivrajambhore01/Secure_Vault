"""
Claim & Verification Repository — SecureVault Enterprise
"""

from typing import Any, Dict, List, Optional, Tuple
from app.core.database import db
from app.repositories.base import BaseRepository
from app.infrastructure.pagination import PaginationParams


class ClaimRepository(BaseRepository):
    def __init__(self):
        super().__init__(db["verification_requests"])

    async def get_by_user(self, user_id: str) -> List[Dict[str, Any]]:
        docs, _ = await self.find_many({"userId": user_id})
        return docs

    async def get_by_case_number(self, case_number: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({"caseNumber": case_number})

    async def get_active_claim_for_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        return await self.find_one({"workflowId": workflow_id, "status": {"$ne": "REJECTED"}})

    async def list_cases(
        self,
        status: Optional[str] = None,
        risk_level: Optional[str] = None,
        params: Optional[PaginationParams] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        query: Dict[str, Any] = {}
        if status and status.upper() != "ALL":
            query["status"] = status.upper()
        if risk_level and risk_level.upper() != "ALL":
            query["riskLevel"] = risk_level.upper()
        if params and params.search:
            query["$or"] = [
                {"caseNumber": {"$regex": params.search, "$options": "i"}},
                {"nomineeName": {"$regex": params.search, "$options": "i"}},
                {"ownerEmail": {"$regex": params.search, "$options": "i"}},
            ]
        return await self.find_many(query, params=params)
