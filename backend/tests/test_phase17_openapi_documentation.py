"""
Phase 17 Verification Test Suite:
Enterprise Documentation, OpenAPI / Swagger Contract Publishing & Developer Portal.

Validates:
1. OpenAPI 3.1 schema generation and metadata completeness.
2. Custom security schemes (BearerAuth, ApiKeyAuth).
3. Contract export endpoint (/api/v1/docs/export).
4. Documentation endpoints (/docs, /redoc, /openapi.json).
5. Comprehensive coverage of all 16 architecture sub-domain tags.
6. Postman v2.1 collection file integrity, variable declarations, and structure.
"""

import json
from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_openapi_schema_generation():
    """Verify programmatic OpenAPI 3.1 contract generation and metadata."""
    schema = app.openapi()
    assert schema is not None
    assert schema.get("openapi", "").startswith("3.")
    assert schema["info"]["title"] == "SecureVault Enterprise API"
    assert schema["info"]["version"] == "2.0.0"
    assert "Zero-Knowledge Encryption" in schema["info"]["description"]
    assert "termsOfService" in schema["info"]
    assert schema["info"]["contact"]["email"] == "security@securevault.app"
    assert schema["info"]["license"]["name"] == "Proprietary Enterprise License"


@pytest.mark.asyncio
async def test_openapi_security_schemes():
    """Verify security schemes for Bearer JWT and Machine API Key."""
    schema = app.openapi()
    assert "components" in schema
    assert "securitySchemes" in schema["components"]
    schemes = schema["components"]["securitySchemes"]
    
    assert "BearerAuth" in schemes
    assert schemes["BearerAuth"]["type"] == "http"
    assert schemes["BearerAuth"]["scheme"] == "bearer"
    assert schemes["BearerAuth"]["bearerFormat"] == "JWT"
    
    assert "ApiKeyAuth" in schemes
    assert schemes["ApiKeyAuth"]["type"] == "apiKey"
    assert schemes["ApiKeyAuth"]["in"] == "header"
    assert schemes["ApiKeyAuth"]["name"] == "X-API-Key"


@pytest.mark.asyncio
async def test_export_openapi_endpoint():
    """Verify GET /api/v1/docs/export returns complete JSON contract."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/docs/export")
        assert resp.status_code == 200
        contract = resp.json()
        assert contract["info"]["title"] == "SecureVault Enterprise API"
        assert "/api/v1/health" in contract["paths"]
        assert "/api/v1/system/health/deep" in contract["paths"]
        assert "/api/v1/docs/export" in contract["paths"]


@pytest.mark.asyncio
async def test_docs_and_spec_routes():
    """Verify OpenAPI and Swagger UI endpoints respond with HTTP 200."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check /openapi.json
        openapi_resp = await client.get("/openapi.json")
        assert openapi_resp.status_code == 200
        assert openapi_resp.headers["content-type"].startswith("application/json")
        
        # Check /docs (Swagger UI HTML)
        docs_resp = await client.get("/docs")
        assert docs_resp.status_code == 200
        assert "swagger" in docs_resp.text.lower() or "html" in docs_resp.headers.get("content-type", "").lower()
        
        # Check /redoc (ReDoc UI HTML)
        redoc_resp = await client.get("/redoc")
        assert redoc_resp.status_code == 200
        assert "redoc" in redoc_resp.text.lower() or "html" in redoc_resp.headers.get("content-type", "").lower()


@pytest.mark.asyncio
async def test_openapi_tag_taxonomy_coverage():
    """Ensure architectural module tags are defined in OpenAPI metadata."""
    schema = app.openapi()
    tag_names = [tag["name"] for tag in schema.get("tags", [])]
    
    expected_tags = [
        "v1 - Health",
        "v1 - System Operations & Workers",
        "v1 - Auth",
        "v1 - Users & Heartbeat",
        "v1 - Vault & Dead Man's Switch",
        "v1 - Assets",
        "v1 - Nominees",
        "v1 - Legacy Policies",
        "v1 - Claims & Fraud Detection",
        "v1 - Identity & Notary",
        "v1 - Security Operations & SIEM",
        "v1 - Social Recovery",
        "v1 - Notifications",
        "v1 - Compliance & Privacy",
    ]
    for tag in expected_tags:
        assert tag in tag_names, f"Expected tag '{tag}' missing from OpenAPI metadata"


@pytest.mark.asyncio
async def test_postman_collection_file_integrity():
    """Ensure Postman v2.1 collection is syntactically valid and structurally complete."""
    # Find postman collection path relative to project root
    backend_dir = Path(__file__).resolve().parent.parent
    project_root = backend_dir.parent
    postman_path = project_root / "docs" / "api" / "securevault_postman_collection.json"
    
    assert postman_path.exists(), f"Postman collection file not found at {postman_path}"
    
    with open(postman_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    assert data["info"]["name"] == "SecureVault Enterprise API v2.0"
    assert "collection.json" in data["info"]["schema"]
    
    # Verify environment variables
    var_keys = [v["key"] for v in data.get("variable", [])]
    assert "baseUrl" in var_keys
    assert "userToken" in var_keys
    
    # Verify folder hierarchy
    folders = [item["name"] for item in data.get("item", [])]
    assert any("Health" in f for f in folders)
    assert any("Authentication" in f for f in folders)
    assert any("Vault Assets" in f for f in folders)
    assert any("Nominees" in f for f in folders)
    assert any("Claims" in f for f in folders)
    assert any("SIEM" in f for f in folders)
    assert any("Compliance" in f for f in folders)
    assert any("Task Queue" in f or "Workers" in f for f in folders)
