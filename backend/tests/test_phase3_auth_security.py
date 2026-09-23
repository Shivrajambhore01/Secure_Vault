"""
Phase 03 Authentication & Session Security Tests — SecureVault Enterprise
Tests registration, email verify, login, token rotation, TOTP MFA,
recovery codes, session termination, and security overview.
"""

import pytest
import pyotp
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.auth_service import AuthService
from app.services.mfa_service import MfaService
from app.services.session_service import SessionService
from app.domain.exceptions import UnauthorizedError, ValidationError


@pytest.mark.asyncio
async def test_auth_registration_and_email_verify():
    auth_service = AuthService()
    unique_email = "test_phase3_user@securevault.app"

    # Clean up previous runs if any
    await auth_service.users_col.delete_many({"email": unique_email})

    # 1. Register
    res = await auth_service.register(
        email=unique_email,
        password="ValidPassword@123",
        full_name="Phase3 Test User",
        pin="654321",
    )
    assert res["email"] == unique_email
    assert res["is_email_verified"] is False
    token = res["email_verification_token"]
    assert token is not None

    # 2. Verify Email
    ver_res = await auth_service.verify_email(token)
    assert ver_res["success"] is True

    # 3. Re-verification with burned token fails
    with pytest.raises(ValidationError):
        await auth_service.verify_email(token)


@pytest.mark.asyncio
async def test_auth_login_and_token_rotation():
    auth_service = AuthService()
    email = "test_phase3_user@securevault.app"

    # Login
    login_res = await auth_service.login(email=email, password="ValidPassword@123")
    assert login_res["mfa_required"] is False
    assert "access_token" in login_res
    refresh_token = login_res["refresh_token"]
    assert refresh_token is not None

    # Rotate refresh token
    rotate_res = await auth_service.rotate_refresh_token(refresh_token)
    assert "access_token" in rotate_res
    assert "refresh_token" in rotate_res
    assert rotate_res["refresh_token"] != refresh_token


@pytest.mark.asyncio
async def test_totp_mfa_and_recovery_codes():
    auth_service = AuthService()
    mfa_service = MfaService()
    email = "test_phase3_user@securevault.app"
    user = await auth_service.user_repo.get_by_email(email)
    user_id = str(user["_id"])

    # 1. Setup TOTP
    setup = await mfa_service.setup_totp(user_id)
    secret = setup["secret"]
    assert secret is not None
    assert "otpauth://" in setup["provisioning_uri"]

    # 2. Enable TOTP using valid code
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()
    enable_res = await mfa_service.enable_totp(user_id, valid_code)
    assert enable_res["enabled"] is True
    recovery_codes = enable_res["recovery_codes"]
    assert len(recovery_codes) == 10

    # 3. Verify TOTP code during challenge
    assert await mfa_service.verify_totp(user_id, totp.now()) is True

    # 4. Verify Single-Use Recovery Code and Burn It
    first_code = recovery_codes[0]
    assert await mfa_service.verify_recovery_code(user_id, first_code) is True

    # Re-using burned code must fail
    with pytest.raises(UnauthorizedError):
        await mfa_service.verify_recovery_code(user_id, first_code)

    # 5. Disable MFA
    disable_res = await mfa_service.disable_mfa(user_id, "ValidPassword@123")
    assert disable_res["enabled"] is False


@pytest.mark.asyncio
async def test_session_and_device_service():
    session_service = SessionService()
    auth_service = AuthService()
    email = "test_phase3_user@securevault.app"
    user = await auth_service.user_repo.get_by_email(email)
    user_id = str(user["_id"])

    # Mock request object for session creation
    class MockRequest:
        headers = {"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36"}
        client = None

    mock_req = MockRequest()
    sess_id_1 = await session_service.create_session(user_id, mock_req)
    sess_id_2 = await session_service.create_session(user_id, mock_req)

    # List active sessions
    sessions = await session_service.list_active_sessions(user_id, current_session_id=sess_id_2)
    assert len(sessions) >= 2
    curr = [s for s in sessions if s["session_id"] == sess_id_2][0]
    assert curr["is_current"] is True

    # Terminate sess_id_1
    await session_service.terminate_session(user_id, sess_id_1)
    updated_sessions = await session_service.list_active_sessions(user_id)
    assert not any(s["session_id"] == sess_id_1 for s in updated_sessions)

    # List devices & set trusted
    devices = await session_service.list_devices(user_id)
    assert len(devices) >= 1
    dev_id = devices[0]["id"]
    await session_service.set_device_trusted(user_id, dev_id, True)
    updated_devs = await session_service.list_devices(user_id)
    assert updated_devs[0]["isTrusted"] is True


@pytest.mark.asyncio
async def test_v1_auth_endpoints_integration():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test login endpoint
        login_res = await ac.post(
            "/api/v1/auth/login",
            json={"email": "test_phase3_user@securevault.app", "password": "ValidPassword@123"},
        )
        assert login_res.status_code == 200
        body = login_res.json()
        assert body["success"] is True
        assert body["data"]["email"] == "test_phase3_user@securevault.app"
        assert "access_token" in body["data"]
        access_token = body["data"]["access_token"]

        # Test security overview with access token
        overview_res = await ac.get(
            "/api/v1/security/overview",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert overview_res.status_code == 200
        ov_body = overview_res.json()
        assert ov_body["success"] is True
        assert "active_sessions_count" in ov_body["data"]
        assert "trusted_devices_count" in ov_body["data"]
