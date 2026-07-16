"""
Object Storage Abstraction Layer — SecureVault

Provides a unified interface for storing and retrieving binary file data.
Currently uses MongoDB GridFS-style storage as the default backend
(encrypted file bytes stored in a dedicated 'file_storage' collection).

When you are ready to scale to S3/MinIO, change STORAGE_BACKEND=minio
in your .env file — no other code changes needed.

Backend selection via STORAGE_BACKEND env variable:
  'mongodb' — stores encrypted bytes in MongoDB file_storage collection (DEFAULT)
  'local'   — writes to ./uploads/ directory (legacy dev mode)
  'minio'   — MinIO / self-hosted S3-compatible object storage
  's3'      — AWS S3

All backends implement the same StorageBackend interface:
    put(key, data, content_type) → key
    get(key)                     → bytes
    delete(key)                  → None
    exists(key)                  → bool

NOTE: The existing verification_workflow.py stores files directly inside
verification_documents as BSON Binary — that is fully supported and works well
for the current scale. This module provides a future migration path and is
used for any NEW upload endpoints added after this point.
"""

import os
import io
import abc
import logging
import secrets
from pathlib import Path
from datetime import datetime, timezone

import aiofiles
from bson.binary import Binary

from app.core.config import get_settings
from app.core.database import db

settings = get_settings()
logger = logging.getLogger("securevault.storage")

BUCKET_NAME = os.getenv("STORAGE_BUCKET", "securevault-documents")


# ─────────────────────────────────────────────────────────────────────
# Abstract Base
# ─────────────────────────────────────────────────────────────────────

class StorageBackend(abc.ABC):
    """Abstract interface all storage implementations must follow."""

    @abc.abstractmethod
    async def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Upload bytes under `key`. Returns the final object key."""

    @abc.abstractmethod
    async def get(self, key: str) -> bytes:
        """Download bytes for `key`. Raises FileNotFoundError if missing."""

    @abc.abstractmethod
    async def delete(self, key: str) -> None:
        """Delete the object at `key`. No-op if not found."""

    @abc.abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if object exists."""


# ─────────────────────────────────────────────────────────────────────
# MongoDB Storage Backend (DEFAULT — current production backend)
# ─────────────────────────────────────────────────────────────────────

class MongoDBStorageBackend(StorageBackend):
    """
    Stores encrypted file blobs in a dedicated MongoDB 'file_storage' collection.

    This is the DEFAULT backend for SecureVault — no external dependencies,
    works with the existing MongoDB Atlas connection, and keeps the system simple.

    Document schema in 'file_storage':
      {
        objectKey:   str   — unique key (e.g. "docs/a3f1c2d9e8b7.bin")
        data:        Binary — encrypted file bytes
        contentType: str   — MIME type
        sizeBytes:   int   — original file size
        createdAt:   str   — ISO timestamp
      }

    MongoDB document size limit: 16 MB per document.
    Our file limit: 10 MB per file (enforced in the upload route).
    10 MB file + AES-CBC overhead (~16 bytes) = well within limit.
    """

    def __init__(self):
        self.col = db["file_storage"]
        logger.info("MongoDBStorageBackend initialized — using collection: file_storage")

    async def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        await self.col.update_one(
            {"objectKey": key},
            {
                "$set": {
                    "objectKey": key,
                    "data": Binary(data),
                    "contentType": content_type,
                    "sizeBytes": len(data),
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                },
                "$setOnInsert": {
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                },
            },
            upsert=True,
        )
        logger.debug("MongoDBStorage PUT: %s (%d bytes)", key, len(data))
        return key

    async def get(self, key: str) -> bytes:
        record = await self.col.find_one({"objectKey": key}, {"data": 1})
        if not record or "data" not in record:
            raise FileNotFoundError(f"Object not found in MongoDB storage: {key}")
        return bytes(record["data"])

    async def delete(self, key: str) -> None:
        await self.col.delete_one({"objectKey": key})
        logger.debug("MongoDBStorage DELETE: %s", key)

    async def exists(self, key: str) -> bool:
        count = await self.col.count_documents({"objectKey": key}, limit=1)
        return count > 0


# ─────────────────────────────────────────────────────────────────────
# Local Filesystem Backend (Legacy / Dev Fallback)
# ─────────────────────────────────────────────────────────────────────

