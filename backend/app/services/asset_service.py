"""
Asset Service — SecureVault Enterprise
Handles asset CRUD, envelope encryption with KMS, versioning, rollback,
storage quotas, and immutable access auditing.
"""

import base64
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from bson import Binary

from app.core.database import db, db as default_db
from app.domain.exceptions import ForbiddenError, NotFoundError, UnauthorizedError, ValidationError
from app.infrastructure.pagination import PaginatedResponse, PaginationParams
from app.lib import kms
from app.lib.encryption import encrypt_bytes_gcm, decrypt_bytes_gcm
from app.repositories.asset_repository import AssetRepository
from app.repositories.user_repository import UserRepository
from app.repositories.audit_repository import AuditRepository
from app.security.crypto import CryptoService
from app.security.hashing import verify_secret
from app.services.base import BaseService


class AssetService(BaseService):
    def __init__(
        self,
        asset_repo: Optional[AssetRepository] = None,
        user_repo: Optional[UserRepository] = None,
        audit_repo: Optional[AuditRepository] = None,
        db: Optional[Any] = None,
    ):
        super().__init__()
        self.db = db if db is not None else default_db
        self.asset_repo = asset_repo or AssetRepository()
        self.user_repo = user_repo or UserRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.versions_col = self.db["asset_versions"]
        self.access_col = self.db["asset_access"]

    async def log_access(
        self,
        asset_id: str,
        user_id: str,
        accessor_id: str,
        accessor_type: str,
        action: str,
        status: str = "SUCCESS",
        ip_address: str = "unknown",
        user_agent: str = "unknown",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record immutable asset access event."""
        log_entry = {
            "id": f"acc_{uuid.uuid4().hex[:12]}",
            "assetId": asset_id,
            "userId": user_id,
            "accessorId": accessor_id,
            "accessorType": accessor_type,
            "action": action,
            "status": status,
            "ipAddress": ip_address,
            "userAgent": user_agent,
            "details": details or {},
            "accessedAt": datetime.now(timezone.utc).isoformat(),
        }
        await self.access_col.insert_one(log_entry)

    async def list_user_assets(
        self,
        user_id: str,
        category: Optional[str] = None,
        sensitivity: Optional[str] = None,
        tag: Optional[str] = None,
        search: Optional[str] = None,
        params: Optional[PaginationParams] = None,
    ) -> PaginatedResponse[Dict[str, Any]]:
        docs, total = await self.asset_repo.get_by_user(
            user_id=user_id,
            category=category,
            sensitivity=sensitivity,
            tag=tag,
            search=search,
            params=params,
        )
        # Exclude large binary data from list view
        for d in docs:
            d.pop("fileData", None)
            if "content" in d:
                d["hasContent"] = True
                # Mask raw content in list view
                d["content"] = "••••••••"
        return PaginatedResponse.create(docs, total, params or PaginationParams())

    async def get_asset(
        self,
        user_id: str,
        asset_id: str,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        asset = await self.asset_repo.find_one({"id": asset_id, "userId": user_id})
        if not asset:
            raise NotFoundError("Asset", asset_id)

        asset.pop("fileData", None)
        # Log view access
        await self.log_access(
            asset_id=asset_id,
            user_id=user_id,
            accessor_id=user_id,
            accessor_type="OWNER",
            action="VIEW",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        return asset

    async def save_asset(
        self,
        user_id: str,
        name: str,
        category: str,
        description: Optional[str] = None,
        content: Optional[str] = None,
        file_bytes: Optional[bytes] = None,
        file_name: Optional[str] = None,
        mime_type: Optional[str] = None,
        nominee_ids: Optional[List[str]] = None,
        sensitivity: str = "MEDIUM",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        asset_id: Optional[str] = None,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        target_id = asset_id or str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        file_size = len(file_bytes) if file_bytes else 0

        existing = await self.asset_repo.find_one({"id": target_id, "userId": user_id})

        # Check storage quota if adding or replacing file
        if file_size > 0:
            user = await self.user_repo.find_by_id(user_id)
            if user:
                old_file_size = existing.get("fileSize", 0) if existing else 0
                delta_size = file_size - old_file_size
                used = user.get("storageUsed", 0)
                limit = user.get("storageLimit", 500 * 1024 * 1024)
                if used + delta_size > limit:
                    raise ForbiddenError("Storage quota exceeded. Please upgrade your plan.")

        # If updating existing asset, snapshot current state into asset_versions
        current_version = 1
        if existing:
            current_version = existing.get("currentVersion", 1)
            version_doc = {
                "id": f"ver_{uuid.uuid4().hex[:12]}",
                "assetId": target_id,
                "userId": user_id,
                "versionNumber": current_version,
                "name": existing.get("name"),
                "category": existing.get("type"),
                "description": existing.get("description"),
                "content": existing.get("content"),
                "fileName": existing.get("fileName"),
                "fileSize": existing.get("fileSize", 0),
                "mimeType": existing.get("mimeType"),
                "nomineeIds": existing.get("nomineeIds", []),
                "sensitivity": existing.get("sensitivity", "MEDIUM"),
                "tags": existing.get("tags", []),
                "metadata": existing.get("metadata", {}),
                "kmsKeyId": existing.get("kmsKeyId"),
                "createdAt": now_iso,
                "createdBy": user_id,
            }
            await self.versions_col.insert_one(version_doc)
            current_version += 1

        # Envelope encryption setup: obtain per-asset KMS DEK
        kms_key_id = existing.get("kmsKeyId") if existing else None
        if not kms_key_id and (content or file_bytes):
            kms_key_id = await kms.create_data_key(
                user_id=user_id,
                vault_id=target_id,
                actor_id=user_id,
            )

        asset_doc: Dict[str, Any] = {
            "id": target_id,
            "userId": user_id,
            "name": name.strip(),
            "type": category.upper(),
            "description": description or "",
            "nomineeIds": nominee_ids or [],
            "allowedNominees": nominee_ids or [],
            "sensitivity": sensitivity.upper() if sensitivity else "MEDIUM",
            "tags": [t.strip().lower() for t in (tags or []) if t.strip()],
            "metadata": metadata or {},
            "currentVersion": current_version,
            "kmsKeyId": kms_key_id,
            "updatedAt": now_iso,
        }

        # Encrypt text content using per-asset DEK if present
        if content:
            raw_dek = await kms.get_dek(kms_key_id, user_id, actor_id=user_id)
            enc_blob, _ = encrypt_bytes_gcm(content.encode("utf-8"), dek=raw_dek)
            asset_doc["content"] = f"gcm_dek:{base64.b64encode(enc_blob).decode('utf-8')}"
            asset_doc["isEncrypted"] = True

        # Encrypt file binary using per-asset DEK if present
        if file_bytes and file_name:
            raw_dek = await kms.get_dek(kms_key_id, user_id, actor_id=user_id)
            enc_file_blob, _ = encrypt_bytes_gcm(file_bytes, dek=raw_dek)
            asset_doc["fileData"] = Binary(enc_file_blob)
            asset_doc["fileName"] = file_name
            asset_doc["fileSize"] = file_size
            asset_doc["mimeType"] = mime_type or "application/octet-stream"
            asset_doc["isEncrypted"] = True
            asset_doc["filePaths"] = f"/api/assets/file/{target_id}"

            old_size = existing.get("fileSize", 0) if existing else 0
            await self.user_repo.update_storage_usage(user_id, file_size - old_size)

        if existing:
            await self.asset_repo.update_one(
                {"id": target_id, "userId": user_id},
                {"$set": asset_doc},
            )
            action = "ASSET_UPDATE"
        else:
            asset_doc["createdAt"] = now_iso
            await self.asset_repo.insert(asset_doc)
            action = "FILE_UPLOAD" if file_bytes else "ASSET_SAVE"

        await self.audit_repo.log_event(
            user_id,
            action,
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"assetId": target_id, "name": name, "category": category, "version": current_version},
        )

        await self.log_access(
            asset_id=target_id,
            user_id=user_id,
            accessor_id=user_id,
            accessor_type="OWNER",
            action="UPDATE" if existing else "CREATE",
            ip_address=client_ip,
            user_agent=user_agent,
            details={"version": current_version},
        )

        return {"asset_id": target_id, "version": current_version, "message": "Asset saved successfully"}

    async def decrypt_asset_content(
        self,
        user_id: str,
        asset_id: str,
        pin: Optional[str] = None,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Decrypts and reveals secret payload with step-up PIN verification."""
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise UnauthorizedError("User not found")

        # Step-up verification if user has a PIN configured
        if user.get("pin"):
            if not pin or not verify_secret(pin, user["pin"]):
                await self.log_access(
                    asset_id=asset_id,
                    user_id=user_id,
                    accessor_id=user_id,
                    accessor_type="OWNER",
                    action="DECRYPT",
                    status="DENIED",
                    ip_address=client_ip,
                    user_agent=user_agent,
                    details={"reason": "Invalid secondary PIN"},
                )
                raise UnauthorizedError("Invalid master PIN for step-up verification")

        asset = await self.asset_repo.find_one({"id": asset_id, "userId": user_id})
        if not asset:
            raise NotFoundError("Asset", asset_id)

        raw_content = asset.get("content")
        decrypted_text = None

        if raw_content:
            if raw_content.startswith("gcm_dek:"):
                kms_key_id = asset.get("kmsKeyId")
                if not kms_key_id:
                    raise ValidationError("Missing KMS key for encrypted payload")
                raw_dek = await kms.get_dek(kms_key_id, user_id, actor_id=user_id)
                blob = base64.b64decode(raw_content[8:])
                decrypted_bytes = decrypt_bytes_gcm(blob, raw_dek)
                decrypted_text = decrypted_bytes.decode("utf-8")
            else:
                # Fallback to system-level decrypt
                decrypted_text = CryptoService.decrypt_text(raw_content)

        await self.log_access(
            asset_id=asset_id,
            user_id=user_id,
            accessor_id=user_id,
            accessor_type="OWNER",
            action="DECRYPT",
            status="SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
        )

        return {
            "assetId": asset_id,
            "name": asset.get("name"),
            "category": asset.get("type"),
            "decryptedContent": decrypted_text,
            "metadata": asset.get("metadata", {}),
            "sensitivity": asset.get("sensitivity", "MEDIUM"),
        }

    async def get_decrypted_file(
        self,
        asset_id: str,
        requester_id: Optional[str] = None,
        nominee_token: Optional[str] = None,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Tuple[bytes, str, str]:
        """Returns (decrypted_bytes, file_name, mime_type)."""
        asset = await self.asset_repo.find_one({"id": asset_id})
        if not asset:
            raise NotFoundError("Asset", asset_id)

        # Authorization check
        authorized = False
        accessor_type = "UNKNOWN"
        actor_id = requester_id or "unknown"

        if requester_id and requester_id == asset.get("userId"):
            authorized = True
            accessor_type = "OWNER"
        elif nominee_token:
            nominee = await db["nominees"].find_one({"accessToken": nominee_token})
            if nominee:
                from app.lib.authorization import is_nominee_authorized_for_asset
                claim_wf = await db["verification_workflows"].find_one({"userId": asset.get("userId")})
                if await is_nominee_authorized_for_asset(nominee, asset, claim_wf):
                    authorized = True
                    accessor_type = "NOMINEE"
                    actor_id = str(nominee.get("_id") or nominee.get("id"))

        if not authorized:
            await self.log_access(
                asset_id=asset_id,
                user_id=asset.get("userId", "unknown"),
                accessor_id=actor_id,
                accessor_type=accessor_type,
                action="DOWNLOAD",
                status="DENIED",
                ip_address=client_ip,
                user_agent=user_agent,
            )
            raise ForbiddenError("Unauthorized to download this file")

        file_data = asset.get("fileData")
        if not file_data:
            raise NotFoundError("File data not found in asset")

        file_bytes = bytes(file_data)
        if asset.get("isEncrypted"):
            kms_key_id = asset.get("kmsKeyId")
            if kms_key_id:
                raw_dek = await kms.get_dek(kms_key_id, asset["userId"], actor_id=actor_id)
                file_bytes = decrypt_bytes_gcm(file_bytes, raw_dek)
            else:
                file_bytes = CryptoService.decrypt_binary(file_bytes)

        await self.log_access(
            asset_id=asset_id,
            user_id=asset["userId"],
            accessor_id=actor_id,
            accessor_type=accessor_type,
            action="DOWNLOAD",
            status="SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
        )

        return file_bytes, asset.get("fileName", "download"), asset.get("mimeType", "application/octet-stream")

    async def list_versions(self, user_id: str, asset_id: str) -> List[Dict[str, Any]]:
        """List historical snapshot versions of the asset."""
        asset = await self.asset_repo.find_one({"id": asset_id, "userId": user_id})
        if not asset:
            raise NotFoundError("Asset", asset_id)

        cursor = self.versions_col.find(
            {"assetId": asset_id, "userId": user_id},
            {"_id": 0}
        ).sort("versionNumber", -1)
        versions = await cursor.to_list(length=100)
        return versions

    async def rollback_version(
        self,
        user_id: str,
        asset_id: str,
        version_number: int,
        client_ip: str = "unknown",
        user_agent: str = "unknown",
    ) -> Dict[str, Any]:
        """Roll back active asset to a specified historical version."""
        target_version = await self.versions_col.find_one({
            "assetId": asset_id,
            "userId": user_id,
            "versionNumber": version_number,
        })
        if not target_version:
            raise NotFoundError("AssetVersion", f"{asset_id}-v{version_number}")

        current = await self.asset_repo.find_one({"id": asset_id, "userId": user_id})
        if not current:
            raise NotFoundError("Asset", asset_id)

        now_iso = datetime.now(timezone.utc).isoformat()
        current_v = current.get("currentVersion", 1)

        # Snapshot active state before rollback
        await self.versions_col.insert_one({
            "id": f"ver_{uuid.uuid4().hex[:12]}",
            "assetId": asset_id,
            "userId": user_id,
            "versionNumber": current_v,
            "name": current.get("name"),
            "category": current.get("type"),
            "description": current.get("description"),
            "content": current.get("content"),
            "fileName": current.get("fileName"),
            "fileSize": current.get("fileSize", 0),
            "mimeType": current.get("mimeType"),
            "nomineeIds": current.get("nomineeIds", []),
            "sensitivity": current.get("sensitivity", "MEDIUM"),
            "tags": current.get("tags", []),
            "metadata": current.get("metadata", {}),
            "kmsKeyId": current.get("kmsKeyId"),
            "createdAt": now_iso,
            "createdBy": user_id,
            "changeSummary": f"Auto-snapshot before rollback to v{version_number}",
        })

        # Restore targeted version fields
        new_v = current_v + 1
        restored_doc = {
            "name": target_version.get("name"),
            "type": target_version.get("category"),
            "description": target_version.get("description"),
            "content": target_version.get("content"),
            "fileName": target_version.get("fileName"),
            "fileSize": target_version.get("fileSize", 0),
            "mimeType": target_version.get("mimeType"),
            "nomineeIds": target_version.get("nomineeIds", []),
            "allowedNominees": target_version.get("nomineeIds", []),
            "sensitivity": target_version.get("sensitivity", "MEDIUM"),
            "tags": target_version.get("tags", []),
            "metadata": target_version.get("metadata", {}),
            "kmsKeyId": target_version.get("kmsKeyId"),
            "currentVersion": new_v,
            "updatedAt": now_iso,
        }

        await self.asset_repo.update_one(
            {"id": asset_id, "userId": user_id},
            {"$set": restored_doc},
        )

        await self.log_access(
            asset_id=asset_id,
            user_id=user_id,
            accessor_id=user_id,
            accessor_type="OWNER",
            action="ROLLBACK",
            status="SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            details={"fromVersion": current_v, "toVersion": version_number, "newVersion": new_v},
        )

        return {
            "asset_id": asset_id,
            "restored_from_version": version_number,
            "new_version": new_v,
            "message": f"Successfully rolled back to version {version_number}",
        }

    async def get_access_logs(self, user_id: str, asset_id: str) -> List[Dict[str, Any]]:
        """Retrieve audit trail of who accessed, viewed, decrypted, or modified the asset."""
        asset = await self.asset_repo.find_one({"id": asset_id, "userId": user_id})
        if not asset:
            raise NotFoundError("Asset", asset_id)

        cursor = self.access_col.find(
            {"assetId": asset_id, "userId": user_id},
            {"_id": 0}
        ).sort("accessedAt", -1)
        logs = await cursor.to_list(length=200)
        return logs

    async def get_user_tags(self, user_id: str) -> List[str]:
        return await self.asset_repo.get_distinct_tags(user_id)

    async def delete_asset(
        self, user_id: str, asset_id: str, client_ip: str = "unknown", user_agent: str = "unknown"
    ) -> None:
        asset = await self.asset_repo.find_one({"id": asset_id, "userId": user_id})
        if not asset:
            raise NotFoundError("Asset", asset_id)

        file_size = asset.get("fileSize", 0)
        if file_size > 0:
            await self.user_repo.update_storage_usage(user_id, -file_size)

        await self.asset_repo.delete_one({"id": asset_id, "userId": user_id})
        await self.versions_col.delete_many({"assetId": asset_id, "userId": user_id})

        await self.audit_repo.log_event(
            user_id,
            "ASSET_DELETE",
            "SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
            metadata={"assetId": asset_id},
        )

        await self.log_access(
            asset_id=asset_id,
            user_id=user_id,
            accessor_id=user_id,
            accessor_type="OWNER",
            action="DELETE",
            ip_address=client_ip,
            user_agent=user_agent,
        )
