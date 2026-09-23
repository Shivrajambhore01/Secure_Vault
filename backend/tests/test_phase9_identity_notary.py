"""
Phase 09: Identity & Notary Integration Tests — SecureVault Enterprise
Tests:
- Biometric IDV session creation and inquiry link generation
- e-Notary envelope creation and legal seal tracking
- HMAC-SHA256 webhook signature validation and anti-tamper rejection
- Automated nominee promotion (ACCEPTED -> VERIFIED) upon IDV approval webhook
- Full API v1 /verification integration endpoints
"""

import json
import pytest
import uuid
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import db
from app.security.tokens import create_access_token
from app.services.identity_notary_service import (
    IdentityNotaryService,
    IDVSessionRequest,
    NotarySessionRequest,
    WEBHOOK_HMAC_SECRET,
)
from app.domain.exceptions import UnauthorizedError


@pytest.fixture
def idv_service():
    return IdentityNotaryService(db, webhook_secret=WEBHOOK_HMAC_SECRET)


@pytest.mark.asyncio
async def test_idv_session_creation_and_expiry(idv_service):
    user_id = f"test_owner_p9_{uuid.uuid4().hex[:8]}"
    nominee_id = f"nom_p9_{uuid.uuid4().hex[:8]}"

    # Setup nominee
    await db.nominees.insert_one({
        "id": nominee_id,
        "userId": user_id,
        "email": "heir@example.com",
        "status": "ACCEPTED",
        "tier": "PRIMARY",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    req = IDVSessionRequest(
        nominee_id=nominee_id,
        provider="VERIFF",
        redirect_url="https://securevault.app/callback",
    )
    session = await idv_service.create_idv_session(user_id=user_id, payload=req)

    assert session["id"].startswith("idv_sess_")
    assert session["status"] == "INITIATED"
    assert "veriff.com" in session["inquiryUrl"]
    assert session["expiresAt"] is not None


@pytest.mark.asyncio
async def test_notary_envelope_creation_and_tracking(idv_service):
    user_id = f"test_owner_p9_notary_{uuid.uuid4().hex[:8]}"
    nominee_id = f"nom_p9_notary_{uuid.uuid4().hex[:8]}"
    claim_id = f"claim_p9_notary_{uuid.uuid4().hex[:8]}"

    await db.nominees.insert_one({
        "id": nominee_id,
        "userId": user_id,
        "email": "executor@example.com",
        "status": "ACCEPTED",
        "tier": "EXECUTOR",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    req = NotarySessionRequest(
        claim_id=claim_id,
        nominee_id=nominee_id,
        provider="DOCUSIGN",
        document_titles=["Probate Court Grant", "Death Record Certificate"],
    )
    envelope = await idv_service.create_notary_session(user_id=user_id, payload=req)

    assert envelope["id"].startswith("notary_env_")
    assert envelope["status"] == "PENDING_SIGNATURE"
    assert "notary.securevault.io" in envelope["signingUrl"]
    assert len(envelope["documentTitles"]) == 2

    # Verify retrieval
    fetched = await idv_service.get_notary_envelope(envelope["id"])
    assert fetched["id"] == envelope["id"]


@pytest.mark.asyncio
async def test_webhook_hmac_signature_verification(idv_service):
    raw_payload = b'{"event": "inquiry.completed", "session_id": "test_123", "status": "APPROVED"}'

    # 1. Valid signature
    valid_sig = idv_service.generate_hmac_signature(raw_payload, WEBHOOK_HMAC_SECRET)
    assert idv_service.verify_webhook_signature(raw_payload, valid_sig) is True

    # 2. Tampered payload
    tampered_payload = b'{"event": "inquiry.completed", "session_id": "test_123", "status": "APPROVED", "tamper": true}'
    assert idv_service.verify_webhook_signature(tampered_payload, valid_sig) is False

    # 3. Invalid signature
    assert idv_service.verify_webhook_signature(raw_payload, "invalid_signature_hex") is False

    # 4. Processing with bad signature must raise UnauthorizedError
    with pytest.raises(UnauthorizedError):
        await idv_service.process_idv_webhook(
            payload={"id": "nonexistent"},
            raw_body=raw_payload,
            signature_header="invalid_hex",
            enforce_signature=True,
        )


@pytest.mark.asyncio
async def test_webhook_auto_promotes_nominee_to_verified(idv_service):
    user_id = f"test_owner_p9_prom_{uuid.uuid4().hex[:8]}"
    nominee_id = f"nom_p9_prom_{uuid.uuid4().hex[:8]}"

    # Nominee starts as ACCEPTED
    await db.nominees.insert_one({
        "id": nominee_id,
        "userId": user_id,
        "email": "promoted_heir@example.com",
        "status": "ACCEPTED",
        "tier": "PRIMARY",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    # Create IDV session
    session = await idv_service.create_idv_session(
        user_id=user_id,
        payload=IDVSessionRequest(nominee_id=nominee_id, provider="PERSONA"),
    )

    # Prepare webhook payload
    webhook_data = {
        "event": "inquiry.completed",
        "session_id": session["id"],
        "status": "APPROVED",
        "liveness_score": 99.4,
        "country": "US",
        "id_type": "PASSPORT",
    }
    raw_bytes = json.dumps(webhook_data).encode("utf-8")
    sig = idv_service.generate_hmac_signature(raw_bytes, WEBHOOK_HMAC_SECRET)

    # Process webhook
    res = await idv_service.process_idv_webhook(
        payload=webhook_data,
        raw_body=raw_bytes,
        signature_header=sig,
        enforce_signature=True,
    )

    assert res["success"] is True
    assert res["nomineePromoted"] is True

    # Verify nominee in database was promoted to VERIFIED
    nominee_in_db = await db.nominees.find_one({"id": nominee_id})
    assert nominee_in_db["status"] == "VERIFIED"
    assert nominee_in_db["verifiedAt"] is not None


@pytest.mark.asyncio
async def test_v1_verification_endpoints_integration():
    user_id = f"test_owner_p9_api_{uuid.uuid4().hex[:8]}"
    nominee_id = f"nom_p9_api_{uuid.uuid4().hex[:8]}"
    claim_id = f"claim_p9_api_{uuid.uuid4().hex[:8]}"

    token = create_access_token(data={"sub": user_id, "email": "owner_api@example.com"})
    headers = {"Authorization": f"Bearer {token}"}

    await db.nominees.insert_one({
        "id": nominee_id,
        "userId": user_id,
        "email": "api_heir@example.com",
        "status": "ACCEPTED",
        "tier": "PRIMARY",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create IDV Session
        idv_res = await client.post(
            "/api/v1/verification/idv/session",
            headers=headers,
            json={"nominee_id": nominee_id, "provider": "SUMSUB"}
        )
        assert idv_res.status_code == 201
        session_id = idv_res.json()["data"]["id"]

        # 2. Get IDV Session
        get_idv = await client.get(f"/api/v1/verification/idv/{session_id}")
        assert get_idv.status_code == 200
        assert get_idv.json()["data"]["id"] == session_id

        # 3. Create Notary Session
        notary_res = await client.post(
            "/api/v1/verification/notary/session",
            headers=headers,
            json={"claim_id": claim_id, "nominee_id": nominee_id, "provider": "NOTARIZE"}
        )
        assert notary_res.status_code == 201
        envelope_id = notary_res.json()["data"]["id"]

        # 4. Get Notary Envelope
        get_notary = await client.get(f"/api/v1/verification/notary/{envelope_id}")
        assert get_notary.status_code == 200
        assert get_notary.json()["data"]["id"] == envelope_id

        # 5. Fire IDV Webhook via API with HMAC signature
        service = IdentityNotaryService(db)
        webhook_body = json.dumps({
            "event": "inquiry.completed",
            "session_id": session_id,
            "status": "APPROVED",
            "liveness_score": 97.8,
        }).encode("utf-8")
        sig = service.generate_hmac_signature(webhook_body, WEBHOOK_HMAC_SECRET)

        wh_res = await client.post(
            "/api/v1/verification/webhooks/idv",
            content=webhook_body,
            headers={"Content-Type": "application/json", "X-Signature-SHA256": sig},
        )
        assert wh_res.status_code == 200
        assert wh_res.json()["data"]["status"] == "APPROVED"
