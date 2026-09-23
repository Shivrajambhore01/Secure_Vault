"""
Enterprise Role-Based Access Control (RBAC) & Permissions Engine — Phase 18.
Defines institutional roles, granular capability permissions, and FastAPI enforcers.
"""

from enum import Enum
from typing import Set, List, Optional
from fastapi import Request, HTTPException, status, Depends


class EnterpriseRole(str, Enum):
    """Hierarchical roles for SecureVault enterprise multi-tenancy."""
    SUPER_ADMIN = "SUPER_ADMIN"
    SECURITY_OFFICER = "SECURITY_OFFICER"
    COMPLIANCE_AUDITOR = "COMPLIANCE_AUDITOR"
    SUPPORT_AGENT = "SUPPORT_AGENT"
    TENANT_ADMIN = "TENANT_ADMIN"
    VAULT_OWNER = "VAULT_OWNER"
    NOMINEE_BENEFICIARY = "NOMINEE_BENEFICIARY"
    NOTARY_ESCROW = "NOTARY_ESCROW"


class Permission(str, Enum):
    """Granular capabilities enforced across service and API boundaries."""
    # Audit & SIEM
    AUDIT_READ = "audit:read"
    AUDIT_STREAM = "audit:stream"
    AUDIT_VERIFY = "audit:verify"
    
    # Vault & Assets
    VAULT_READ = "vault:read"
    VAULT_WRITE = "vault:write"
    VAULT_FREEZE = "vault:freeze"
    
    # Multi-Tenancy & Governance
    TENANT_MANAGE = "tenant:manage"
    TENANT_VIEW = "tenant:view"
    
    # Compliance & Legal
    COMPLIANCE_EXPORT = "compliance:export"
    COMPLIANCE_ZEROIZE = "compliance:zeroize"
    LEGAL_HOLD_SET = "legal_hold:set"
    
    # Claims Adjudication & Fraud
    CLAIM_SUBMIT = "claim:submit"
    CLAIM_DISPUTE = "claim:dispute"
    CLAIM_ADJUDICATE = "claim:adjudicate"
    CLAIM_ADJUDICATE_DUAL = "claim:adjudicate_dual"
    
    # Background Workers & Operations
    WORKER_TRIGGER = "worker:trigger"
    WORKER_REPLAY = "worker:replay"
    
    # Notary & Verification
    NOTARY_OPERATE = "notary:operate"


# Role-to-Permissions Matrix
ROLE_PERMISSIONS: dict[EnterpriseRole, Set[Permission]] = {
    EnterpriseRole.SUPER_ADMIN: set(Permission),  # All permissions
    EnterpriseRole.SECURITY_OFFICER: {
        Permission.AUDIT_READ,
        Permission.AUDIT_STREAM,
        Permission.AUDIT_VERIFY,
        Permission.VAULT_FREEZE,
        Permission.CLAIM_ADJUDICATE,
        Permission.CLAIM_ADJUDICATE_DUAL,
        Permission.WORKER_TRIGGER,
        Permission.WORKER_REPLAY,
        Permission.TENANT_VIEW,
    },
    EnterpriseRole.COMPLIANCE_AUDITOR: {
        Permission.AUDIT_READ,
        Permission.AUDIT_STREAM,
        Permission.AUDIT_VERIFY,
        Permission.COMPLIANCE_EXPORT,
        Permission.COMPLIANCE_ZEROIZE,
        Permission.LEGAL_HOLD_SET,
        Permission.TENANT_VIEW,
    },
    EnterpriseRole.SUPPORT_AGENT: {
        Permission.AUDIT_READ,
        Permission.CLAIM_ADJUDICATE,
        Permission.NOTARY_OPERATE,
    },
    EnterpriseRole.TENANT_ADMIN: {
        Permission.TENANT_MANAGE,
        Permission.TENANT_VIEW,
        Permission.AUDIT_READ,
        Permission.AUDIT_STREAM,
        Permission.VAULT_READ,
    },
    EnterpriseRole.VAULT_OWNER: {
        Permission.VAULT_READ,
        Permission.VAULT_WRITE,
        Permission.CLAIM_DISPUTE,
        Permission.COMPLIANCE_EXPORT,
        Permission.COMPLIANCE_ZEROIZE,
    },
    EnterpriseRole.NOMINEE_BENEFICIARY: {
        Permission.CLAIM_SUBMIT,
        Permission.VAULT_READ,
    },
    EnterpriseRole.NOTARY_ESCROW: {
        Permission.NOTARY_OPERATE,
        Permission.CLAIM_ADJUDICATE,
    },
}


def get_role_permissions(role: EnterpriseRole) -> Set[Permission]:
    """Retrieve the set of allowed permissions for a given enterprise role."""
    return ROLE_PERMISSIONS.get(role, set())


def has_permission(role: EnterpriseRole, permission: Permission) -> bool:
    """Check if an enterprise role possesses a specific permission."""
    return permission in get_role_permissions(role)


def require_permission(*required_perms: Permission):
    """
    FastAPI dependency factory enforcing that the authenticated principal
    possesses all required permissions.
    """
    def permission_checker(request: Request):
        # Extract role from request state (populated by auth middleware)
        user_role_str = getattr(request.state, "role", None)
        
        # Fallback check on headers if provided in test/machine environments
        if not user_role_str:
            user_role_str = request.headers.get("X-User-Role")
            
        if not user_role_str:
            # Default to VAULT_OWNER if standard authenticated user without elevated role
            user_role_str = EnterpriseRole.VAULT_OWNER.value

        try:
            role = EnterpriseRole(user_role_str.upper())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Invalid enterprise role '{user_role_str}' provided."
            )

        granted_perms = get_role_permissions(role)
        missing_perms = [p for p in required_perms if p not in granted_perms]
        
        if missing_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Role '{role.value}' lacks required permissions: {[p.value for p in missing_perms]}"
            )
            
        return role

    return permission_checker
