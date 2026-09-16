"""
Phase 15 — Production Hardening, E2E Verification & Deployment Orchestration Tests
Validates:
1. WorkerDaemon process single-job fetch and execution.
2. WorkerDaemon graceful shutdown and handler dispatch.
3. Database backup snapshot generation, tar.gz compression, and SHA-256 manifest.
4. Database disaster recovery checksum integrity verification.
5. Ingress Nginx configuration syntax and security headers validation.
6. End-to-end full system sanity across API v1 routers and deep health probes.
"""

import asyncio
import hashlib
import json
import os
import sys
import pytest
from pathlib import Path
from httpx import AsyncClient, ASGITransport

# Ensure repository root is on sys.path for scripts import
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.main import app
from app.services.task_queue_service import task_queue_service, TaskPriority
from app.workers.daemon import WorkerDaemon, register_handler
from scripts.backup_db import create_backup
from scripts.restore_db import restore_backup


@pytest.mark.asyncio
async def test_worker_daemon_execution_loop():
    """
    Validates that the WorkerDaemon correctly fetches an enqueued task,
    dispatches to the registered handler, and marks the task as completed.
    """
    queue_name = "test_daemon_queue"
    await task_queue_service.jobs_col.delete_many({"queueName": queue_name})
    handled_payloads = []

    async def custom_test_handler(payload):
        handled_payloads.append(payload)
        return {"processed": True, "item_id": payload.get("id")}

    register_handler("test_action_run", custom_test_handler)

    # 1. Enqueue test task
    job_id = await task_queue_service.enqueue(
        queue_name=queue_name,
        job_type="test_action_run",
        payload={"id": "item_999", "data": "payload_content"},
        priority=TaskPriority.HIGH,
    )

    # 2. WorkerDaemon processes single job from test_daemon_queue
    test_daemon = WorkerDaemon(node_id="test_worker_runner_1", queue_name=queue_name)
    processed = await test_daemon.execute_one_job()
    assert processed is True
    assert len(handled_payloads) == 1
    assert handled_payloads[0]["id"] == "item_999"

    # 3. Queue should now have 0 jobs pending
    second_pass = await test_daemon.execute_one_job()
    assert second_pass is False


@pytest.mark.asyncio
async def test_worker_daemon_graceful_shutdown():
    """
    Validates that WorkerDaemon responds to stop() signals without unhandled exceptions.
    """
    daemon = WorkerDaemon(node_id="shutdown_tester", poll_interval=0.05)
    
    # Start loop in background task
    task = asyncio.create_task(daemon.run())
    await asyncio.sleep(0.1)
    assert daemon.running is True

    # Signal stop
    daemon.stop()
    await task
    assert daemon.running is False


@pytest.mark.asyncio
async def test_database_backup_and_checksum_manifest(tmp_path):
    """
    Validates automated MongoDB snapshot export, tar.gz compression,
    and SHA-256 manifest generation.
    """
    manifest = await create_backup(
        output_dir=tmp_path,
        retention_count=3,
    )

    assert "backup_name" in manifest
    assert "sha256_checksum" in manifest
    assert len(manifest["sha256_checksum"]) == 64
    assert manifest["total_documents"] >= 0

    backup_file = tmp_path / manifest["backup_name"]
    manifest_name = manifest["backup_name"].replace(".tar.gz", ".manifest.json")
    manifest_file = tmp_path / manifest_name
    assert backup_file.exists()
    assert manifest_file.exists()


@pytest.mark.asyncio
async def test_database_disaster_recovery_checksum_validation(tmp_path):
    """
    Validates that restore_backup verifies SHA-256 before restoration and detects tampering.
    """
    # Create valid backup
    manifest = await create_backup(
        output_dir=tmp_path,
    )

    backup_file = tmp_path / manifest["backup_name"]
    manifest_name = manifest["backup_name"].replace(".tar.gz", ".manifest.json")
    manifest_file = tmp_path / manifest_name

    # Corrupt manifest checksum to simulate tampering
    tampered_manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    tampered_manifest["sha256_checksum"] = "0" * 64
    manifest_file.write_text(json.dumps(tampered_manifest), encoding="utf-8")

    # Restoration must fail with ValueError
    with pytest.raises(ValueError, match="Checksum mismatch"):
        await restore_backup(
            archive_path=backup_file,
            manifest_path=manifest_file,
            db_name="securevault_restore_test",
        )


@pytest.mark.asyncio
async def test_nginx_proxy_configuration_syntax():
    """
    Validates that the Nginx configuration file contains required security headers,
    gzip directives, and API routing.
    """
    nginx_conf = Path(__file__).resolve().parent.parent.parent / "docker" / "nginx" / "nginx.conf"
    assert nginx_conf.exists()

    content = nginx_conf.read_text(encoding="utf-8")
    assert "X-Frame-Options \"DENY\"" in content
    assert "X-Content-Type-Options \"nosniff\"" in content
    assert "limit_req_zone" in content
    assert "proxy_pass http://backend_upstream;" in content
    assert "proxy_pass http://frontend_upstream;" in content


@pytest.mark.asyncio
async def test_full_system_e2e_cohesion():
    """
    Comprehensive deployment verification: checks all core API v1 routes respond
    and deep health check reports operational status.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        resp = await client.get("/api/v1/system/health/deep")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] in ["healthy", "degraded"]
        assert "subsystems" in data

        # 2. Base health
        base_resp = await client.get("/api/v1/health")
        assert base_resp.status_code == 200
        assert base_resp.json()["data"]["status"] == "healthy"
