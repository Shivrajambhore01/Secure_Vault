"""Asset management API routes — port of backend/routes/assets.ts."""

import os
import time
import math
import shutil
from pathlib import Path
from datetime import datetime, timezone

from bson import ObjectId
from bson.binary import Binary
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from typing import Optional

from app.core.database import db
from app.core.security import get_current_user

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
    assets = await assets_col.find({"userId": user_id}).to_list(length=None)
    # Convert ObjectId to string for JSON serialization
    for a in assets:
        a["_id"] = str(a["_id"])
    return assets


# ------------------------------------------------------------------
# POST save/update an asset
# ------------------------------------------------------------------
@router.post("/")
async def save_asset(
    userId: str = Form(...),
    name: str = Form(None),
    type: str = Form(None),
    description: str = Form(None),
    nomineeId: str = Form(None),
    content: str = Form(None),
    id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    if not userId:
        raise HTTPException(status_code=400, detail="UserId is required")

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
        # Read file content
        file_content = await file.read()
        new_file_size = len(file_content)

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

    # Build asset data
    asset_data = {
        "name": name,
        "type": type,
        "description": description,
        "nomineeId": nomineeId,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    if file and file_content:
        asset_data["fileName"] = file.filename
        asset_data["filePaths"] = f"/api/assets/file/{asset_id}"
        asset_data["fileSize"] = new_file_size
        asset_data["mimeType"] = file.content_type
        asset_data["fileData"] = Binary(file_content)

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

    return {"message": "Asset saved successfully"}


# ------------------------------------------------------------------
# DELETE an asset
# ------------------------------------------------------------------
@router.delete("/{user_id}/{asset_id}")
async def delete_asset(user_id: str, asset_id: str, current_user: dict = Depends(get_current_user)):
    # Find asset to get size before deletion
    asset = await assets_col.find_one({"id": asset_id, "userId": user_id})
    if asset and asset.get("fileSize"):
        await users_col.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {"storageUsed": -asset["fileSize"]}},
        )

    await assets_col.delete_one({"id": asset_id, "userId": user_id})
    return {"message": "Asset deleted successfully"}


# ------------------------------------------------------------------
# GET asset file content from MongoDB (public/accessible by nominee/owner)
# ------------------------------------------------------------------
@router.get("/file/{asset_id}")
async def get_asset_file(asset_id: str):
    asset = await assets_col.find_one({"id": asset_id})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if "fileData" not in asset:
        raise HTTPException(status_code=404, detail="File content not found in this asset")

    file_bytes = asset["fileData"]
    mime_type = asset.get("mimeType", "application/octet-stream")
    filename = asset.get("fileName", "download")

    return Response(
        content=file_bytes,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"'
        }
    )
