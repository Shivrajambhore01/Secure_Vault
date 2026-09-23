"""
Phase 08: Claim Verification & Fraud Detection Tests — SecureVault Enterprise
Tests:
- Claim submission, SHA-256 certificate deduplication, and hash generation
- Multi-signal fraud risk scoring engine (duplicate hash, conflicting claims, claimant tier)
- Owner 1-click 'I Am Alive' dispute nullification
- Supervisor / Admin adjudication (APPROVED, REJECTED, REQUIRE_NOTARY)
- Full API v1 /claims and /verification integration endpoints
"""

import pytest
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db
from app.security.tokens import create_access_token
from app.services.claim_service import (
    ClaimService,
    ClaimSubmissionRequest,
    ClaimAdjudicationRequest,
)


@pytest.fixture
def claim_service():
    return ClaimService(db)


@pytest.mark.asyncio
async def test_claim_submission_and_hash_deduplication(claim_service):
    user_id = f"test_owner_p8_{uuid.uuid4().hex[:8]}"
    claimant_id = f"nom_p8_{uuid.uuid4().hex[:8]}"
    vault_id = f"vlt_p8_{uuid.uuid4().hex[:8]}"

    # Enroll accepted nominee in db
    await db.nominees.insert_one({
        "id": claimant_id,
        "userId": user_id,
        "email": "claimant@example.com",
        "status": "ACCEPTED",
        "tier": "PRIMARY",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    # 1. Submit original claim
    req1 = ClaimSubmissionRequest(
        vault_id=vault_id,
        owner_email_or_id=user_id,
        certificate_number="CERT-NY-2026-99881",
        document_base64_or_text="OFFICIAL_STATE_VITAL_RECORD_RECORD_BLOB_A",
        issuing_jurisdiction="New York Department of Health",
        claimant_notes="Passing occurred on Sept 10",
    )
    claim1 = await claim_service.submit_claim(claimant_id=claimant_id, payload=req1)

    assert claim1["id"].startswith("claim_")
    assert claim1["caseNumber"].startswith("CASE-")
    assert claim1["status"] == "UNDER_REVIEW"
    assert claim1["certificateHash"] is not None

    # 2. Submit second claim with identical certificate payload (Duplicate detection)
    claimant_rival = f"nom_rival_{uuid.uuid4().hex[:8]}"
    req2 = ClaimSubmissionRequest(
        vault_id=vault_id,
        owner_email_or_id=user_id,
        certificate_number="CERT-NY-2026-99881",
        document_base64_or_text="OFFICIAL_STATE_VITAL_RECORD_RECORD_BLOB_A",
        issuing_jurisdiction="New York Department of Health",
    )
    claim2 = await claim_service.submit_claim(claimant_id=claimant_rival, payload=req2)

    assert claim2["certificateHash"] == claim1["certificateHash"]
    # Risk score must include duplicate cert hash (+50)
    assert claim2["riskScore"] >= 50
    assert any(f["rule"] == "DUPLICATE_CERTIFICATE_HASH" for f in claim2["riskFactors"])
    assert claim2["riskLevel"] in ["HIGH", "CRITICAL"]


@pytest.mark.asyncio
async def test_fraud_risk_scoring_engine(claim_service):
    user_id = f"test_owner_p8_risk_{uuid.uuid4().hex[:8]}"
    claimant_id = f"unregistered_claimant_{uuid.uuid4().hex[:8]}"
    vault_id = f"vlt_risk_{uuid.uuid4().hex[:8]}"

    # Submit claim from UNREGISTERED claimant with competing claim context
    # Pre-insert competing claim
    await db.claims.insert_one({
        "id": f"claim_rival_{uuid.uuid4().hex[:6]}",
        "caseNumber": "CASE-2026-RIVAL1",
        "userId": user_id,
        "nomineeId": "some_other_nominee",
        "status": "UNDER_REVIEW",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    req = ClaimSubmissionRequest(
        vault_id=vault_id,
        owner_email_or_id=user_id,
        certificate_number=f"CERT-{uuid.uuid4().hex[:6]}",
        document_base64_or_text=f"UNIQUE_BLOB_{uuid.uuid4().hex}",
        issuing_jurisdiction="California Vital Statistics",
    )
    claim = await claim_service.submit_claim(claimant_id=claimant_id, payload=req)

    # Risk should flag CONFLICTING_RIVAL_CLAIMS (+30) and UNREGISTERED_CLAIMANT (+25) = 55+
    assert claim["riskScore"] >= 55
    rules = [f["rule"] for f in claim["riskFactors"]]
    assert "CONFLICTING_RIVAL_CLAIMS" in rules
    assert "UNREGISTERED_CLAIMANT" in rules


@pytest.mark.asyncio
async def test_owner_dispute_nullifies_claim(claim_service):
    user_id = f"test_owner_p8_dispute_{uuid.uuid4().hex[:8]}"
    claimant_id = f"nom_p8_disp_{uuid.uuid4().hex[:8]}"
    vault_id = f"vlt_disp_{uuid.uuid4().hex[:8]}"

    req = ClaimSubmissionRequest(
        vault_id=vault_id,
        owner_email_or_id=user_id,
        certificate_number=f"CERT-{uuid.uuid4().hex[:6]}",
        document_base64_or_text=f"TEST_DOC_{uuid.uuid4().hex}",
        issuing_jurisdiction="Texas Health Registry",
    )
    claim = await claim_service.submit_claim(claimant_id=claimant_id, payload=req)

    # Owner files dispute
    res = await claim_service.owner_dispute_claim(
        user_id=user_id,
        claim_id=claim["id"],
        reason="I am alive and traveling internationally.",
    )
    assert res["success"] is True
    assert res["status"] == "REJECTED_DISPUTED"

    # Verify db state
    in_db = await db.claims.find_one({"id": claim["id"]})
    assert in_db["status"] == "REJECTED_DISPUTED"
    assert "I am alive" in in_db["rejectionReason"]


@pytest.mark.asyncio
async def test_claim_adjudication_and_approval(claim_service):
    user_id = f"test_owner_p8_adj_{uuid.uuid4().hex[:8]}"
    claimant_id = f"nom_p8_adj_{uuid.uuid4().hex[:8]}"
    admin_id = f"admin_{uuid.uuid4().hex[:6]}"
    vault_id = f"vlt_adj_{uuid.uuid4().hex[:8]}"

    req = ClaimSubmissionRequest(
        vault_id=vault_id,
        owner_email_or_id=user_id,
        certificate_number=f"CERT-{uuid.uuid4().hex[:6]}",
        document_base64_or_text=f"VALID_CERT_{uuid.uuid4().hex}",
        issuing_jurisdiction="London Registrar General",
    )
    claim = await claim_service.submit_claim(claimant_id=claimant_id, payload=req)

    # 1. Require notary
    adj_notary = await claim_service.adjudicate_claim(
        admin_id=admin_id,
        claim_id=claim["id"],
        payload=ClaimAdjudicationRequest(
            decision="REQUIRE_NOTARY",
            notes="Please provide apostilled seal.",
        )
    )
    assert adj_notary["status"] == "WAITING_DOCUMENTS"

    # 2. Final Approval
    adj_appr = await claim_service.adjudicate_claim(
        admin_id=admin_id,
        claim_id=claim["id"],
        payload=ClaimAdjudicationRequest(
            decision="APPROVED",
            notes="Official apostille verified by supervisor.",
        )
    )
    assert adj_appr["status"] == "APPROVED"

    in_db = await db.claims.find_one({"id": claim["id"]})
    assert in_db["status"] == "APPROVED"
    assert in_db["approvedAt"] is not None


@pytest.mark.asyncio
async def test_v1_claims_api_endpoints():
    user_id = f"test_user_p8_api_{uuid.uuid4().hex[:8]}"
    token = create_access_token(data={"sub": user_id, "email": "claimant_api@example.com"})
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Submit Claim via API
        sub_res = await client.post(
            "/api/v1/claims",
            headers=headers,
            json={
                "vault_id": "vlt_api_test",
                "owner_email_or_id": user_id,
                "certificate_number": "CERT-API-1002",
                "document_base64_or_text": "CERTIFICATE_CONTENT_BLOB",
                "issuing_jurisdiction": "Illinois Vital Records",
            }
        )
        assert sub_res.status_code == 201
        data = sub_res.json()["data"]
        case_id = data["id"]
        case_number = data["caseNumber"]

        # 2. Get Single Claim
        get_res = await client.get(f"/api/v1/claims/{case_number}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["data"]["caseNumber"] == case_number

        # 3. List Claims
        list_res = await client.get("/api/v1/claims", headers=headers)
        assert list_res.status_code == 200
        items = list_res.json()["data"]
        assert any(c["id"] == case_id for c in items)

        # 4. Owner Dispute Claim
        disp_res = await client.post(
            f"/api/v1/claims/{case_id}/dispute",
            headers=headers,
            json={"reason": "Owner alive - disputing API claim"}
        )
        assert disp_res.status_code == 200
        assert disp_res.json()["data"]["status"] == "REJECTED_DISPUTED"

        # 5. Adjudicate Claim
        adj_res = await client.post(
            f"/api/v1/claims/{case_id}/adjudicate",
            headers=headers,
            json={"decision": "APPROVED", "notes": "Supervisory approval"}
        )
        assert adj_res.status_code == 200
        assert adj_res.json()["data"]["status"] == "APPROVED"

        # 6. Verification Fraud Rules Endpoint
        rules_res = await client.get("/api/v1/verification/fraud-rules", headers=headers)
        assert rules_res.status_code == 200
        rules = rules_res.json()["data"]
        assert len(rules) >= 4
