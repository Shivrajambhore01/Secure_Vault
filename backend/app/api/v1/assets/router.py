"""
Assets API v1 Router — SecureVault Enterprise
Comprehensive digital vault asset management:
- Multi-category asset storage (Financial, Credentials, Crypto, Legal, Files, Notes)
- Envelope encryption with per-asset KMS keys
- Versioning and rollback
- Step-up PIN secret decryption
- Access audit trails and tagging
"""

import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, File, Form, Query, Request, Response, UploadFile
from app.domain.exceptions import ValidationError
from app.infrastructure.pagination import PaginationParams
from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.asset_service import AssetService

router = APIRouter(prefix="/assets", tags=["v1 - Assets"])
asset_service = AssetService()


@router.get("/tags")
async def get_user_tags(request: Request):
    """List all distinct tags across the user's vault assets."""
    user_id = require_authenticated_user(request)
    tags = await asset_service.get_user_tags(user_id)
    return success_response(data=tags)


@router.get("")
async def list_assets(
    request: Request,
    category: Optional[str] = None,
    sensitivity: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    params: PaginationParams = Depends(),
):
    """List assets in the user's vault with filtering, pagination, and sorting."""
    user_id = require_authenticated_user(request)
    paginated = await asset_service.list_user_assets(
        user_id=user_id,
        category=category,
        sensitivity=sensitivity,
        tag=tag,
        search=search,
        params=params,
    )
    return success_response(data=paginated.items, meta=paginated.meta.model_dump())


@router.get("/{asset_id}")
async def get_asset(asset_id: str, request: Request):
    """Retrieve an asset's metadata and masked content."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    asset = await asset_service.get_asset(user_id, asset_id, client_ip=client_ip, user_agent=user_agent)
    return success_response(data=asset)


@router.post("/{asset_id}/decrypt")
async def decrypt_asset_content(
    asset_id: str,
    request: Request,
    body: Optional[Dict[str, Any]] = Body(None),
):
    """Step-up decryption to reveal secrets, credentials, or encrypted notes."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    pin = body.get("pin") if body else request.query_params.get("pin")

    result = await asset_service.decrypt_asset_content(
        user_id=user_id,
        asset_id=asset_id,
        pin=pin,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=result)


@router.get("/{asset_id}/versions")
async def list_asset_versions(asset_id: str, request: Request):
    """List version history snapshots for an asset."""
    user_id = require_authenticated_user(request)
    versions = await asset_service.list_versions(user_id, asset_id)
    return success_response(data=versions)


@router.post("/{asset_id}/rollback/{version_number}")
async def rollback_asset_version(asset_id: str, version_number: int, request: Request):
    """Roll back an asset to a prior historical version."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    result = await asset_service.rollback_version(
        user_id=user_id,
        asset_id=asset_id,
        version_number=version_number,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=result)


@router.get("/{asset_id}/audit")
async def get_asset_audit_trail(asset_id: str, request: Request):
    """Retrieve immutable access logs for an asset."""
    user_id = require_authenticated_user(request)
    logs = await asset_service.get_access_logs(user_id, asset_id)
    return success_response(data=logs)


@router.post("")
async def create_or_update_asset(
    request: Request,
    name: Optional[str] = Form(None),
    type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    id: Optional[str] = Form(None),
    nomineeIds: Optional[str] = Form(None),
    sensitivity: Optional[str] = Form("MEDIUM"),
    tags: Optional[str] = Form(None),
    metadata: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """
    Create or update an asset.
    Accepts both application/json (credentials, crypto, financial)
    and multipart/form-data (file uploads).
    """
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        name = body.get("name")
        type = body.get("type") or body.get("category", "DOCUMENTS")
        description = body.get("description")
        content = body.get("content")
        id = body.get("id")
        parsed_nominees = body.get("nomineeIds", [])
        sensitivity = body.get("sensitivity", "MEDIUM")
        parsed_tags = body.get("tags", [])
        parsed_metadata = body.get("metadata", {})
        file_bytes = None
        file_name = None
        mime_type = None
    else:
        # Form Data
        if not name or not type:
            raise ValidationError("Asset name and category type are required")
        file_bytes = await file.read() if file else None
        file_name = file.filename if file else None
        mime_type = file.content_type if file else None
        parsed_nominees = [n.strip() for n in nomineeIds.split(",") if n.strip()] if nomineeIds else []
        parsed_tags = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
        parsed_metadata = {}
        if metadata:
            try:
                parsed_metadata = json.loads(metadata)
            except Exception:
                parsed_metadata = {}

    if not name or not type:
        raise ValidationError("Asset name and category type are required")

    res = await asset_service.save_asset(
        user_id=user_id,
        name=name,
        category=type,
        description=description,
        content=content,
        file_bytes=file_bytes,
        file_name=file_name,
        mime_type=mime_type,
        nominee_ids=parsed_nominees,
        sensitivity=sensitivity or "MEDIUM",
        tags=parsed_tags,
        metadata=parsed_metadata,
        asset_id=id,
        client_ip=client_ip,
        user_agent=user_agent,
    )
    return success_response(data=res, status_code=201 if not id else 200)


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, request: Request):
    """Delete an asset, remove versions, and release storage quota."""
    user_id = require_authenticated_user(request)
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    await asset_service.delete_asset(user_id, asset_id, client_ip=client_ip, user_agent=user_agent)
    return success_response(data={"message": "Asset deleted successfully"})


@router.get("/file/{asset_id}")
async def download_asset_file(asset_id: str, request: Request, token: Optional[str] = None):
    """Download decrypted file content for an asset."""
    user_id = None
    try:
        user_id = require_authenticated_user(request)
    except Exception:
        pass

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    file_bytes, file_name, mime_type = await asset_service.get_decrypted_file(
        asset_id=asset_id,
        requester_id=user_id,
        nominee_token=token,
        client_ip=client_ip,
        user_agent=user_agent,
    )

    return Response(
        content=file_bytes,
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{file_name}"'},
    )
