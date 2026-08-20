"""Asset management API routes — port of backend/routes/assets.ts."""

import os
import time
import math
import shutil
from pathlib import Path
from datetime import datetime, timezone

from bson import ObjectId
from bson.binary import Binary
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response, Request
from typing import Optional

from app.core.database import db
from app.core.security import get_current_user, decode_token
from app.lib.encryption import encrypt_bytes, decrypt_bytes

router = APIRouter()

# Collections
assets_col = db["assets"]
users_col = db["users"]

# Upload directory
UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ------------------------------------------------------------------
# GET all assets for a user
# ------------------------------------------------------------------
@router.get("/{user_id}")
async def get_assets(user_id: str, current_user: dict = Depends(get_current_user)):
    caller_user_id = current_user.get("userId") or current_user.get("id")
    if caller_user_id and str(caller_user_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Forbidden: Cannot access another user's assets")

    assets = await assets_col.find({"userId": user_id}, {"fileData": 0}).to_list(length=None)
    # Convert ObjectId to string for JSON serialization
    for a in assets:
        a["_id"] = str(a["_id"])
    return assets


# ------------------------------------------------------------------
# POST save/update an asset
# ------------------------------------------------------------------
@router.post("/")
async def save_asset(
    request: Request,
    userId: str = Form(...),
    name: str = Form(None),
    type: str = Form(None),
    description: str = Form(None),
    nomineeId: str = Form(None),
    nomineeIds: Optional[str] = Form(None),
    allowedNominees: Optional[str] = Form(None),
    releasePolicy: Optional[str] = Form(None),
    content: str = Form(None),
    id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    if not userId:
        raise HTTPException(status_code=400, detail="UserId is required")

    caller_user_id = current_user.get("userId") or current_user.get("id")
    if caller_user_id and str(caller_user_id) != str(userId):
        raise HTTPException(status_code=403, detail="Forbidden: Cannot modify another user's assets")

    # Fetch user plan info
    user = await users_col.find_one({"_id": ObjectId(userId)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    asset_id = id
    if not asset_id:
        import random, string
        asset_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=13)) + hex(int(time.time()))[2:]

    new_file_size = 0
    file_content = None

    if file and file.filename:
        # Extension validation
        ext = os.path.splitext(file.filename)[1].lower()
        if ext in (".exe", ".bat", ".sh", ".cmd", ".msi", ".scr", ".vbs", ".js", ".jar"):
            raise HTTPException(status_code=400, detail="Executable and script file uploads are blocked for security.")

        # Read file content
        file_content = await file.read()
        new_file_size = len(file_content)

        # Type size validation
        type_limit = float("inf")
        if type == "image":
            type_limit = 20 * 1024 * 1024
        elif type in ("document", "legal-file"):
            type_limit = 50 * 1024 * 1024
        elif type == "video":
            type_limit = 500 * 1024 * 1024

        if new_file_size > type_limit:
            raise HTTPException(status_code=400, detail=f"Upload exceeds maximum size limit for {type} ({type_limit // (1024 * 1024)}MB).")

        # Storage limit check
        if (user.get("storageUsed", 0) + new_file_size) > user.get("storageLimit", 500 * 1024 * 1024):
            raise HTTPException(status_code=403, detail="Storage limit reached. Please upgrade your plan.")

        # File size limit per plan
        plan = user.get("plan", "free")
        file_size_limit = (
            50 * 1024 * 1024 if plan == "free"
            else 500 * 1024 * 1024 if plan == "pro"
            else float("inf")
        )
        if new_file_size > file_size_limit:
            raise HTTPException(status_code=403, detail=f"File size exceeds limits for {plan} plan.")

    # Parse nomineeIds / allowedNominees list
    raw_nominee_str = allowedNominees or nomineeIds
    parsed_nominee_ids = []
    if raw_nominee_str:
        parsed_nominee_ids = [nid.strip() for nid in raw_nominee_str.split(",") if nid.strip()]
    elif nomineeId:
        parsed_nominee_ids = [nomineeId.strip()]

    first_nominee_id = parsed_nominee_ids[0] if parsed_nominee_ids else None

    # Parse releasePolicy if provided as JSON string
    parsed_policy = None
    if releasePolicy:
        try:
            import json
            parsed_policy = json.loads(releasePolicy) if isinstance(releasePolicy, str) else releasePolicy
        except Exception:
            parsed_policy = {"category": type}

    # Build asset data
    asset_data = {
        "name": name,
        "type": type,
        "description": description,
        "nomineeId": first_nominee_id,
        "nomineeIds": parsed_nominee_ids,
        "allowedNominees": parsed_nominee_ids,
        "releasePolicy": parsed_policy,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    if file and file_content:
        asset_data["fileName"] = file.filename
        asset_data["filePaths"] = f"/api/assets/file/{asset_id}"
        asset_data["fileSize"] = new_file_size
        asset_data["mimeType"] = file.content_type
        # Encrypt file bytes before saving
        encrypted_content = encrypt_bytes(file_content)
        asset_data["fileData"] = Binary(encrypted_content)
        asset_data["isEncrypted"] = True

    if content:
        asset_data["content"] = content

    if id:
        # Update existing
        await assets_col.update_one(
            {"id": id, "userId": userId},
            {"$set": asset_data},
            upsert=True,
        )
    else:
        # Create new
        await assets_col.insert_one({
            "id": asset_id,
            "userId": userId,
            **asset_data,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

    # Update user storage
    if file and new_file_size > 0:
        await users_col.update_one(
            {"_id": ObjectId(userId)},
            {"$inc": {"storageUsed": new_file_size}},
        )

    # Audit log
    from app.lib.audit import write_audit_log
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    await write_audit_log(
        userId,
        "FILE_UPLOAD" if file else "ASSET_SAVE",
        "SUCCESS",
        client_ip,
        user_agent,
        {"assetId": asset_id, "name": name, "type": type}
    )

    return {"message": "Asset saved successfully"}


# ------------------------------------------------------------------
# DELETE an asset
# ------------------------------------------------------------------
@router.delete("/{user_id}/{asset_id}")
async def delete_asset(user_id: str, asset_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    # Find asset to get size before deletion
    asset = await assets_col.find_one({"id": asset_id, "userId": user_id})
    if asset and asset.get("fileSize"):
        await users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"storageUsed": -asset["fileSize"]}},
        )

    await assets_col.delete_one({"id": asset_id, "userId": user_id})

    # Audit log
    from app.lib.audit import write_audit_log
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    await write_audit_log(
        user_id,
        "ASSET_DELETE",
        "SUCCESS",
        client_ip,
        user_agent,
        {"assetId": asset_id}
    )

    return {"message": "Asset deleted successfully"}


# ------------------------------------------------------------------
# GET asset file content from MongoDB (protected)
# ------------------------------------------------------------------
@router.get("/file/{asset_id}")
async def get_asset_file(asset_id: str, request: Request, token: Optional[str] = None):
    asset = await assets_col.find_one({"id": asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Authorize download: must be owner or authorized nominee
    authorized = False

    # 1. Check Owner Authorization (via HttpOnly accessToken cookie)
    access_cookie = request.cookies.get("accessToken")
    if access_cookie:
        try:
            decoded = decode_token(access_cookie)
            if decoded.get("userId") == asset.get("userId"):
                authorized = True
        except Exception:
            pass

    # 2. Check Nominee Authorization (via token query parameter)
    if not authorized and token:
        nominee = await db["nominees"].find_one({"accessToken": token})
        if nominee:
            # Check token expiry
            expiry = nominee.get("tokenExpiry")
            is_expired = False
            if expiry:
                if isinstance(expiry, str):
                    expiry_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
                else:
                    expiry_dt = expiry
                if datetime.now(timezone.utc) > expiry_dt:
                    is_expired = True

            if not is_expired:
                # Check claim workflow state for owner & nominee entitlement
                claim_workflow = await db["verification_workflows"].find_one({"userId": asset.get("userId")})
                from app.lib.authorization import is_nominee_authorized_for_asset
                if await is_nominee_authorized_for_asset(nominee, asset, claim_workflow):
                    authorized = True
                else:
                    # Fallback check for legacy verification_requests
                    nominee_id = nominee.get("id")
                    asset_nominee_ids = asset.get("nomineeIds") or ([asset.get("nomineeId")] if asset.get("nomineeId") else [])
                    if nominee_id in asset_nominee_ids:
                        ver_req = await db["verification_requests"].find_one({
                            "nomineeId": nominee_id,
                            "status": "APPROVED"
                        })
                        if ver_req:
                            authorized = True

    if not authorized:
        raise HTTPException(status_code=401, detail="Unauthorized access to this asset")

    if "fileData" not in asset:
        raise HTTPException(status_code=404, detail="File content not found in this asset")

    # Audit Log
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    caller_type = "Owner" if access_cookie and authorized else "Nominee"
    
    from app.lib.audit import write_audit_log
    await write_audit_log(
        asset.get("userId"),
        "FILE_DOWNLOAD",
        "SUCCESS",
        client_ip,
        user_agent,
        {"assetId": asset_id, "fileName": asset.get("fileName"), "callerType": caller_type}
    )

    file_bytes = asset["fileData"]
    if asset.get("isEncrypted"):
        try:
            file_bytes = decrypt_bytes(file_bytes)
        except Exception as e:
            print(f"[Decryption Error] Failed to decrypt asset file: {e}")
            raise HTTPException(status_code=500, detail="Error decrypting file content")

    mime_type = asset.get("mimeType", "application/octet-stream")
    filename = asset.get("fileName", "download")

    return Response(
        content=file_bytes,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"'
        }
    )