class LocalStorageBackend(StorageBackend):
    """
    Stores encrypted blobs as files under `uploads/`.
    Suitable only for local development. Not recommended for production.
    """

    def __init__(self, base_dir: str = "uploads"):
        self.base_path = Path(base_dir).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info("LocalStorageBackend initialized at: %s", self.base_path)

    def _resolve(self, key: str) -> Path:
        safe_key = key.replace("..", "").lstrip("/").replace("\\", "/")
        return self.base_path / safe_key

    async def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(target, "wb") as f:
            await f.write(data)
        logger.debug("LocalStorage PUT: %s (%d bytes)", key, len(data))
        return key

    async def get(self, key: str) -> bytes:
        target = self._resolve(key)
        if not target.exists():
            raise FileNotFoundError(f"Object not found: {key}")
        async with aiofiles.open(target, "rb") as f:
            return await f.read()

    async def delete(self, key: str) -> None:
        target = self._resolve(key)
        if target.exists():
            target.unlink()
            logger.debug("LocalStorage DELETE: %s", key)

    async def exists(self, key: str) -> bool:
        return self._resolve(key).exists()


# ─────────────────────────────────────────────────────────────────────
# MinIO / S3-compatible Backend (Production Scale-out)
# ─────────────────────────────────────────────────────────────────────

class MinIOStorageBackend(StorageBackend):
    """
    S3-compatible object storage via miniopy-async.
    Activate by setting STORAGE_BACKEND=minio in .env.

    Required env vars:
      MINIO_ENDPOINT   — e.g. "localhost:9000" or "s3.amazonaws.com"
      MINIO_ACCESS_KEY
      MINIO_SECRET_KEY
      MINIO_SECURE     — "true" for HTTPS
      STORAGE_BUCKET   — bucket name (default: "securevault-documents")
    """

    def __init__(self):
        try:
            from miniopy_async import Minio
        except ImportError:
            raise RuntimeError(
                "miniopy-async is not installed. Run: pip install miniopy-async"
            )

        endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
        access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin")
        secure = os.getenv("MINIO_SECURE", "false").lower() == "true"

        self.client = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)
        self.bucket = BUCKET_NAME
        logger.info("MinIOStorageBackend: endpoint=%s bucket=%s", endpoint, self.bucket)

    async def _ensure_bucket(self):
        found = await self.client.bucket_exists(self.bucket)
        if not found:
            await self.client.make_bucket(self.bucket)

    async def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        await self._ensure_bucket()
        stream = io.BytesIO(data)
        await self.client.put_object(self.bucket, key, stream, length=len(data), content_type=content_type)
        return key

    async def get(self, key: str) -> bytes:
        await self._ensure_bucket()
        response = await self.client.get_object(self.bucket, key)
        data = await response.read()
        response.close()
        await response.release()
        return data

    async def delete(self, key: str) -> None:
        await self._ensure_bucket()
        await self.client.remove_object(self.bucket, key)

    async def exists(self, key: str) -> bool:
        try:
            await self.client.stat_object(self.bucket, key)
            return True
        except Exception:
            return False


# ─────────────────────────────────────────────────────────────────────
# Secure Key Generator
# ─────────────────────────────────────────────────────────────────────

def generate_object_key(prefix: str = "docs", extension: str = "bin") -> str:
    """
    Generate a secure, non-guessable object key.
    Format: {prefix}/{32-char-hex-random}.{extension}
    Never exposes original filenames (which could leak PII).
    """
    return f"{prefix}/{secrets.token_hex(16)}.{extension}"


# ─────────────────────────────────────────────────────────────────────
# Factory — auto-select backend from STORAGE_BACKEND env var
# ─────────────────────────────────────────────────────────────────────

def _create_backend() -> StorageBackend:
    backend_name = os.getenv("STORAGE_BACKEND", "mongodb").lower()
    logger.info("Storage backend selected: %s", backend_name)

    if backend_name == "minio" or backend_name == "s3":
        return MinIOStorageBackend()
    if backend_name == "local":
        uploads_root = Path(__file__).resolve().parent.parent.parent / "uploads"
        return LocalStorageBackend(base_dir=str(uploads_root))
    # Default: MongoDB
    return MongoDBStorageBackend()


# Singleton instance — imported by other modules
storage_backend: StorageBackend = _create_backend()
