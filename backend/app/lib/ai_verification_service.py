"""
AI Verification Orchestrator Service.

Coordinates the complete AI Death Certificate Verification pipeline:
  1. Document Retrieval & Decryption
  2. Image Preprocessing (PDF/Image normalization)
  3. PaddleOCR Text Detection & Recognition
  4. Structured Field Extraction
  5. Identity & Date Validation Engine
  6. Visual Anomaly Analysis
  7. Composite AI Verification Confidence Score Generation (0-100)
  8. Configurable Recommendation Category Assignment (Likely Valid / Requires Review / Potential Issues Detected)

IMPORTANT: The AI is strictly an assistant to the Verification Admin.
It NEVER automatically approves or rejects a request. The admin retains 100% final authority.
"""

import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from bson import ObjectId

from app.core.config import get_settings
from app.core.database import db
from app.lib.encryption import decrypt_bytes
from app.lib.document_preprocessing import preprocess_document_for_ocr
from app.lib.ocr_service import extract_ocr_from_document
from app.lib.certificate_extraction import extract_structured_fields
from app.lib.certificate_validation import validate_certificate
from app.lib.document_anomaly import analyze_document_anomalies

logger = logging.getLogger("securevault.ai_verification_service")
settings = get_settings()

# Collections
verifications_col = db["verification_requests"]
documents_col = db["verification_documents"]
ai_verifications_col = db["ai_verifications"]
users_col = db["users"]
nominees_col = db["nominees"]


async def run_ai_verification(verification_id: str, admin_id: str = "system") -> Dict[str, Any]:
    """
    Run complete AI verification analysis on a death verification request.
    Stores and returns the auditable AI verification report.
    """
    start_time = time.time()
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Fetch verification request
    v_req = await verifications_col.find_one({"id": verification_id})
    if not v_req:
        v_req = await verifications_col.find_one({"_id": ObjectId(verification_id)}) if ObjectId.is_valid(verification_id) else None
    
    if not v_req:
        err_msg = f"Verification request '{verification_id}' not found."
        logger.error(err_msg)
        return _build_failed_result(verification_id, err_msg, start_time)

    req_id = v_req.get("id", verification_id)

    # 2. Fetch Owner & Nominee profiles for identity comparison
    user_id = v_req.get("userId")
    nominee_id = v_req.get("nomineeId")

    try:
        owner = await users_col.find_one(
            {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id},
            {"fullName": 1, "dob": 1, "email": 1}
        )
    except Exception:
        owner = None

    nominee = await nominees_col.find_one({"id": nominee_id}, {"name": 1, "email": 1, "relation": 1})

    # 3. Fetch Document File Bytes
    doc_obj = await documents_col.find_one({
        "requestId": req_id,
        "documentType": {"$in": ["DEATH_CERTIFICATE", "DEATH_REGISTRATION", "HOSPITAL_RECORD"]}
    })

    if not doc_obj and v_req.get("certificateFile") and isinstance(v_req["certificateFile"], dict):
        doc_obj = v_req["certificateFile"]

    if not doc_obj or not doc_obj.get("data"):
        err_msg = "No death certificate file found for AI analysis. Manual verification required."
        logger.warning(f"[{req_id}] {err_msg}")
        return await _save_and_return_failed(req_id, err_msg, start_time, admin_id)

    # 4. Decrypt File Bytes
    try:
        file_bytes = decrypt_bytes(doc_obj["data"])
        mime_type = doc_obj.get("mimeType", "application/pdf")
        doc_id = str(doc_obj.get("id", doc_obj.get("_id", "unknown")))
    except Exception as e:
        err_msg = f"Document decryption failed: {e}. Manual verification required."
        logger.error(f"[{req_id}] {err_msg}")
        return await _save_and_return_failed(req_id, err_msg, start_time, admin_id)

    try:
        # 5. Preprocessing
        logger.info(f"[{req_id}] Running image preprocessing...")
        preprocessed_pages = preprocess_document_for_ocr(file_bytes, mime_type)

        if not preprocessed_pages:
            err_msg = "Unable to extract images from document. Corrupted or unreadable PDF/image."
            return await _save_and_return_failed(req_id, err_msg, start_time, admin_id)

        # 6. PaddleOCR Extraction
        logger.info(f"[{req_id}] Running OCR extraction on {len(preprocessed_pages)} page(s)...")
        ocr_result = extract_ocr_from_document(preprocessed_pages)

        # 7. Structured Field Extraction
        logger.info(f"[{req_id}] Extracting structured certificate fields...")
        extracted_fields = extract_structured_fields(ocr_result)

        # 8. Identity & Date Validation
        logger.info(f"[{req_id}] Running certificate validation checks...")
        validation_results = validate_certificate(extracted_fields, owner or {}, nominee or {})

        # 9. Document Visual Anomaly Detection
        logger.info(f"[{req_id}] Analyzing document visual anomalies...")
        first_page_img = preprocessed_pages[0][0]
        anomaly_report = analyze_document_anomalies(first_page_img, ocr_result.get("boxes", []))

        # 10. Compute Composite AI Verification Confidence Score (0-100)
        confidence_score = _calculate_composite_confidence(
            ocr_confidence=ocr_result.get("average_confidence", 0.0),
            validation_score=validation_results.get("overall_score", 50),
            anomaly_score=anomaly_report.get("anomaly_score", 0),
            field_completeness_score=validation_results["summary"].get("completeness", "INCOMPLETE"),
        )

        # 11. Assign Configurable Recommendation & Risk Level
        recommendation, risk_level, rec_label = _determine_recommendation(confidence_score)

        elapsed_ms = int((time.time() - start_time) * 1000)

        # 12. Build Final Report
        ai_report = {
            "id": f"ai_ver_{req_id}",
            "verificationRequestId": req_id,
            "documentId": doc_id,
            "status": "completed",
            "ocrEngine": ocr_result.get("engine", "PaddleOCR"),
            "ocrEngineVersion": "2.7.5",
            "extractedFields": extracted_fields,
            "ocrConfidence": round(ocr_result.get("average_confidence", 0.0) * 100, 1),
            "ocrRawText": ocr_result.get("full_text", ""),
            "validationResults": validation_results,
            "anomalyIndicators": anomaly_report.get("indicators", []),
            "anomalySummary": anomaly_report.get("summary", "No significant anomaly detected"),
            "aiVerificationConfidence": confidence_score,
            "recommendation": recommendation,
            "recommendationLabel": rec_label,
            "riskLevel": risk_level,
            "processingTimeMs": elapsed_ms,
            "errors": [],
            "analyzedAt": now_iso,
            "analyzedBy": admin_id,
            "modelVersion": "1.0.0",
            "isAdvisoryOnly": True,
            "disclaimer": "AI-assisted analysis only. Final verification must be performed by an authorized administrator."
        }

        # Store in database
        await ai_verifications_col.update_one(
            {"verificationRequestId": req_id},
            {"$set": ai_report},
            upsert=True,
        )

        # Attach reference to verification_requests collection
        await verifications_col.update_one(
            {"id": req_id},
            {"$set": {
                "aiVerification": {
                    "confidence": confidence_score,
                    "recommendation": recommendation,
                    "recommendationLabel": rec_label,
                    "riskLevel": risk_level,
                    "analyzedAt": now_iso,
                },
                "updatedAt": now_iso,
            }}
        )

        logger.info(f"[{req_id}] AI Verification completed in {elapsed_ms}ms. Score: {confidence_score} ({rec_label})")
        return ai_report

    except Exception as e:
        logger.exception(f"[{req_id}] Unexpected error in AI verification pipeline: {e}")
        return await _save_and_return_failed(req_id, f"AI analysis encounter error: {e}. Manual verification required.", start_time, admin_id)


