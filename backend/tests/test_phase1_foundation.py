"""
Phase 01 Foundation Architecture Tests — SecureVault Enterprise
Validates API envelope, exception handling, request ID injection,
layered repository/service calls, and v1 routes.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.infrastructure.response import success_response, error_response
from app.domain.exceptions import NotFoundError, UnauthorizedError, ValidationError
from app.security.hashing import hash_secret, verify_secret
from app.domain.value_objects import VaultState, AssetCategory, RiskLevel


@pytest.mark.asyncio
async def test_standard_response_envelope():
    # Test success envelope
    resp = success_response(data={"item": "vault_key"}, meta={"total": 1})
    import json
    data = json.loads(resp.body.decode())
    assert data["success"] is True
    assert data["data"] == {"item": "vault_key"}
    assert "request_id" in data
    assert data["meta"] == {"total": 1}

    # Test error envelope
    err_resp = error_response(code="RESOURCE_NOT_FOUND", message="Item missing", status_code=404)
    err_data = json.loads(err_resp.body.decode())
    assert err_data["success"] is False
    assert err_data["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert err_data["error"]["message"] == "Item missing"
    assert "request_id" in err_data


@pytest.mark.asyncio
async def test_v1_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/health")
        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["data"]["status"] == "healthy"
        assert body["data"]["version"] == "v1"
        assert "request_id" in body
        assert "X-Request-ID" in res.headers
        assert "X-Response-Time" in res.headers


@pytest.mark.asyncio
async def test_exception_handler_standard_envelope():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Intentionally hit non-existent endpoint
        res = await ac.get("/api/v1/non-existent-route")
        assert res.status_code == 404
        body = res.json()
        assert body["success"] is False
        assert body["error"]["code"] == "NOT_FOUND"
        assert "request_id" in body


def test_hashing_security():
    secret = "SuperSecretPIN@123"
    hashed = hash_secret(secret)
    assert hashed != secret
    assert verify_secret(secret, hashed) is True
    assert verify_secret("WrongSecret", hashed) is False


def test_domain_value_objects():
    assert VaultState.ACTIVE.value == "ACTIVE"
    assert AssetCategory.DOCUMENTS.value == "DOCUMENTS"
    assert RiskLevel.CRITICAL.value == "CRITICAL"
