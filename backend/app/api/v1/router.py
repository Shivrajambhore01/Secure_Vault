"""
Master API v1 Router Aggregator — SecureVault Enterprise
Combines all versioned v1 sub-routers into a single cohesive tree under /api/v1.
"""

from fastapi import APIRouter
from app.infrastructure.response import success_response
from app.api.v1.auth.router import router as auth_v1
from app.api.v1.users.router import router as users_v1
from app.api.v1.vault.router import router as vault_v1
from app.api.v1.assets.router import router as assets_v1
from app.api.v1.nominees.router import router as nominees_v1
from app.api.v1.policies.router import router as policies_v1
from app.api.v1.claims.router import router as claims_v1
from app.api.v1.verification.router import router as verification_v1
from app.api.v1.security.router import router as security_v1
from app.api.v1.recovery.router import router as recovery_v1
from app.api.v1.notifications.router import router as notifications_v1
from app.api.v1.compliance.router import router as compliance_v1
from app.api.v1.admin.router import router as admin_v1
from app.api.v1.system.router import router as system_v1
from app.api.v1.crypto.router import router as crypto_v1
from app.api.v1.governance.router import router as governance_v1
from app.api.v1.zerotrust.router import router as zerotrust_v1
from app.api.v1.compliance.evidence_router import evidence_router
from app.api.v1.enclave.router import router as enclave_v1

api_v1_router = APIRouter(prefix="/api/v1")


@api_v1_router.get("/health", tags=["v1 - Health"])
async def v1_health():
    return success_response(data={"status": "healthy", "version": "v1"})


# Register all sub-routers
api_v1_router.include_router(auth_v1)
api_v1_router.include_router(users_v1)
api_v1_router.include_router(vault_v1)
api_v1_router.include_router(assets_v1)
api_v1_router.include_router(nominees_v1)
api_v1_router.include_router(policies_v1)
api_v1_router.include_router(claims_v1)
api_v1_router.include_router(verification_v1)
api_v1_router.include_router(security_v1)
api_v1_router.include_router(recovery_v1)
api_v1_router.include_router(notifications_v1)
api_v1_router.include_router(compliance_v1)
api_v1_router.include_router(admin_v1)
api_v1_router.include_router(system_v1)
api_v1_router.include_router(crypto_v1)
api_v1_router.include_router(governance_v1)
api_v1_router.include_router(zerotrust_v1)
api_v1_router.include_router(evidence_router)
api_v1_router.include_router(enclave_v1)
