"""
Automated MongoDB Disaster Recovery Restoration Script — SecureVault Enterprise (Phase 15)
Verifies SHA-256 manifest integrity before performing point-in-time recovery.
"""

import asyncio
import hashlib
import json
import logging
import os
import tarfile
from pathlib import Path
from typing import Dict, Any

from typing import Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

logger = logging.getLogger("securevault.restore")


async def restore_backup(
    archive_path: Path,
    manifest_path: Path,
    mongo_uri: Optional[str] = None,
    db_name: str = "securevault",
    drop_existing: bool = False,
) -> Dict[str, Any]:
    """
    Validates SHA-256 checksum and restores database collections from archive.
    """
    if not mongo_uri:
        try:
            from app.core.config import get_settings
            mongo_uri = get_settings().MONGODB_URI
        except Exception:
            mongo_uri = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    if not archive_path.exists():
        raise FileNotFoundError(f"Archive not found: {archive_path}")
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    # 1. Verify SHA-256 checksum
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected_checksum = manifest.get("sha256_checksum")

    hasher = hashlib.sha256()
    with open(archive_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    actual_checksum = hasher.hexdigest()

    if actual_checksum != expected_checksum:
        raise ValueError(f"Checksum mismatch! Expected {expected_checksum}, found {actual_checksum}")

    logger.info("Checksum verified successfully: %s", actual_checksum[:12])

    # 2. Extract archive
    temp_dir = archive_path.parent / f"restore_temp_{os.getpid()}"
    temp_dir.mkdir(parents=True, exist_ok=True)

    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]

    restored_counts = {}
    try:
        with tarfile.open(archive_path, "r:gz") as tar:
            tar.extractall(path=temp_dir)

        # 3. Restore each collection
        for col_file in temp_dir.glob("*.json"):
            col_name = col_file.stem
            docs = json.loads(col_file.read_text(encoding="utf-8"))

            col = db[col_name]
            if drop_existing:
                await col.delete_many({})

            inserted = 0
            for doc in docs:
                if "_id" in doc and ObjectId.is_valid(doc["_id"]):
                    doc["_id"] = ObjectId(doc["_id"])
                await col.replace_one({"_id": doc["_id"]}, doc, upsert=True)
                inserted += 1

            restored_counts[col_name] = inserted

        logger.info("Database %s restored successfully: %s", db_name, restored_counts)
        return {
            "status": "RESTORED",
            "database": db_name,
            "restored_collections": restored_counts,
            "checksum": actual_checksum,
        }

    finally:
        # Cleanup temp directory
        for item in temp_dir.iterdir():
            item.unlink()
        temp_dir.rmdir()
        client.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
