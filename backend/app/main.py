"""FastAPI entry point — port of backend/server.ts."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import verify_connection
from app.api.auth import router as auth_router
from app.api.assets import router as assets_router
from app.api.nominees import router as nominees_router
from app.api.payments import router as payments_router
from app.api.payment_admin import router as payment_admin_router
from app.api.admin_auth import router as admin_auth_router
from app.api.admin import router as admin_router
from app.api.verification import router as verification_router
from app.api.security_admin import router as security_admin_router
from app.api.support_admin import router as support_admin_router
from app.api.verification_submit import router as verification_submit_router
from app.api.verification_workflow import router as verification_workflow_router
from app.api.health import router as health_router
from app.api.dual_approval import router as dual_approval_router
from app.lib.enterprise_scheduler import start_inactivity_scheduler
from app.lib.rate_limit import GlobalRateLimitMiddleware
from app.lib.idempotency import IdempotencyMiddleware

from app.infrastructure.logging import setup_structured_logging
from app.infrastructure.middleware.request_id import RequestIdMiddleware
from app.infrastructure.middleware.audit_middleware import AuditMiddleware
from app.infrastructure.middleware.exception_handler import register_exception_handlers
from app.infrastructure.db_indexes import setup_database_indexes
from app.api.v1.router import api_v1_router

# Setup structured logging
setup_structured_logging()

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup
    await verify_connection()
    await setup_database_indexes()
    scheduler = start_inactivity_scheduler()
    yield
    # Shutdown
    scheduler.shutdown(wait=False)



OPENAPI_TAGS_METADATA = [
    {
        "name": "v1 - Health",
        "description": "System availability, version probes, and cluster ping endpoints.",
    },
    {
        "name": "v1 - System Operations & Workers",
        "description": "Deep multi-subsystem telemetry, distributed worker locks, durable task queue and Dead Letter Queue (DLQ).",
    },
    {
        "name": "v1 - Auth",
        "description": "User registration, Argon2id authentication, token rotation, TOTP MFA, and session security.",
    },
    {
        "name": "v1 - Users & Heartbeat",
        "description": "Vault owner profiles, inactivity parameters, and 'I Am Alive' heartbeat telemetry.",
    },
    {
        "name": "v1 - Vault & Dead Man's Switch",
        "description": "Digital Dead Man's Switch countdown monitor, staged escalation triggers, and emergency pause/resume.",
    },
    {
        "name": "v1 - Assets",
        "description": "Multi-category asset management with AES-256-GCM envelope encryption, versioning, rollback, and storage quotas.",
    },
    {
        "name": "v1 - Nominees",
        "description": "Tiered beneficiary management (PRIMARY, CONTINGENT, SECONDARY), cryptographic invitations, and asset allocation matrices.",
    },
    {
        "name": "v1 - Legacy Policies",
        "description": "Release policy engine supporting cooling periods, date locks, and multi-party guardian consensus thresholds.",
    },
    {
        "name": "v1 - Claims & Fraud Detection",
        "description": "Proof of death claims submission, deduplication, multi-signal fraud risk scoring, and owner dispute nullification.",
    },
    {
        "name": "v1 - Identity & Notary",
        "description": "Biometric government ID verification (IDV) sessions, remote online notarization (RON), and signed webhooks.",
    },
    {
        "name": "v1 - Security Operations & SIEM",
        "description": "Cryptographic hash-chained tamper-evident audit ledger, SIEM anomaly detection, and automated containment actions.",
    },
    {
        "name": "v1 - Social Recovery",
        "description": "Shamir's Secret Sharing (k-of-n) guardian escrow, timelocked recovery execution, and owner abort mechanisms.",
    },
    {
        "name": "v1 - Notifications",
        "description": "Multi-channel communications engine supporting Twilio SMS, voice calls, SMTP emails, and rate limiting.",
    },
    {
        "name": "v1 - Compliance & Privacy",
        "description": "GDPR Article 20 data portability packages, legal hold enforcement, and Article 17 cryptographic zeroization.",
    },
]

app = FastAPI(
    title="SecureVault Enterprise API",
    description="""
# SecureVault Enterprise API Documentation (v2.0.0)

SecureVault is an institutional-grade digital asset inheritance, zero-knowledge vault, and legacy planning platform.

