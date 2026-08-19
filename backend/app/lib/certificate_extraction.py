"""
Certificate Field Extraction Service for AI Verification.

Parses OCR text output and extracts structured death certificate fields:
  - Deceased person's full name
  - Date of birth & Date of death
  - Place of death
  - Certificate & Registration numbers
  - Registration date
  - Issuing authority / Registrar / Municipality
  - Father's / Mother's / Spouse's name
  - Address
  - Overall OCR confidence

If a field cannot be identified, it is returned as None (unknown) to require manual verification.
"""

import re
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("securevault.certificate_extraction")


# Regex patterns for common certificate fields
DATE_PATTERNS = [
    r"\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b",
    r"\b(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b",
    r"\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b",
]

CERT_NO_PATTERNS = [
    r"(?:Certificate|Cert|DC)\s*(?:No|Number|#)[\s\:\.\-]*([A-Z0-9\/\-]{4,20})",
    r"(?:Registration|Reg)\s*(?:No|Number|#)[\s\:\.\-]*([A-Z0-9\/\-]{4,20})",
]

AUTHORITY_PATTERNS = [
    r"(Municipal\s+Corporation[A-Za-z\s]*)",
    r"(Department\s+of\s+Health[A-Za-z\s]*)",
    r"(Registrar\s+of\s+Births\s+and\s+Deaths[A-Za-z\s]*)",
    r"(Gram\s+Panchayat[A-Za-z\s]*)",
    r"(Government\s+of\s+[A-Za-z\s]+)",
]


def extract_structured_fields(ocr_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract structured fields from OCR output.
    """
    full_text = ocr_data.get("full_text", "")
    lines = ocr_data.get("text_lines", [])
    avg_confidence = ocr_data.get("average_confidence", 0.0)

    extracted = {
        "deceased_name": None,
        "date_of_birth": None,
        "date_of_death": None,
        "place_of_death": None,
        "certificate_number": None,
        "registration_number": None,
        "registration_date": None,
        "issuing_authority": None,
        "municipality": None,
        "father_name": None,
        "mother_name": None,
        "spouse_name": None,
        "address": None,
        "ocr_confidence": avg_confidence,
        "total_lines_analyzed": len(lines),
    }

    if not full_text:
        return extracted

    # 1. Extract Deceased Name
    extracted["deceased_name"] = _extract_name(lines, full_text)

    # 2. Extract Dates (Date of Death, DOB, Registration Date)
    dates = _extract_dates(full_text)
    if dates:
        if len(dates) >= 1:
            extracted["date_of_death"] = dates[0]
        if len(dates) >= 2:
            extracted["date_of_birth"] = dates[1]
        if len(dates) >= 3:
            extracted["registration_date"] = dates[2]

    # 3. Extract Certificate and Registration Numbers
    cert_no, reg_no = _extract_cert_numbers(full_text)
    extracted["certificate_number"] = cert_no
    extracted["registration_number"] = reg_no

    # 4. Extract Issuing Authority
    extracted["issuing_authority"] = _extract_authority(full_text)

    # 5. Extract Relatives' Names
    relatives = _extract_relatives(full_text)
    extracted["father_name"] = relatives.get("father")
    extracted["mother_name"] = relatives.get("mother")
    extracted["spouse_name"] = relatives.get("spouse")

    # 6. Extract Place of Death & Address
    extracted["place_of_death"] = _extract_place_of_death(full_text)

    return extracted


def _extract_name(lines: list, full_text: str) -> Optional[str]:
    """Find deceased person's name using label heuristics."""
    name_keywords = [
        r"(?:Name of Deceased|Deceased Name|Name|Late|Deceased)\s*[\:\.\-]\s*([A-Za-z\s\.]+)",
        r"(?:This is to certify that|Death of)\s*([A-Za-z\s\.]+)",
    ]

    for pattern in name_keywords:
        match = re.search(pattern, full_text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip().split("\n")[0]
            # Clean candidate string
            candidate = re.sub(r"\b(is|was|registered|on|at|date|male|female)\b.*$", "", candidate, flags=re.IGNORECASE).strip()
            if len(candidate) > 2 and len(candidate) < 60:
                return candidate.title()

    # Search line by line for "Late <Name>"
    for line in lines:
        if re.search(r"\bLate\b", line, re.IGNORECASE):
            cleaned = re.sub(r"^.*?\bLate\b\s*", "", line, flags=re.IGNORECASE).strip()
            cleaned = re.sub(r"[\d\:\,].*$", "", cleaned).strip()
            if len(cleaned) > 2:
                return cleaned.title()

    return None


def _extract_dates(text: str) -> list:
    """Find all dates in document text."""
    found_dates = []
    for pattern in DATE_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for m in matches:
            if m not in found_dates:
                found_dates.append(m)
    return found_dates


def _extract_cert_numbers(text: str) -> tuple:
    """Extract Certificate and Registration numbers."""
    cert_no = None
    reg_no = None
    for pattern in CERT_NO_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = match.group(1).strip()
            if not cert_no:
                cert_no = val
            elif not reg_no and val != cert_no:
                reg_no = val
    return cert_no, reg_no


def _extract_authority(text: str) -> Optional[str]:
    """Extract issuing authority or municipality."""
    for pattern in AUTHORITY_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip().title()
    return None


def _extract_relatives(text: str) -> dict:
    """Extract Father/Mother/Spouse names if available."""
    relatives = {"father": None, "mother": None, "spouse": None}

    father_match = re.search(r"(?:Father['’]?s\s+Name|Father)\s*[\:\.\-]\s*([A-Za-z\s\.]+)", text, re.IGNORECASE)
    if father_match:
        relatives["father"] = father_match.group(1).strip().split("\n")[0].title()

    mother_match = re.search(r"(?:Mother['’]?s\s+Name|Mother)\s*[\:\.\-]\s*([A-Za-z\s\.]+)", text, re.IGNORECASE)
    if mother_match:
        relatives["mother"] = mother_match.group(1).strip().split("\n")[0].title()

    spouse_match = re.search(r"(?:Spouse['’]?s\s+Name|Husband|Wife|Spouse)\s*[\:\.\-]\s*([A-Za-z\s\.]+)", text, re.IGNORECASE)
    if spouse_match:
        relatives["spouse"] = spouse_match.group(1).strip().split("\n")[0].title()

    return relatives


def _extract_place_of_death(text: str) -> Optional[str]:
    """Extract place of death."""
    match = re.search(r"(?:Place of Death|Died at|Hospital|Location)\s*[\:\.\-]\s*([A-Za-z0-9\s\,\.]+)", text, re.IGNORECASE)
    if match:
        val = match.group(1).strip().split("\n")[0]
        if len(val) > 3 and len(val) < 80:
            return val.title()
    return None
