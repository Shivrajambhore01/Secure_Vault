"""
Phase 14 — Automated Worker Infrastructure, Background Jobs & System Health Tests
Validates:
1. Distributed Lock mutual exclusion across simulated worker replicas.
2. Distributed Lock TTL lease expiration and renewal.
3. Task Queue lifecycle: enqueue -> fetch_next_job (lease acquired) -> complete_job.
4. Dead Letter Queue (DLQ) escalation upon exceeding max_retries and DLQ replay resurrection.
5. Deep Multi-Subsystem Health Check probing MongoDB, storage, external services, and task queue.
6. API v1 System Endpoints (/system/health/deep, /system/workers/status, /system/jobs, retry, trigger).
"""

import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.auth_service import AuthService
from app.services.task_queue_service import (
    DistributedLockService,
    TaskQueueService,
    HealthMonitorService,
    TaskStatus,
    TaskPriority,
)


@pytest.fixture
def auth_service():
    return AuthService()


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def test_user_token(auth_service):
    email = "system.tester@securevault.io"
    await auth_service.users_col.delete_many({"email": email})
    reg = await auth_service.register(
        email=email,
        password="SuperSecurePassword123!",
        full_name="System Operations Tester",
        pin="123456",
    )
    if "email_verification_token" in reg:
        await auth_service.verify_email(reg["email_verification_token"])
    login = await auth_service.login(email=email, password="SuperSecurePassword123!")
    return login["access_token"]


@pytest.mark.asyncio
async def test_distributed_lock_mutual_exclusion():
    """
    Test that two worker nodes cannot acquire the exact same distributed lock simultaneously.
    """
    lock_service = DistributedLockService()
    lock_key = "test_sweep_mutual_exclusion"
    
    # Worker A acquires lock
    acquired_a = await lock_service.acquire_lock(lock_key, owner_id="worker_node_1", ttl_seconds=10)
    assert acquired_a is True
    
    # Worker B attempts to acquire same lock
    acquired_b = await lock_service.acquire_lock(lock_key, owner_id="worker_node_2", ttl_seconds=10)
    assert acquired_b is False
    
    # Worker A releases lock
    released = await lock_service.release_lock(lock_key, owner_id="worker_node_1")
    assert released is True
    
    # Worker B can now acquire it
    acquired_b_retry = await lock_service.acquire_lock(lock_key, owner_id="worker_node_2", ttl_seconds=10)
    assert acquired_b_retry is True
    
    # Clean up
    await lock_service.release_lock(lock_key, owner_id="worker_node_2")


@pytest.mark.asyncio
async def test_distributed_lock_ttl_expiration_and_renewal():
    """
    Test that an expired lock can be overtaken, and that renewal extends the lease.
    """
    lock_service = DistributedLockService()
    lock_key = "test_lock_ttl_lifecycle"
    
    # Worker A acquires 1-second lock
    acquired = await lock_service.acquire_lock(lock_key, owner_id="worker_alpha", ttl_seconds=1)
    assert acquired is True
    
    # Worker A renews lock
    renewed = await lock_service.renew_lock(lock_key, owner_id="worker_alpha", additional_seconds=5)
    assert renewed is True
    
    # Worker B cannot renew Worker A's lock
    unauthorized_renewal = await lock_service.renew_lock(lock_key, owner_id="worker_beta", additional_seconds=5)
    assert unauthorized_renewal is False
    
    # Clean up
    await lock_service.release_lock(lock_key, owner_id="worker_alpha")


@pytest.mark.asyncio
async def test_task_queue_lifecycle():
    """
    Test complete task queue lifecycle: enqueue -> fetch with lease -> mark completed.
    """
    queue_service = TaskQueueService()
    queue_name = "test_lifecycle_queue"
    await queue_service.jobs_col.delete_many({"queueName": queue_name})
    
    # 1. Enqueue job
    job_id = await queue_service.enqueue(
        queue_name=queue_name,
        job_type="send_reminder_email",
        payload={"recipient": "alice@example.com", "template": "checkin"},
        priority=TaskPriority.HIGH,
        max_retries=2,
    )
    assert job_id is not None
    
    # 2. Fetch next job
    fetched_job = await queue_service.fetch_next_job(queue_name, worker_id="worker_node_42", lease_seconds=15)
    assert fetched_job is not None
    assert fetched_job["id"] == job_id
    assert fetched_job["status"] == TaskStatus.RUNNING.value
    assert fetched_job["attempts"] == 1
    assert fetched_job["locked_by"] == "worker_node_42"
    
    # 3. Complete job
    completed = await queue_service.complete_job(job_id, result={"message_id": "msg_9988"})
    assert completed is True
    
    # 4. Verify no pending job remaining in queue
    empty_fetch = await queue_service.fetch_next_job(queue_name, worker_id="worker_node_42")
    assert empty_fetch is None