def _calculate_composite_confidence(
    ocr_confidence: float,
    validation_score: int,
    anomaly_score: int,
    field_completeness_score: str,
) -> int:
    """
    Calculate composite AI Verification Confidence Score (0-100).
    Weights:
      - Identity & Field Validation: 45%
      - OCR Quality & Clarity: 25%
      - Field Completeness: 15%
      - Visual Anomaly Deductions: 15%
    """
    # OCR score (0.0 to 1.0 -> 0 to 100)
    ocr_score = min(int(ocr_confidence * 100), 100)

    # Completeness sub-score
    completeness_val = 90 if field_completeness_score == "GOOD" else 50

    # Anomaly deduction (0 anomaly = 100 score, 50 anomaly = 50 score)
    anomaly_sub_score = max(100 - anomaly_score, 0)

    weighted = (
        (validation_score * 0.45) +
        (ocr_score * 0.25) +
        (completeness_val * 0.15) +
        (anomaly_sub_score * 0.15)
    )

    return min(max(round(weighted), 0), 100)


def _determine_recommendation(score: int) -> tuple:
    """
    Map AI Verification Confidence Score to recommendation categories based on config thresholds.
    """
    high_thresh = settings.AI_HIGH_CONFIDENCE_THRESHOLD
    med_thresh = settings.AI_MEDIUM_CONFIDENCE_THRESHOLD

    if score >= high_thresh:
        return "likely_valid", "low", "Likely Valid"
    elif score >= med_thresh:
        return "requires_review", "medium", "Requires Review"
    else:
        return "potential_issues_detected", "high", "Potential Issues Detected"


async def _save_and_return_failed(verification_id: str, error_msg: str, start_time: float, admin_id: str) -> Dict[str, Any]:
    """Helper to record and return a failed AI verification report without crashing the workflow."""
    elapsed_ms = int((time.time() - start_time) * 1000)
    now_iso = datetime.now(timezone.utc).isoformat()

    failed_report = {
        "id": f"ai_ver_{verification_id}",
        "verificationRequestId": verification_id,
        "status": "failed",
        "errorMessage": "AI analysis unavailable — Manual verification required.",
        "details": error_msg,
        "aiVerificationConfidence": 0,
        "recommendation": "requires_manual_verification",
        "recommendationLabel": "Manual Verification Required",
        "riskLevel": "medium",
        "processingTimeMs": elapsed_ms,
        "analyzedAt": now_iso,
        "analyzedBy": admin_id,
        "isAdvisoryOnly": True,
        "disclaimer": "AI analysis unavailable. Verification Admin must inspect documents manually."
    }

    await ai_verifications_col.update_one(
        {"verificationRequestId": verification_id},
        {"$set": failed_report},
        upsert=True,
    )

    return failed_report


def _build_failed_result(verification_id: str, error_msg: str, start_time: float) -> Dict[str, Any]:
    return {
        "id": f"ai_ver_{verification_id}",
        "verificationRequestId": verification_id,
        "status": "failed",
        "errorMessage": "AI analysis unavailable — Manual verification required.",
        "details": error_msg,
        "aiVerificationConfidence": 0,
        "recommendation": "requires_manual_verification",
        "recommendationLabel": "Manual Verification Required",
        "riskLevel": "medium",
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "isAdvisoryOnly": True,
    }
