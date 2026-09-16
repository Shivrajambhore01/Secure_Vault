"""
Automated Database Index Initializer — SecureVault Enterprise
Provisions unique, compound, and TTL indexes across all MongoDB collections during startup.
"""

from pymongo import ASCENDING, DESCENDING, IndexModel
from app.core.database import db
from app.infrastructure.logging import get_logger

logger = get_logger("securevault.indexes")


async def setup_database_indexes() -> None:
    """Create all required enterprise indexes across collections."""
    logger.info("Initializing enterprise MongoDB database indexes...")

    index_specs = {
        "users": [
            IndexModel([("email", ASCENDING)], unique=True, name="idx_users_email_unique"),
            IndexModel([("lastActive", DESCENDING)], name="idx_users_last_active"),
            IndexModel([("logoutTime", ASCENDING)], name="idx_users_logout_time"),
        ],
        "admins": [
            IndexModel([("email", ASCENDING)], unique=True, name="idx_admins_email_unique"),
            IndexModel([("role", ASCENDING)], name="idx_admins_role"),
        ],
        "organizations": [
            IndexModel([("slug", ASCENDING)], unique=True, name="idx_orgs_slug_unique"),
            IndexModel([("ownerId", ASCENDING)], name="idx_orgs_owner_id"),
        ],
        "memberships": [
            IndexModel([("organizationId", ASCENDING), ("userId", ASCENDING)], unique=True, name="idx_memberships_unique"),
        ],
        "sessions": [
            IndexModel([("userId", ASCENDING)], name="idx_sessions_user_id"),
            IndexModel([("tokenHash", ASCENDING)], name="idx_sessions_token_hash"),
            IndexModel([("expiresAt", ASCENDING)], expireAfterSeconds=0, name="idx_sessions_ttl"),
        ],
        "devices": [
            IndexModel([("userId", ASCENDING), ("id", ASCENDING)], name="idx_devices_user_device"),
        ],
        "vaults": [
            IndexModel([("userId", ASCENDING)], name="idx_vaults_user_id"),
            IndexModel([("status", ASCENDING)], name="idx_vaults_status"),
        ],
        "assets": [
            IndexModel([("userId", ASCENDING)], name="idx_assets_user_id"),
            IndexModel([("type", ASCENDING)], name="idx_assets_type"),
            IndexModel([("nomineeIds", ASCENDING)], name="idx_assets_nominee_ids"),
        ],
        "asset_versions": [
            IndexModel([("assetId", ASCENDING), ("versionNumber", ASCENDING)], unique=True, name="idx_asset_versions_unique"),
        ],
        "asset_access": [
            IndexModel([("assetId", ASCENDING), ("accessedAt", DESCENDING)], name="idx_asset_access_history"),
        ],
        "nominees": [
            IndexModel([("userId", ASCENDING)], name="idx_nominees_user_id"),
            IndexModel([("accessToken", ASCENDING)], name="idx_nominees_access_token"),
            IndexModel([("email", ASCENDING)], name="idx_nominees_email"),
        ],
        "policies": [
            IndexModel([("userId", ASCENDING)], name="idx_policies_user_id"),
        ],
        "claim_cases": [
            IndexModel([("caseNumber", ASCENDING)], unique=True, name="idx_claims_case_number_unique"),
            IndexModel([("userId", ASCENDING)], name="idx_claims_user_id"),
            IndexModel([("status", ASCENDING)], name="idx_claims_status"),
        ],
        "claim_events": [
            IndexModel([("caseId", ASCENDING), ("timestamp", DESCENDING)], name="idx_claim_events_case_timeline"),
        ],
        "verification_workflows": [
            IndexModel([("userId", ASCENDING)], name="idx_workflows_user_id"),
            IndexModel([("emergencyHaltToken", ASCENDING)], name="idx_workflows_halt_token"),
        ],
        "verification_requests": [
            IndexModel([("nomineeId", ASCENDING)], name="idx_ver_req_nominee_id"),
            IndexModel([("status", ASCENDING)], name="idx_ver_req_status"),
        ],
        "risk_assessments": [
            IndexModel([("caseId", ASCENDING)], name="idx_risk_case_id"),
        ],
        "approval_requests": [
            IndexModel([("caseId", ASCENDING), ("status", ASCENDING)], name="idx_approvals_case_status"),
        ],
        "notification_logs": [
            IndexModel([("recipient", ASCENDING)], name="idx_notif_recipient"),
            IndexModel([("status", ASCENDING)], name="idx_notif_status"),
            IndexModel([("createdAt", DESCENDING)], name="idx_notif_created_at"),
        ],
        "audit_logs": [
            IndexModel([("userId", ASCENDING), ("timestamp", DESCENDING)], name="idx_audit_user_timeline"),
        ],
        "security_events": [
            IndexModel([("userId", ASCENDING), ("severity", ASCENDING)], name="idx_security_events_user_sev"),
        ],
        "incidents": [
            IndexModel([("incidentNumber", ASCENDING)], unique=True, name="idx_incidents_number_unique"),
            IndexModel([("status", ASCENDING)], name="idx_incidents_status"),
        ],
        "jobs": [
            IndexModel([("status", ASCENDING), ("createdAt", ASCENDING)], name="idx_jobs_status_queue"),
        ],
        "reminders": [
            IndexModel([("userId", ASCENDING), ("dueDate", ASCENDING), ("isCompleted", ASCENDING)], name="idx_reminders_user_due"),
        ],
        "feature_flags": [
            IndexModel([("key", ASCENDING)], unique=True, name="idx_flags_key_unique"),
        ],
    }

    created_count = 0
    for coll_name, models in index_specs.items():
        try:
            coll = db[coll_name]
            await coll.create_indexes(models)
            created_count += len(models)
        except Exception as e:
            logger.warning("Index creation notice for '%s': %s", coll_name, e)

    logger.info("Successfully provisioned %d database indexes across %d collections.", created_count, len(index_specs))