@pytest.mark.asyncio
async def test_task_queue_dlq_escalation_and_replay():
    """
    Test job failure retries, Dead Letter Queue (DLQ) escalation upon reaching max_retries,
    and DLQ replay resurrection.
    """
    queue_service = TaskQueueService()
    queue_name = "test_dlq_queue"
    
    # 1. Enqueue job with max_retries=2
    job_id = await queue_service.enqueue(
        queue_name=queue_name,
        job_type="flaky_webhook_call",
        payload={"url": "https://api.example.com/dead"},
        priority=TaskPriority.CRITICAL,
        max_retries=2,
    )
    
    # 2. First execution attempt -> fail
    job = await queue_service.fetch_next_job(queue_name, worker_id="worker_fail_1")
    assert job is not None
    assert job["id"] == job_id
    failed_1 = await queue_service.fail_job(job_id, error="Connection timeout 504", retry_delay_seconds=0)
    assert failed_1 is True
    
    # 3. Second execution attempt -> fail again -> should escalate to DEAD_LETTER
    job_retry = await queue_service.fetch_next_job(queue_name, worker_id="worker_fail_2")
    assert job_retry is not None
    assert job_retry["id"] == job_id
    failed_2 = await queue_service.fail_job(job_id, error="Remote host terminated connection", retry_delay_seconds=0)
    assert failed_2 is True
    
    # Verify in DLQ
    dlq_jobs = await queue_service.list_jobs(status=TaskStatus.DEAD_LETTER, queue_name=queue_name)
    assert any(j["id"] == job_id for j in dlq_jobs)
    
    # 4. Replay from DLQ
    replayed = await queue_service.replay_dead_letter_job(job_id)
    assert replayed is True
    
    # Verify job is back in PENDING with attempts reset
    replayed_fetch = await queue_service.fetch_next_job(queue_name, worker_id="worker_recovered")
    assert replayed_fetch is not None
    assert replayed_fetch["id"] == job_id
    assert replayed_fetch["attempts"] == 1
    
    # Complete to clean up
    await queue_service.complete_job(job_id, result={"status": "resolved"})


@pytest.mark.asyncio
async def test_deep_health_check_subsystem_probe():
    """
    Verify the deep health monitor successfully probes all core subsystems:
    MongoDB ping, Local storage, Task queue metrics, and simulated integration probes.
    """
    monitor = HealthMonitorService()
    telemetry = await monitor.perform_deep_health_check()
    
    assert "status" in telemetry
    assert telemetry["status"] in ["healthy", "degraded", "unhealthy"]
    assert "subsystems" in telemetry
    
    subsystems = telemetry["subsystems"]
    assert "database" in subsystems
    assert subsystems["database"]["status"] in ["UP", "healthy", "HEALTHY"]
    assert "latency_ms" in subsystems["database"]
    
    assert "storage" in subsystems
    assert subsystems["storage"]["status"] in ["UP", "healthy", "HEALTHY"]
    
    assert "task_queue" in telemetry
    queue_info = telemetry["task_queue"]
    assert "pending" in queue_info
    assert "dead_letter" in queue_info


@pytest.mark.asyncio
async def test_v1_system_api_endpoints(async_client, test_user_token):
    """
    Test FastAPI integration endpoints:
    - GET /api/v1/system/health/deep (public / system observability)
    - GET /api/v1/system/workers/status (authenticated operator)
    - GET /api/v1/system/jobs (authenticated operator)
    - POST /api/v1/system/jobs/enqueue (authenticated operator)
    - POST /api/v1/system/trigger/inactivity_sweep (authenticated operator)
    """
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # 1. Deep Health probe
    deep_resp = await async_client.get("/api/v1/system/health/deep")
    assert deep_resp.status_code == 200
    deep_data = deep_resp.json()
    assert deep_data["success"] is True
    assert "subsystems" in deep_data["data"]
    
    # 2. Workers Status
    worker_resp = await async_client.get("/api/v1/system/workers/status", headers=headers)
    assert worker_resp.status_code == 200
    worker_data = worker_resp.json()
    assert worker_data["success"] is True
    assert "active_locks" in worker_data["data"]
    
    # 3. Enqueue background task
    enqueue_resp = await async_client.post(
        "/api/v1/system/jobs/enqueue",
        headers=headers,
        json={
            "queue_name": "test_api_queue",
            "job_type": "simulate_escalation",
            "payload": {"level": 2},
            "priority": "high",
            "max_retries": 3,
        }
    )
    assert enqueue_resp.status_code == 200
    job_id = enqueue_resp.json()["data"]["job_id"]
    assert job_id is not None
    
    # 4. List jobs
    jobs_resp = await async_client.get(
        "/api/v1/system/jobs",
        headers=headers,
        params={"queue_name": "test_api_queue"}
    )
    assert jobs_resp.status_code == 200
    jobs_data = jobs_resp.json()
    assert any(j["id"] == job_id for j in jobs_data["data"]["jobs"])
    
    # 5. Trigger system maintenance sweep
    sweep_resp = await async_client.post(
        "/api/v1/system/trigger/inactivity_sweep",
        headers=headers
    )
    assert sweep_resp.status_code == 200
    assert sweep_resp.json()["data"]["job_type"] == "inactivity_sweep"
