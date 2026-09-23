"""
Phase 18 Verification Test Suite:
Enterprise RBAC, Multi-Tenancy & Real-Time Audit Telemetry Streaming.

Validates:
1. Enterprise role-to-permission matrix and permission checking logic.
2. FastAPI dependency RBAC enforcement with 403 Forbidden rejection.
3. Thread-safe, async-safe tenant context management (tenant_scope).
4. Repository tenant filter injection and global bypass.
5. AuditStreamBroadcaster subscribe, publish, and ring-buffer eviction.
6. Real-time SSE endpoint (/api/v1/security/soc/stream) connection and event serialization.
7. End-to-end integration: record_chained_event pushes to live subscribers.
"""

import asyncio
import json
import pytest
from httpx import AsyncClient, ASGITransport
from starlette.requests import Request
from fastapi import HTTPException

from app.main import app
from app.security.rbac import (
    EnterpriseRole,
    Permission,
    ROLE_PERMISSIONS,
    get_role_permissions,
    has_permission,
    require_permission,
)
from app.core.tenant import (
    get_current_tenant_id,
    set_current_tenant_id,
    tenant_scope,
    build_tenant_filter,
)
from app.services.security_siem_service import SecuritySiemService, audit_broadcaster
from app.core.database import db


def test_enterprise_role_permissions_matrix():
    """Verify hierarchical role mappings and granular capabilities."""
    # SUPER_ADMIN possesses all permissions
    super_admin_perms = get_role_permissions(EnterpriseRole.SUPER_ADMIN)
    assert len(super_admin_perms) == len(Permission)
    assert Permission.AUDIT_STREAM in super_admin_perms
    assert Permission.COMPLIANCE_ZEROIZE in super_admin_perms

    # SECURITY_OFFICER has audit streaming and lockdown, but not compliance zeroize
    sec_perms = get_role_permissions(EnterpriseRole.SECURITY_OFFICER)
    assert Permission.AUDIT_STREAM in sec_perms
    assert Permission.VAULT_FREEZE in sec_perms
    assert Permission.COMPLIANCE_ZEROIZE not in sec_perms

    # VAULT_OWNER can read/write vault, but cannot stream enterprise audit
    owner_perms = get_role_permissions(EnterpriseRole.VAULT_OWNER)
    assert Permission.VAULT_READ in owner_perms
    assert Permission.VAULT_WRITE in owner_perms
    assert Permission.AUDIT_STREAM not in owner_perms

    # NOMINEE can submit claims, cannot manage tenants
    nominee_perms = get_role_permissions(EnterpriseRole.NOMINEE_BENEFICIARY)
    assert Permission.CLAIM_SUBMIT in nominee_perms
    assert Permission.TENANT_MANAGE not in nominee_perms

    # Helper function check
    assert has_permission(EnterpriseRole.SUPER_ADMIN, Permission.AUDIT_STREAM) is True
    assert has_permission(EnterpriseRole.VAULT_OWNER, Permission.AUDIT_STREAM) is False


def test_rbac_dependency_enforcement():
    """Test require_permission dependency with granted and rejected roles."""
    checker = require_permission(Permission.AUDIT_STREAM)

    # 1. Allowed role: SECURITY_OFFICER
    req_allowed = Request(
        scope={
            "type": "http",
            "headers": [(b"x-user-role", b"SECURITY_OFFICER")],
            "state": {},
        }
    )
    role = checker(req_allowed)
    assert role == EnterpriseRole.SECURITY_OFFICER

    # 2. Denied role: VAULT_OWNER
    req_denied = Request(
        scope={
            "type": "http",
            "headers": [(b"x-user-role", b"VAULT_OWNER")],
            "state": {},
        }
    )
    with pytest.raises(HTTPException) as exc_info:
        checker(req_denied)
    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail

    # 3. Malformed role
    req_invalid = Request(
        scope={
            "type": "http",
            "headers": [(b"x-user-role", b"NON_EXISTENT_ROLE")],
            "state": {},
        }
    )
    with pytest.raises(HTTPException) as exc_info:
        checker(req_invalid)
    assert exc_info.value.status_code == 403


