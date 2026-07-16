"""
Enhanced Role-Based Access Control (RBAC) — SecureVault Enterprise

Defines all platform roles and their permissions using the
Principle of Least Privilege.

Role Hierarchy:
  SUPER_ADMIN         — Full system access, can create/delete admins
  VERIFICATION_ADMIN  — Can review and decide on verification requests
  AUDITOR             — Read-only access to audit logs and reports
  SUPPORT             — Can view user profiles but not decrypt assets
  READ_ONLY           — View-only access to non-sensitive data

Permission model:
  Each role has a set of allowed permission strings.
  API routes declare which permission they require.
  The require_permission() dependency enforces the check.
"""

from enum import Enum
from typing import Set
from fastapi import HTTPException


class Role(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    VERIFICATION_ADMIN = "VERIFICATION_ADMIN"
    AUDITOR = "AUDITOR"
    SUPPORT = "SUPPORT"
    READ_ONLY = "READ_ONLY"


class Permission(str, Enum):
    # Verification workflow
    VIEW_VERIFICATIONS = "VIEW_VERIFICATIONS"
    CLAIM_VERIFICATION = "CLAIM_VERIFICATION"
    APPROVE_VERIFICATION = "APPROVE_VERIFICATION"
    REJECT_VERIFICATION = "REJECT_VERIFICATION"
    REQUEST_MORE_DOCS = "REQUEST_MORE_DOCS"
    VIEW_DOCUMENTS = "VIEW_DOCUMENTS"

    # Admin management
    CREATE_ADMIN = "CREATE_ADMIN"
    DELETE_ADMIN = "DELETE_ADMIN"
    VIEW_ADMINS = "VIEW_ADMINS"
    MODIFY_ADMIN = "MODIFY_ADMIN"

    # User management
    VIEW_USERS = "VIEW_USERS"
    LOCK_USER = "LOCK_USER"
    DELETE_USER = "DELETE_USER"

    # Audit & reports
    VIEW_AUDIT_LOGS = "VIEW_AUDIT_LOGS"
    EXPORT_AUDIT_LOGS = "EXPORT_AUDIT_LOGS"
    VIEW_METRICS = "VIEW_METRICS"

    # System
    MANAGE_SETTINGS = "MANAGE_SETTINGS"
    MANAGE_KEYS = "MANAGE_KEYS"


# ─────────────────────────────────────────────────────────────────────
# Permission Matrix — maps each role to its allowed permissions
# ─────────────────────────────────────────────────────────────────────

ROLE_PERMISSIONS: dict[Role, Set[Permission]] = {

    Role.READ_ONLY: {
        Permission.VIEW_VERIFICATIONS,
        Permission.VIEW_METRICS,
    },

    Role.SUPPORT: {
        Permission.VIEW_VERIFICATIONS,
        Permission.VIEW_USERS,
        Permission.VIEW_AUDIT_LOGS,
        Permission.VIEW_METRICS,
    },

    Role.AUDITOR: {
        Permission.VIEW_VERIFICATIONS,
        Permission.VIEW_AUDIT_LOGS,
        Permission.EXPORT_AUDIT_LOGS,
        Permission.VIEW_METRICS,
        Permission.VIEW_ADMINS,
        Permission.VIEW_USERS,
        Permission.VIEW_DOCUMENTS,
    },

    Role.VERIFICATION_ADMIN: {
        Permission.VIEW_VERIFICATIONS,
        Permission.CLAIM_VERIFICATION,
        Permission.APPROVE_VERIFICATION,
        Permission.REJECT_VERIFICATION,
        Permission.REQUEST_MORE_DOCS,
        Permission.VIEW_DOCUMENTS,
        Permission.VIEW_AUDIT_LOGS,
        Permission.VIEW_METRICS,
        Permission.VIEW_USERS,
    },

    Role.SUPER_ADMIN: set(Permission),  # All permissions
}


def has_permission(role: str, permission: Permission) -> bool:
    """Check whether a given role holds a specific permission."""
    try:
        role_enum = Role(role)
    except ValueError:
        return False
    allowed = ROLE_PERMISSIONS.get(role_enum, set())
    return permission in allowed


def assert_permission(role: str, permission: Permission, detail: str = ""):
    """
    Raise HTTP 403 if the role does not have the required permission.
    Use this as an early guard in route handlers.
    """
    if not has_permission(role, permission):
        raise HTTPException(
            status_code=403,
            detail=detail or f"Your role ({role}) does not have permission: {permission.value}",
        )


def require_any_role(*roles: str):
    """
    FastAPI dependency factory: require the admin to have one of the listed roles.

    Usage:
        @router.get("/sensitive")
        async def handler(admin=Depends(require_role(...))):
    """
    async def _dep(admin: dict):
        if admin.get("role") not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of these roles: {', '.join(roles)}",
            )
        return admin
    return _dep


def get_role_summary() -> dict:
    """Return a human-readable permission matrix (for documentation endpoints)."""
    return {
        role.value: sorted([p.value for p in perms])
        for role, perms in ROLE_PERMISSIONS.items()
    }
