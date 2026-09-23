"""
Phase 19 Verification Test Suite:
Automated Disaster Recovery, Cross-Region Failover & Live Chaos Drills.

Validates:
1. Multi-region cluster replication topology and quorum calculations.
2. Network partition & split-brain risk detection.
3. Administrative and automated write-freeze safeguards.
4. End-to-end failover drill execution: write draining, snapshot validation, standby promotion, and failback.
5. Emergency drill abort and origin primary recovery.
6. Disaster recovery REST API endpoints (/api/v1/system/dr/*).
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.replication_health_service import (
    replication_health_service,
    ClusterSyncState,
    RegionRole,
)
from app.services.failover_drill_engine import failover_drill_engine, DrillStage


def test_replication_health_topology_reporting():
    """Verify cluster topology, replica nodes status, and consensus quorum."""
    topology = replication_health_service.get_cluster_topology()
    assert topology["cluster_state"] in [s.value for s in ClusterSyncState]
    assert topology["quorum_preserved"] is True
    assert topology["primary_region"] == "us-east-1"
    assert topology["standby_region"] == "eu-central-1"
    assert len(topology["nodes"]) == 3

    node_roles = [n["role"] for n in topology["nodes"]]
    assert RegionRole.PRIMARY_ACTIVE.value in node_roles
    assert RegionRole.SECONDARY_STANDBY.value in node_roles
    assert RegionRole.REPLICA_READONLY.value in node_roles


def test_split_brain_quorum_check():
    """Verify quorum detection under normal and network partitioned states."""
    # Majority active (3/3)
    healthy_eval = replication_health_service.check_split_brain_risk(active_node_count=3, total_nodes=3)
    assert healthy_eval["split_brain_risk"] is False
    assert healthy_eval["action_required"] == "NONE"

    # Degraded network partition (1/3 active)
    partition_eval = replication_health_service.check_split_brain_risk(active_node_count=1, total_nodes=3)
    assert partition_eval["split_brain_risk"] is True
    assert partition_eval["action_required"] == "ENFORCE_WRITE_FREEZE"


def test_write_freeze_mechanisms():
    """Verify toggling and querying write freeze state."""
    replication_health_service.release_write_freeze()
    assert replication_health_service.is_write_frozen() is False

    replication_health_service.enforce_write_freeze("Scheduled maintenance backup")
    assert replication_health_service.is_write_frozen() is True
    assert "Scheduled maintenance backup" in (replication_health_service._freeze_reason or "")

    replication_health_service.release_write_freeze()
    assert replication_health_service.is_write_frozen() is False
    assert replication_health_service._freeze_reason is None


@pytest.mark.asyncio
async def test_failover_drill_execution_lifecycle():
    """Verify end-to-end simulated regional failover drill."""
    drill_result = await failover_drill_engine.execute_drill(
        initiated_by="test_sec_officer",
        target_standby_region="eu-central-1",
        simulate_failback=True,
    )

    assert drill_result["status"] == "COMPLETED"
    assert drill_result["origin_region"] == "us-east-1"
    assert drill_result["promoted_region"] == "eu-central-1"
    assert drill_result["rto_seconds"] >= 0.0
    assert drill_result["rpo_seconds"] == 0.00
    assert drill_result["snapshot_verified"] is True

    # Check drill engine state and history
    status = failover_drill_engine.get_status()
    assert status["stage"] == DrillStage.IDLE.value
    assert status["history_count"] >= 1
    assert any(d["drill_id"] == drill_result["drill_id"] for d in status["history"])


def test_failover_drill_emergency_abort():
    """Verify emergency drill abort restores primary topology and write capability."""
    # Simulate active drill state
    failover_drill_engine._current_stage = DrillStage.DRAINING_WRITES
    failover_drill_engine._active_drill = {
        "drill_id": "drill_abort_test_999",
        "origin_region": "us-east-1",
        "promoted_region": "eu-central-1",
    }
    replication_health_service.enforce_write_freeze("Active drill draining")

    abort_report = failover_drill_engine.abort_active_drill(reason="Operator safety abort")
    assert abort_report["status"] == "ABORTED"
    assert abort_report["drill_id"] == "drill_abort_test_999"

    # Topology and write capability must be restored
    assert replication_health_service.is_write_frozen() is False
    assert replication_health_service._active_primary_region == "us-east-1"
    assert failover_drill_engine._current_stage == DrillStage.ABORTED


@pytest.mark.asyncio
async def test_dr_api_endpoints_integration():
    """Verify REST API endpoints for disaster recovery telemetry and drill controls."""
    from app.security.tokens import create_access_token
    token = create_access_token({"userId": "usr_dr_tester"})
    headers = {
        "Authorization": f"Bearer {token}",
        "X-User-Role": "SECURITY_OFFICER",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. GET /api/v1/system/dr/status
        status_resp = await client.get("/api/v1/system/dr/status")
        assert status_resp.status_code == 200
        data = status_resp.json()["data"]
        assert "topology" in data
        assert "drill" in data
        assert data["topology"]["quorum_preserved"] is True

        # 2. POST /api/v1/system/dr/freeze
        freeze_resp = await client.post(
            "/api/v1/system/dr/freeze",
            json={"frozen": True, "reason": "Test freeze"},
            headers=headers,
        )
        assert freeze_resp.status_code == 200
        assert freeze_resp.json()["data"]["write_frozen"] is True

        # Unfreeze
        unfreeze_resp = await client.post(
            "/api/v1/system/dr/freeze",
            json={"frozen": False},
            headers=headers,
        )
        assert unfreeze_resp.status_code == 200
        assert unfreeze_resp.json()["data"]["write_frozen"] is False

        # 3. POST /api/v1/system/dr/drill/start
        drill_resp = await client.post(
            "/api/v1/system/dr/drill/start",
            json={"target_standby_region": "eu-central-1", "simulate_failback": True},
            headers=headers,
        )
        assert drill_resp.status_code == 200
        drill_data = drill_resp.json()["data"]
        assert drill_data["status"] == "COMPLETED"
        assert drill_data["promoted_region"] == "eu-central-1"

        # 4. POST /api/v1/system/dr/drill/abort
        abort_resp = await client.post(
            "/api/v1/system/dr/drill/abort",
            headers=headers,
        )
        assert abort_resp.status_code == 200
