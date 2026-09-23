"""
Users API v1 Router — SecureVault Enterprise
"""

from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel
from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["v1 - Users"])
user_service = UserService()


class InactivityUpdateRequest(BaseModel):
    inactivityPeriod: float


@router.get("/me")
async def get_current_user_profile(request: Request):
    user_id = require_authenticated_user(request)
    profile = await user_service.get_profile(user_id)
    return success_response(data=profile)


@router.post("/heartbeat")
async def user_heartbeat(request: Request):
    user_id = require_authenticated_user(request)
    res = await user_service.record_heartbeat(user_id)
    return success_response(data=res)


@router.put("/inactivity-period")
async def update_inactivity(body: InactivityUpdateRequest, request: Request):
    user_id = require_authenticated_user(request)
    res = await user_service.update_inactivity_settings(user_id, body.inactivityPeriod)
    return success_response(data=res)
