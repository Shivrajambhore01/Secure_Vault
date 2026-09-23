"""
Role-Based Access Control & Permission Verification — SecureVault Enterprise
"""

from typing import List
from fastapi import Request
from app.domain.exceptions import ForbiddenError, UnauthorizedError
from app.domain.value_objects import AdminRole
from app.security.tokens import decode_token


def require_authenticated_user(request: Request) -> str:
    """Extracts and verifies userId from accessToken cookie or Authorization Bearer header."""
    token = request.cookies.get("accessToken")
    if not token and "authorization" in request.headers:
        auth_header = request.headers["authorization"]
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if not token:
        raise UnauthorizedError("Authentication required")

    payload = decode_token(token)
    user_id = payload.get("userId") or payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid token payload")
    return user_id


def require_admin_role(request: Request, allowed_roles: List[AdminRole]) -> dict:
    """Verifies that the request comes from an authenticated admin with an allowed role."""
    token = request.cookies.get("adminToken") or request.cookies.get("accessToken")
    if not token and "authorization" in request.headers:
        auth_header = request.headers["authorization"]
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if not token:
        raise UnauthorizedError("Admin authentication required")

    payload = decode_token(token, is_admin=True)
    role = payload.get("role")
    if not role or role not in [r.value for r in allowed_roles]:
        raise ForbiddenError(f"Operation requires one of: {[r.value for r in allowed_roles]}")

    return payload