### Core Architectural Capabilities:
- **Zero-Knowledge Encryption**: AES-256-GCM envelope encryption with hardware-grade Key Management Service (KMS).
- **Dead Man's Switch**: Automated inactivity detection with staged multi-channel escalation (Email, SMS, Voice).
- **Identity & Notary Integration**: Automated government biometric IDV and remote online notarization (RON).
- **Multi-Vector Fraud Detection**: Real-time claimant risk scoring and 1-click owner dispute nullification.
- **Tamper-Evident SIEM Ledger**: Cryptographic SHA-256 blockchain-style hash-chained audit trails.
- **Social Recovery**: Shamir's Secret Sharing mathematical key fragmentation across trusted guardians.
- **Regulatory Compliance**: GDPR/CCPA Article 20 portable signed packages and cryptographic data zeroization.
- **Worker Infrastructure**: Distributed lock leases (MongoDB TTL) and durable Dead Letter Task Queue (DLQ).
    """,
    version="2.0.0",
    terms_of_service="https://securevault.app/terms",
    contact={
        "name": "SecureVault Enterprise Engineering",
        "url": "https://securevault.app/support",
        "email": "security@securevault.app",
    },
    license_info={
        "name": "Proprietary Enterprise License",
        "url": "https://securevault.app/license",
    },
    openapi_tags=OPENAPI_TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
        tags=app.openapi_tags,
        terms_of_service=app.terms_of_service,
        contact=app.contact,
        license_info=app.license_info,
    )
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Standard JWT authentication token for authenticated user sessions.",
        },
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "Enterprise API Key for automated machine-to-machine integration.",
        },
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Register centralized exception handlers for standard envelope responses
register_exception_handlers(app)


# ------------------------------------------------------------------
# Security Headers Middleware
# ------------------------------------------------------------------
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects security headers on every response."""
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response

if settings.ENABLE_SECURITY_HEADERS:
    app.add_middleware(SecurityHeadersMiddleware)

# ------------------------------------------------------------------
# Rate Limiting & Idempotency Middlewares
# ------------------------------------------------------------------
app.add_middleware(GlobalRateLimitMiddleware)
app.add_middleware(IdempotencyMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(RequestIdMiddleware)

# ------------------------------------------------------------------
# CORS Middleware (Must be added LAST so it is the outermost middleware)
# ------------------------------------------------------------------
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://10.27.46.5:3000",
    "http://172.27.90.5:3000",
]
frontend_url_clean = settings.FRONTEND_URL.strip("\"'").rstrip('/')
if frontend_url_clean not in allowed_origins:
    allowed_origins.append(frontend_url_clean)
if settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app|https://.*\.ngrok-free\.dev|https://.*\.ngrok-free\.app|https://.*\.ngrok\.io|https://.*\.ngrok\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ------------------------------------------------------------------
# Static files (uploads)
# ------------------------------------------------------------------
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# ------------------------------------------------------------------
# API v1 Versioned Router (Primary Foundation)
# ------------------------------------------------------------------
app.include_router(api_v1_router)

# ------------------------------------------------------------------
# Legacy Routes (Preserved for backwards compatibility with existing UI)
# ------------------------------------------------------------------
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(assets_router, prefix="/api/assets", tags=["Assets"])
app.include_router(nominees_router, prefix="/api/nominees", tags=["Nominees"])
app.include_router(payments_router, prefix="/api/payments", tags=["Payments"])

# ------------------------------------------------------------------
# Admin Routes (completely separate from user routes)
# ------------------------------------------------------------------
app.include_router(admin_auth_router, prefix="/api/admin/auth", tags=["Admin Auth"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(verification_router, prefix="/api/admin/verification", tags=["Verification Admin"])
app.include_router(security_admin_router, prefix="/api/admin/security", tags=["Security Admin"])
app.include_router(support_admin_router, prefix="/api/admin/support", tags=["Support Admin"])
app.include_router(payment_admin_router, prefix="/api/admin/support/payments", tags=["Payment Admin"])

# ------------------------------------------------------------------
# Nominee Verification Submission (legacy simple submit)
# ------------------------------------------------------------------
app.include_router(verification_submit_router, prefix="/api/verification", tags=["Verification Submit"])

# ------------------------------------------------------------------
# Nominee Verification Workflow (multi-step inheritance verification)
# ------------------------------------------------------------------
app.include_router(verification_workflow_router, prefix="/api/verification", tags=["Verification Workflow"])

@app.get("/")
async def root():
    return {"message": "SecureVault Backend API is running...", "version": "2.0.0"}


@app.get("/api/v1/docs/export", tags=["v1 - Health"])
async def export_openapi_specification():
    """
    Export the complete OpenAPI 3.1 JSON specification contract.
    Used by CI/CD pipelines, Postman sync, SDK generation, and developer portals.
    """
    return app.openapi()


# ------------------------------------------------------------------
# Health & Monitoring Routes
# ------------------------------------------------------------------
app.include_router(health_router, prefix="", tags=["Monitoring"])

# ------------------------------------------------------------------
# Dual Approval (CRITICAL risk claims require two separate admins)
# ------------------------------------------------------------------
app.include_router(dual_approval_router, prefix="/api/admin/verification", tags=["Dual Approval"])



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
