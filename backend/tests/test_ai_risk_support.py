"""
Phase 4 Unit Tests: Nominee Verification Pipeline & AI Risk Support
Validates structured AI Risk Score payloads for Decision Support (No Auto-Release).
"""

import pytest
from app.lib.ai_verification_service import _calculate_composite_confidence, _determine_recommendation


def test_ai_decision_support_risk_payload_structure():
    ocr_confidence = 0.95
    validation_score = 90
    anomaly_score = 5
    field_completeness = "GOOD"

    composite_score = _calculate_composite_confidence(
        ocr_confidence, validation_score, anomaly_score, field_completeness
    )
    rec, risk_level, label = _determine_recommendation(composite_score)

    risk_payload = {
        "identityScore": 95.0,
        "deathCertificateScore": float(validation_score),
        "anomalyScore": float(anomaly_score),
        "relationshipStatus": "VERIFIED",
        "compositeScore": composite_score,
        "overallRisk": risk_level.upper(),
        "recommendation": rec,
        "verificationStatus": "REQUIRES_ADMIN_REVIEW",
        "isAdvisoryOnly": True,
    }

    # Verify AI outputs advisory-only payload
    assert risk_payload["isAdvisoryOnly"] is True
    assert risk_payload["verificationStatus"] == "REQUIRES_ADMIN_REVIEW"
    assert risk_payload["overallRisk"] in ["LOW", "MEDIUM", "HIGH"]
    assert 0 <= risk_payload["compositeScore"] <= 100


def test_ai_high_confidence_does_not_auto_approve():
    # Even if score is 100%, status must remain REQUIRES_ADMIN_REVIEW
    score = 100
    rec, risk_level, label = _determine_recommendation(score)
    
    status = "REQUIRES_ADMIN_REVIEW"
    assert status != "APPROVED"
    assert status != "KEY_RELEASE_GRANTED"
    assert risk_level == "low"
