"""
Background Workers Collection — SecureVault Enterprise
OCRWorker, NotificationWorker, RiskWorker, and CleanupWorker.
"""

from typing import Any, Dict
from app.workers.base import BaseWorker
from app.infrastructure.logging import get_logger

logger = get_logger("securevault.workers")


class OCRWorker(BaseWorker):
    def __init__(self):
        super().__init__("OCRWorker")

    async def process_job(self, payload: Dict[str, Any]) -> Any:
        verification_id = payload.get("verification_id")
        self.logger.info("Starting AI OCR processing for verification: %s", verification_id)
        from app.lib.ai_verification_service import run_ai_verification
        result = await run_ai_verification(verification_id)
        self.logger.info("OCR completed for %s: Confidence=%s", verification_id, result.get("aiConfidenceScore"))
        return result


class NotificationWorker(BaseWorker):
    def __init__(self):
        super().__init__("NotificationWorker")

    async def process_job(self, payload: Dict[str, Any]) -> Any:
        recipient = payload.get("recipient")
        subject = payload.get("subject")
        html = payload.get("html")
        template = payload.get("template", "GENERIC")
        self.logger.info("Dispatching notification to %s: '%s'", recipient, subject)
        from app.lib.notifications import send_email
        return await send_email(recipient, subject, html, template=template)


class RiskWorker(BaseWorker):
    def __init__(self):
        super().__init__("RiskWorker")

    async def process_job(self, payload: Dict[str, Any]) -> Any:
        nominee = payload.get("nominee", {})
        request = payload.get("request", {})
        self.logger.info("Computing asynchronous risk assessment for claim %s", request.get("id"))
        from app.lib.risk_engine import compute_risk
        return await compute_risk(nominee=nominee, request=request)


class CleanupWorker(BaseWorker):
    def __init__(self):
        super().__init__("CleanupWorker")

    async def process_job(self, payload: Dict[str, Any]) -> Any:
        self.logger.info("Running background cleanup of expired OTPs and temporary sessions...")
        from app.core.database import db
        from datetime import datetime, timezone
        now_utc = datetime.now(timezone.utc)
        # Clean expired verification OTPs
        res = await db["verification_otps"].delete_many({"expiresAt": {"$lt": now_utc}})
        self.logger.info("Cleaned up %d expired verification OTPs", res.deleted_count)
        return {"cleaned_otps": res.deleted_count}
