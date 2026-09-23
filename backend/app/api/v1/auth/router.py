"""
Auth API v1 Router — SecureVault Enterprise
Complete enterprise authentication endpoints with MFA and token lifecycle.
"""

from typing import Optional
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, EmailStr
from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.auth_service import AuthService
from app.services.mfa_service import MfaService

router = APIRouter(prefix="/auth", tags=["v1 - Authentication"])
auth_service = AuthService()
mfa_service = MfaService()


# ── Schemas ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    fullName: str
    phone: Optional[str] = None
    pin: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MfaChallengeRequest(BaseModel):
    userId: str
    code: str
    isRecovery: bool = False


class VerifyEmailRequest(BaseModel):
    token: str


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str


class VerifyPinRequest(BaseModel):
    pin: str


class EnableTotpRequest(BaseModel):
    code: str


class DisableMfaRequest(BaseModel):
    passwordOrCode: str


# ── Endpoints ────────────────────────────────────────────────────────

@router.post("/register")
async def register(body: RegisterRequest, request: Request, response: Response):
    result = await auth_service.register(
        email=body.email,
        password=body.password,
        full_name=body.fullName,
        phone=body.phone,
        pin=body.pin,
        request=request,
    )
    response.set_cookie("accessToken", result["access_token"], httponly=True, samesite="lax")
    response.set_cookie("refreshToken", result["refresh_token"], httponly=True, samesite="lax")
    return success_response(data=result, status_code=201)


@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest):
    res = await auth_service.verify_email(body.token)
    return success_response(data=res)


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response):
    result = await auth_service.login(email=body.email, password=body.password, request=request)
    if not result.get("mfa_required"):
        response.set_cookie("accessToken", result["access_token"], httponly=True, samesite="lax")
        response.set_cookie("refreshToken", result["refresh_token"], httponly=True, samesite="lax")
    return success_response(data=result)


@router.post("/mfa/challenge")
async def mfa_challenge(body: MfaChallengeRequest, request: Request, response: Response):
    result = await auth_service.complete_mfa_login(
        user_id=body.userId,
        code=body.code,
        is_recovery=body.isRecovery,
        request=request,
    )
    response.set_cookie("accessToken", result["access_token"], httponly=True, samesite="lax")
    response.set_cookie("refreshToken", result["refresh_token"], httponly=True, samesite="lax")
    return success_response(data=result)


@router.post("/logout")
async def logout(request: Request, response: Response):
    user_id = None
    try:
        user_id = require_authenticated_user(request)
    except Exception:
        pass

    session_id = request.headers.get("X-Session-ID")
    await auth_service.logout(session_id=session_id, user_id=user_id)
    response.delete_cookie("accessToken")
    response.delete_cookie("refreshToken")
    return success_response(data={"message": "Logged out successfully"})


@router.post("/logout-all")
async def logout_all(request: Request, response: Response):
    user_id = require_authenticated_user(request)
    current_session_id = request.headers.get("X-Session-ID")
    terminated_count = await auth_service.logout_all(user_id=user_id, except_session_id=None)
    response.delete_cookie("accessToken")
    response.delete_cookie("refreshToken")
    return success_response(data={"message": f"Successfully terminated {terminated_count} sessions"})


@router.post("/refresh")
async def refresh_tokens(request: Request, response: Response):
    refresh_token = request.cookies.get("refreshToken")
    if not refresh_token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            refresh_token = auth_header.split(" ", 1)[1]

    if not refresh_token:
        from app.domain.exceptions import UnauthorizedError
        raise UnauthorizedError("No refresh token provided")

    result = await auth_service.rotate_refresh_token(refresh_token, request=request)
    response.set_cookie("accessToken", result["access_token"], httponly=True, samesite="lax")
    response.set_cookie("refreshToken", result["refresh_token"], httponly=True, samesite="lax")
    return success_response(data=result)


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, request: Request):
    user_id = require_authenticated_user(request)
    await auth_service.change_password(user_id, body.currentPassword, body.newPassword)
    return success_response(data={"message": "Password updated successfully"})


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    res = await auth_service.forgot_password(body.email)
    return success_response(data=res)


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    res = await auth_service.reset_password(body.token, body.newPassword)
    return success_response(data=res)


@router.post("/verify-pin")
async def verify_pin(body: VerifyPinRequest, request: Request):
    user_id = require_authenticated_user(request)
    await auth_service.verify_pin(user_id, body.pin)
    return success_response(data={"verified": True, "message": "Secondary PIN verified"})


# ── MFA Sub-routes ───────────────────────────────────────────────────

@router.post("/mfa/setup-totp")
async def setup_totp(request: Request):
    user_id = require_authenticated_user(request)
    res = await mfa_service.setup_totp(user_id)
    return success_response(data=res)


@router.post("/mfa/enable-totp")
async def enable_totp(body: EnableTotpRequest, request: Request):
    user_id = require_authenticated_user(request)
    res = await mfa_service.enable_totp(user_id, body.code)
    return success_response(data=res)


@router.post("/mfa/disable")
async def disable_mfa(body: DisableMfaRequest, request: Request):
    user_id = require_authenticated_user(request)
    res = await mfa_service.disable_mfa(user_id, body.passwordOrCode)
    return success_response(data=res)


@router.post("/mfa/recovery-codes")
async def regenerate_recovery_codes(request: Request):
    user_id = require_authenticated_user(request)
    codes = await mfa_service.regenerate_recovery_codes(user_id)
    return success_response(data={"recovery_codes": codes, "message": "New recovery codes generated"})
