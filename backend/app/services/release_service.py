"""
Release Service — SecureVault Enterprise
Coordinates cryptographic key release and single-use temporary token generation.
"""

from typing import Any, Dict, List, Optional
from app.domain.exceptions import ForbiddenError, NotFoundError
from app.repositories.asset_repository import AssetRepository
from app.repositories.nominee_repository import NomineeRepository
from app.services.base import BaseService


class ReleaseService(BaseService):
    def __init__(
        self,
        asset_repo: Optional[AssetRepository] = None,
        nominee_repo: Optional[NomineeRepository] = None,
    ):
        super().__init__()
        self.asset_repo = asset_repo or AssetRepository()
        self.nominee_repo = nominee_repo or NomineeRepository()

    async def get_released_assets_for_nominee(self, token: str) -> List[Dict[str, Any]]:
        nominee = await self.nominee_repo.get_by_token(token)
        if not nominee:
            raise ForbiddenError("Invalid or expired nominee access token")

        nominee_id = nominee.get("id")
        assets = await self.asset_repo.get_by_nominee(nominee_id)

        # Sanitize sensitive internal keys while leaving decrypted fields accessible
        safe_assets = []
        for a in assets:
            a.pop("fileData", None)
            safe_assets.append(a)

        return safe_assets
