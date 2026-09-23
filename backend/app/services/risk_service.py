"""
Risk & Fraud Service — SecureVault Enterprise
Evaluates incoming verification signals, IP threat intel, and OCR discrepancies.
"""

from typing import Any, Dict, Optional
from app.lib.risk_engine import compute_risk, RiskReport
from app.services.base import BaseService


class RiskService(BaseService):
    async def assess_claim_risk(
        self,
        nominee: Dict[str, Any],
        request: Dict[str, Any],
        ocr_data: Optional[Dict[str, Any]] = None,
        ip_address: str = "unknown",
        device_info: Optional[Dict[str, Any]] = None,
    ) -> RiskReport:
        report = await compute_risk(
            nominee=nominee,
            request=request,
            ocr_data=ocr_data,
            ip_address=ip_address,
            device_info=device_info,
        )
        self.logger.info("Risk evaluated: Score=%d Label=%s", report.score, report.label)
        return report
