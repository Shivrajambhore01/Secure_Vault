from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.task_queue_service import (
    task_queue_service,
    distributed_lock_service,
    health_monitor_service,
    TaskStatus,
    TaskPriority,
)

router = APIRouter(prefix="/system", tags=["v1 - System Operations & Workers"])


from pydantic import BaseModel, Field, field_validator


class EnqueueJobRequest(BaseModel):
    queue_name: str = Field(..., description="Target queue (e.g. notifications, claims, notary, archival)")
    job_type: str = Field(..., description="Action to run (e.g. claim_verification_check, send_escalation_sms)")
    payload: dict = Field(default_factory=dict, description="Job parameters")
    priority: TaskPriority = Field(default=TaskPriority.NORMAL)
    max_retries: int = Field(default=3, ge=1, le=10)

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, v):
        if isinstance(v, str):
            val = v.upper()
            if hasattr(TaskPriority, val):
                return getattr(TaskPriority, val)
        return v


@router.get("/health/deep")
async def deep_health_check():
    """
    Deep multi-subsystem probe measuring real-time latency, storage health,
    task queue lag, distributed worker locks, and external integrations.
    """
    telemetry = await health_monitor_service.perform_deep_health_check()
    return success_response(data=telemetry, meta={"message": "Deep system telemetry captured successfully."})


@router.get("/workers/status")
async def get_worker_status(request: Request):
    """
    Returns active distributed worker leases, node IDs, and queue metrics.
    """
    _ = require_authenticated_user(request)
    locks = await distributed_lock_service.get_active_locks()
    telemetry = await health_monitor_service.perform_deep_health_check()
    
    return success_response(
        data={
            "active_locks": locks,
            "lock_count": len(locks),
            "queue_metrics": telemetry.get("task_queue", {}),
            "timestamp": telemetry.get("timestamp"),
        },
        meta={"message": "Distributed worker leases and queue metrics fetched."},
    )


@router.get("/jobs")
async def list_jobs(
    request: Request,
    status: Optional[str] = Query(None, description="Filter by TaskStatus: pending, running, completed, failed, dead_letter"),
    queue_name: Optional[str] = Query(None, description="Filter by queue name"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    """
    List durable task queue items, inspect pending jobs, running leases, or Dead Letter Queue (DLQ).
    """
    _ = require_authenticated_user(request)
    target_status = None
    if status:
        try:
            target_status = TaskStatus(status.lower())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter. Allowed: {[s.value for s in TaskStatus]}"
            )

    jobs = await task_queue_service.list_jobs(
        status=target_status,
        queue_name=queue_name,
        limit=limit,
        skip=skip
    )
    return success_response(data={"jobs": jobs, "count": len(jobs)}, meta={"message": "Queue jobs retrieved."})


@router.post("/jobs/enqueue")
async def enqueue_job(
    request: Request,
    request_data: EnqueueJobRequest,
):
    """
    Manually enqueue a durable background task for distributed execution.
    """
    _ = require_authenticated_user(request)
    job_id = await task_queue_service.enqueue(
        queue_name=request_data.queue_name,
        job_type=request_data.job_type,
        payload=request_data.payload,
        priority=request_data.priority,
        max_retries=request_data.max_retries,
    )
    return success_response(
        data={"job_id": job_id, "queue_name": request_data.queue_name, "status": TaskStatus.PENDING.value},
        meta={"message": f"Job {job_id} successfully enqueued to '{request_data.queue_name}'."}
    )


@router.post("/jobs/{job_id}/retry")
async def retry_dead_letter_job(
    request: Request,
    job_id: str,
):
    """
    Replay / resurrect a job from the Dead Letter Queue (DLQ) back into pending with reset retries.
    """
    _ = require_authenticated_user(request)
    success = await task_queue_service.replay_dead_letter_job(job_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} was not found or is not in DEAD_LETTER status."
        )
    return success_response(data={"job_id": job_id, "replayed": True}, meta={"message": f"Job {job_id} replayed successfully."})


@router.post("/trigger/{job_type}")
async def trigger_system_sweep(
    request: Request,
    job_type: str,
):
    """
    Trigger an immediate maintenance sweep by enqueuing a high-priority job to the system queue.
    Supported types: inactivity_sweep, claim_verification_check, dlq_cleanup, log_archival.
    """
    user_id = require_authenticated_user(request)
    allowed_types = ["inactivity_sweep", "claim_verification_check", "dlq_cleanup", "log_archival", "notary_heartbeat"]
    if job_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown system sweep type. Allowed: {allowed_types}"
        )

    job_id = await task_queue_service.enqueue(
        queue_name="system_maintenance",
        job_type=job_type,
        payload={"triggered_by": user_id},
        priority=TaskPriority.HIGH,
        max_retries=3,
    )

    return success_response(
        data={"job_id": job_id, "job_type": job_type, "queue": "system_maintenance"},
        meta={"message": f"System sweep '{job_type}' queued successfully."}
    )


# Mount Disaster Recovery sub-router
from app.api.v1.system.dr_router import router as dr_router
router.include_router(dr_router)

