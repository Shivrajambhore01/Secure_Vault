"""
Storage Objects & Encryption Metadata Domain Schemas — SecureVault Enterprise
"""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field


class EncryptionMetadataSchema(BaseModel):
    id: str
    assetId: str
    algorithm: str = "AES-256-GCM"
    wrappedDekBase64: str
    ivNonceHex: str
    authTagHex: str
    keyDerivation: str = "HKDF-SHA256"
    kekSalt: str
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class StorageObjectSchema(BaseModel):
    id: str
    storageKey: str  # S3/MinIO/GridFS object pointer
    bucketName: str = "securevault-assets"
    fileSizeBytes: int
    sha256Checksum: str
    encryptionMetadataId: str
    storageProvider: str = "MONGODB_GRIDFS"  # MONGODB_GRIDFS | AWS_S3 | CLOUDFLARE_R2
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