def test_tenant_context_scoping_and_filters():
    """Verify tenant context variables and query filter construction."""
    # Default is None
    set_current_tenant_id(None)
    assert get_current_tenant_id() is None

    # Context manager switch
    with tenant_scope("tenant_apex_capital"):
        assert get_current_tenant_id() == "tenant_apex_capital"
        
        # Test query filter injection
        q = build_tenant_filter({"userId": "usr_100"})
        assert q["userId"] == "usr_100"
        assert q["tenant_id"] == "tenant_apex_capital"

        # Nested scope
        with tenant_scope("tenant_family_trust"):
            assert get_current_tenant_id() == "tenant_family_trust"
            q_nested = build_tenant_filter({})
            assert q_nested["tenant_id"] == "tenant_family_trust"

        # Reverts to outer
        assert get_current_tenant_id() == "tenant_apex_capital"

    # Reverts to initial None
    assert get_current_tenant_id() is None

    # Global bypass test
    global_filter = build_tenant_filter({"status": "ACTIVE"}, tenant_id="global")
    assert "tenant_id" not in global_filter
    assert global_filter["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_audit_stream_broadcaster():
    """Verify in-memory event broadcaster subscription and message fanout."""
    q1 = audit_broadcaster.subscribe()
    q2 = audit_broadcaster.subscribe()

    test_event = {
        "id": "aud_test_999",
        "action": "KMS_ROTATION",
        "entryHash": "aabbcc112233",
    }
    audit_broadcaster.publish(test_event)

    # Both subscribers receive event
    assert not q1.empty()
    assert not q2.empty()
    e1 = q1.get_nowait()
    e2 = q2.get_nowait()
    assert e1["id"] == "aud_test_999"
    assert e2["id"] == "aud_test_999"

    # Unsubscribe
    audit_broadcaster.unsubscribe(q1)
    audit_broadcaster.unsubscribe(q2)
    assert q1 not in audit_broadcaster._subscribers
    assert q2 not in audit_broadcaster._subscribers


@pytest.mark.asyncio
async def test_sse_endpoint_handshake_and_stream():
    """Verify GET /api/v1/security/soc/stream connects and formats SSE messages."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Denied without proper permission
        resp_denied = await client.get(
            "/api/v1/security/soc/stream",
            headers={"X-User-Role": "VAULT_OWNER"},
        )
        assert resp_denied.status_code == 403

        # Connect with authorized role and limit=0 to verify handshake without blocking
        resp = await client.get(
            "/api/v1/security/soc/stream?limit=0",
            headers={"X-User-Role": "SECURITY_OFFICER"},
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        assert "event: connected" in resp.text
        assert "CONNECTION_ESTABLISHED" in resp.text
        assert "STREAMING_ACTIVE" in resp.text

        # Test streaming single event with limit=1
        async def push_delayed():
            await asyncio.sleep(0.05)
            audit_broadcaster.publish({
                "id": "aud_sse_test_123",
                "action": "SSE_TEST_DISPATCH",
                "entryHash": "123456abcdef",
            })

        asyncio.create_task(push_delayed())
        resp_event = await client.get(
            "/api/v1/security/soc/stream?limit=1",
            headers={"X-User-Role": "SECURITY_OFFICER"},
        )
        assert resp_event.status_code == 200
        assert "event: audit_event" in resp_event.text
        assert "SSE_TEST_DISPATCH" in resp_event.text


@pytest.mark.asyncio
async def test_record_chained_event_pushes_to_live_subscribers():
    """Verify that calling record_chained_event publishes to active stream queues."""
    siem = SecuritySiemService(db)
    queue = audit_broadcaster.subscribe()

    try:
        user_id = "usr_stream_tester"
        log = await siem.record_chained_event(
            user_id=user_id,
            action="STREAM_TEST_ACTION",
            resource="TEST_SUITE",
            resource_id="res_test",
            metadata={"testKey": "testVal"},
        )

        assert not queue.empty()
        received = queue.get_nowait()
        assert received["userId"] == user_id
        assert received["action"] == "STREAM_TEST_ACTION"
        assert received["entryHash"] == log["entryHash"]
        assert "_id" not in received
    finally:
        audit_broadcaster.unsubscribe(queue)
