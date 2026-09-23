"""
Disaster Recovery & Regional Failover API Router — Phase 19.
Exposes cluster topology telemetry, split-brain monitoring, and drill execution controls.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException, status
from pydantic import BaseModel, Field

from app.infrastructure.response import success_response
from app.security.permissions import require_authenticated_user
from app.services.replication_health_service import replication_health_service
from app.services.failover_drill_engine import failover_drill_engine

router = APIRouter(prefix="/dr", tags=["v1 - Disaster Recovery & High Availability"])


class StartDrillRequest(BaseModel):
    target_standby_region: str = Field(default="eu-central-1", description="Target region to promote")
    simulate_failback: bool = Field(default=True, description="Automatically restore origin primary after verification")


class ToggleFreezeRequest(BaseModel):
    frozen: bool
    reason: Optional[str] = "Manual administrative freeze via DR console"


@router.get("/status")
async def get_disaster_recovery_status():
    """
    Real-time disaster recovery telemetry: multi-region cluster health,
    replication lag, quorum state, active primary, and drill execution status.
    """
    topology = replication_health_service.get_cluster_topology()
    drill_status = failover_drill_engine.get_status()

    return success_response(
        data={
            "topology": topology,
            "drill": drill_status,
        },
        meta={"message": "Disaster recovery telemetry fetched successfully."}
    )


@router.post("/drill/start")
async def start_failover_drill(
    request: Request,
    body: StartDrillRequest = StartDrillRequest(),
):
    """
    Initiate a controlled, zero-data-loss regional failover simulation drill.
    Transitions through write draining, snapshot validation, replica promotion, and failback.
    """
    user_id = require_authenticated_user(request)
    result = await failover_drill_engine.execute_drill(
        initiated_by=user_id,
        target_standby_region=body.target_standby_region,
        simulate_failback=body.simulate_failback,
    )

    return success_response(
        data=result,
        meta={"message": f"Failover drill {result['drill_id']} completed successfully."}
    )


@router.post("/drill/abort")
async def abort_failover_drill(request: Request):
    """
    Emergency abort running failover drill and restore primary write capability immediately.
    """
    _ = require_authenticated_user(request)
    result = failover_drill_engine.abort_active_drill(reason="Operator emergency abort requested")
    return success_response(data=result, meta={"message": "Drill abort command executed."})


@router.post("/freeze")
async def toggle_write_freeze(
    body: ToggleFreezeRequest,
    request: Request,
):
    """
    Manually toggle platform write freeze to prevent split-brain drift during maintenance.
    """
    _ = require_authenticated_user(request)
    if body.frozen:
        replication_health_service.enforce_write_freeze(reason=body.reason or "Manual write freeze")
    else:
        replication_health_service.release_write_freeze()

    return success_response(
        data={
            "write_frozen": replication_health_service.is_write_frozen(),
            "reason": replication_health_service._freeze_reason,
        },
        meta={"message": "Write freeze state updated."}
    )
