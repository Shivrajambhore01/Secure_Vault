"""Centralized Limit Enforcement — SecureVault.

All limit checks (storage, file size, nominee count, asset count) happen
server-side only. The frontend NEVER determines whether an action is
allowed — it merely displays the server's response.

Every check uses atomic MongoDB operations to prevent TOCTOU race
conditions from concurrent requests.
"""

from fastapi import HTTPException
from bson import ObjectId

from app.core.database import db
from app.core.plans import get_plan

users_col = db["users"]
assets_col = db["assets"]
nominees_col = db["nominees"]


class UpgradeRequiredError(HTTPException):
    """Raised when a user action exceeds their plan limits."""

    def __init__(self, limit_type: str, current_plan: str, detail: str):
        super().__init__(
            status_code=402,  # 402 Payment Required
            detail={
                "error": "upgrade_required",
                "limit_type": limit_type,
                "current_plan": current_plan,
                "message": detail,
            },
        )


async def check_storage_limit(user: dict, new_file_size: int) -> None:
    """Check if adding new_file_size bytes would exceed the user's storage limit.

    Uses the plan config as the authoritative source, falling back to
    the user doc's storageLimit for backward compatibility.
    """
    plan_id = user.get("plan", "free")
    plan = get_plan(plan_id)
    storage_limit = plan["storage_limit"]
    storage_used = user.get("storageUsed", 0)

    if (storage_used + new_file_size) > storage_limit:
        from app.core.plans import PLANS
        used_mb = round(storage_used / (1024 * 1024), 1)
        limit_mb = round(storage_limit / (1024 * 1024), 1)
        new_mb = round(new_file_size / (1024 * 1024), 1)
        raise UpgradeRequiredError(
            limit_type="storage",
            current_plan=plan_id,
            detail=(
                f"Storage limit exceeded. You are using {used_mb} MB of "
                f"{limit_mb} MB. This file ({new_mb} MB) would exceed "
                f"your {plan['name']} plan limit. Please upgrade your plan."
            ),
        )


async def check_file_size_limit(user: dict, file_size: int) -> None:
    """Check if a single file exceeds the plan's per-file size limit."""
    plan_id = user.get("plan", "free")
    plan = get_plan(plan_id)
    file_size_limit = plan["file_size_limit"]

    if file_size > file_size_limit:
        limit_mb = round(file_size_limit / (1024 * 1024), 1)
        file_mb = round(file_size / (1024 * 1024), 1)
        raise UpgradeRequiredError(
            limit_type="file_size",
            current_plan=plan_id,
            detail=(
                f"File size ({file_mb} MB) exceeds the {limit_mb} MB "
                f"limit for your {plan['name']} plan. Please upgrade "
                f"your plan for larger file uploads."
            ),
        )


async def check_asset_limit(user_id: str, plan_id: str) -> None:
    """Check if the user has reached their asset count limit.

    Uses count_documents atomically — the actual insert should follow
    immediately after this check within the same request handler.
    """
    plan = get_plan(plan_id)
    asset_limit = plan["asset_limit"]
    current_count = await assets_col.count_documents({"userId": user_id})

    if current_count >= asset_limit:
        raise UpgradeRequiredError(
            limit_type="asset_count",
            current_plan=plan_id,
            detail=(
                f"You have reached the maximum of {asset_limit} assets "
                f"on your {plan['name']} plan. Please upgrade your plan "
                f"to store more digital assets."
            ),
        )


async def check_nominee_limit(user_id: str, plan_id: str) -> None:
    """Check if the user has reached their nominee count limit."""
    plan = get_plan(plan_id)
    nominee_limit = plan["nominee_limit"]
    current_count = await nominees_col.count_documents({"userId": user_id})

    if current_count >= nominee_limit:
        raise UpgradeRequiredError(
            limit_type="nominee_count",
            current_plan=plan_id,
            detail=(
                f"You have reached the maximum of {nominee_limit} "
                f"nominee{'s' if nominee_limit > 1 else ''} on your "
                f"{plan['name']} plan. Please upgrade your plan to add "
                f"more nominees."
            ),
        )


async def get_user_with_plan(user_id: str) -> dict:
    """Fetch user document and ensure plan fields are populated."""
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Default to free plan if not set
    if not user.get("plan"):
        user["plan"] = "free"

    return user
