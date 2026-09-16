"""
Unified Domain Schemas Barrel Export — SecureVault Enterprise
Aggregates all 35+ enterprise collection schemas.
"""

from app.domain.schemas.identity import (
    OrganizationSchema,
    MembershipSchema,
    SessionSchema,
    DeviceSchema,
    MfaMethodSchema,
)
from app.domain.schemas.vault import VaultSchema, LegacyPlanSchema
from app.domain.schemas.asset import AssetVersionSchema, AssetAccessSchema, AssetTagSchema
from app.domain.schemas.nominee import NomineeVerificationSchema
from app.domain.schemas.policy import PolicyVersionSchema, PolicyExecutionSchema
from app.domain.schemas.claim import ClaimCaseExtendedSchema, ClaimEventSchema
from app.domain.schemas.risk import RiskAssessmentSchema, RiskEventSchema
from app.domain.schemas.approval import ApprovalRequestSchema, ApprovalActionSchema
from app.domain.schemas.notification import NotificationDeliverySchema
from app.domain.schemas.security import (
    SecurityEventSchema,
    SecurityAlertSchema,
    IncidentSchema,
    IncidentEvidenceSchema,
)
from app.domain.schemas.jobs import JobAttemptSchema, DeadLetterJobSchema
from app.domain.schemas.reminders import ReminderSchema
from app.domain.schemas.integrations import (
    IntegrationSchema,
    OAuthConnectionSchema,
    WebhookSchema,
)
from app.domain.schemas.recovery import RecoveryRequestSchema, EmergencyAccessSchema
from app.domain.schemas.storage import StorageObjectSchema, EncryptionMetadataSchema
from app.domain.schemas.compliance import ConsentSchema, LegalDocumentSchema
from app.domain.schemas.config import FeatureFlagSchema, SystemConfigSchema

__all__ = [
    "OrganizationSchema",
    "MembershipSchema",
    "SessionSchema",
    "DeviceSchema",
    "MfaMethodSchema",
    "VaultSchema",
    "LegacyPlanSchema",
    "AssetVersionSchema",
    "AssetAccessSchema",
    "AssetTagSchema",
    "NomineeVerificationSchema",
    "PolicyVersionSchema",
    "PolicyExecutionSchema",
    "ClaimCaseExtendedSchema",
    "ClaimEventSchema",
    "RiskAssessmentSchema",
    "RiskEventSchema",
    "ApprovalRequestSchema",
    "ApprovalActionSchema",
    "NotificationDeliverySchema",
    "SecurityEventSchema",
    "SecurityAlertSchema",
    "IncidentSchema",
    "IncidentEvidenceSchema",
    "JobAttemptSchema",
    "DeadLetterJobSchema",
    "ReminderSchema",
    "IntegrationSchema",
    "OAuthConnectionSchema",
    "WebhookSchema",
    "RecoveryRequestSchema",
    "EmergencyAccessSchema",
    "StorageObjectSchema",
    "EncryptionMetadataSchema",
    "ConsentSchema",
    "LegalDocumentSchema",
    "FeatureFlagSchema",
    "SystemConfigSchema",
]
