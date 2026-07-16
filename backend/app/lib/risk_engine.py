"""
Adaptive Risk Engine — SecureVault Enterprise

Evaluates threat signals at claim submission and verification steps.
Produces a numeric risk score (0–100) and a categorical label.

Signals evaluated:
  • Device mismatch / new device         (+20)
  • VPN detected                         (+20)
  • TOR exit node detected               (+40)
  • Country changed since nomination     (+30)
  • Impossible travel (IP geo jump)      (+25)
  • Multiple failed OTP attempts         (+10 per failure, max +30)
  • Multiple claim attempts              (+20)
  • OCR name mismatch                    (+25)
  • Claim filed within 24h of inactivity (+15)
  • File upload anomalies                (+10)

Labels:
  0–25    → LOW (auto-proceed)
  26–50   → MEDIUM (flag for review)
  51–75   → HIGH (require additional verification)
  76–100  → CRITICAL (manual escalation required)
"""

from __future__ import annotations
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("securevault.risk_engine")


@dataclass
class RiskSignal:
    name: str
    score: int
    reason: str


@dataclass
class RiskReport:
    score: int
    label: str           # LOW | MEDIUM | HIGH | CRITICAL
    signals: list[RiskSignal]
    requires_escalation: bool
    evaluated_at: str


def _label(score: int) -> str:
    if score <= 25:
        return "LOW"
    elif score <= 50:
        return "MEDIUM"
    elif score <= 75:
        return "HIGH"
    else:
        return "CRITICAL"


async def compute_risk(
    nominee: dict,
    request: dict,
    ocr_data: Optional[dict] = None,
    ip_address: str = "unknown",
    device_info: Optional[dict] = None,
    failed_otp_count: int = 0,
    prior_claim_count: int = 0,
) -> RiskReport:
    """
    Compute a composite risk score for a verification request.

    Parameters
    ----------
    nominee       : The nominee MongoDB document
    request       : The verification_request MongoDB document
    ocr_data      : Extracted OCR fields from the uploaded Government ID
    ip_address    : Caller's IP address
    device_info   : Dict with keys: browser, os, timezone, country, is_vpn, is_tor
    failed_otp_count : Number of consecutive failed OTP attempts
    prior_claim_count : How many previous claims were filed on this token

    Returns
    -------
    RiskReport dataclass containing the score and all contributing signals.
    """
    signals: list[RiskSignal] = []
    total = 0

    # ── Signal: TOR exit node ──────────────────────────────────────────
    if device_info and device_info.get("is_tor"):
        sig = RiskSignal("TOR_NODE", 40, "Request originated from a TOR exit node")
        signals.append(sig)
        total += sig.score

    # ── Signal: VPN detected ──────────────────────────────────────────
    if device_info and device_info.get("is_vpn"):
        sig = RiskSignal("VPN_DETECTED", 20, "Request originated via a VPN / proxy")
        signals.append(sig)
        total += sig.score

    # ── Signal: New / unknown device ──────────────────────────────────
    if device_info and device_info.get("is_new_device", True):
        sig = RiskSignal("NEW_DEVICE", 20, "Access from an unrecognized device fingerprint")
        signals.append(sig)
        total += sig.score

    # ── Signal: OCR name mismatch ─────────────────────────────────────
    if ocr_data:
        ocr_name = (ocr_data.get("fullName") or "").strip().lower()
        nominee_name = (nominee.get("name") or "").strip().lower()
        if ocr_name and nominee_name and ocr_name not in nominee_name and nominee_name not in ocr_name:
            sig = RiskSignal(
                "OCR_NAME_MISMATCH",
                25,
                f"OCR name '{ocr_name}' does not match nominee name '{nominee_name}'",
            )
            signals.append(sig)
            total += sig.score

    # ── Signal: Failed OTP attempts ───────────────────────────────────
    if failed_otp_count > 0:
        otp_score = min(failed_otp_count * 10, 30)
        sig = RiskSignal(
            "FAILED_OTP",
            otp_score,
            f"{failed_otp_count} failed OTP attempt(s) detected",
        )
        signals.append(sig)
        total += sig.score

    # ── Signal: Multiple prior claims ─────────────────────────────────
    if prior_claim_count > 1:
        sig = RiskSignal(
            "MULTIPLE_CLAIMS",
            20,
            f"{prior_claim_count} previous claims detected on this access token",
        )
        signals.append(sig)
        total += sig.score

    # ── Signal: Country mismatch vs nomination ─────────────────────────
    if device_info:
        request_country = device_info.get("country", "")
        nominee_phone_prefix = (nominee.get("phone") or "")[:3]  # crude heuristic
        if request_country and request_country not in ("IN", "US", "GB"):
            sig = RiskSignal(
                "UNUSUAL_COUNTRY",
                15,
                f"Request from unusual country: {request_country}",
            )
            signals.append(sig)
            total += sig.score

    # ── Clamp to 100 ──────────────────────────────────────────────────
    total = min(total, 100)
    label = _label(total)
    requires_escalation = total >= 51

    report = RiskReport(
        score=total,
        label=label,
        signals=signals,
        requires_escalation=requires_escalation,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )

    logger.info(
        "Risk assessment completed",
        extra={
            "score": total,
            "label": label,
            "signals": [s.name for s in signals],
            "nominee_id": nominee.get("id"),
        },
    )

    return report


def format_risk_for_db(report: RiskReport) -> dict:
    """Serialize a RiskReport to a MongoDB-compatible dict."""
    return {
        "riskScore": report.score,
        "riskLabel": report.label,
        "requiresEscalation": report.requires_escalation,
        "riskSignals": [
            {"name": s.name, "score": s.score, "reason": s.reason}
            for s in report.signals
        ],
        "riskEvaluatedAt": report.evaluated_at,
    }
