"""
Health & Monitoring Endpoints — SecureVault Enterprise

Provides standardized health check and system metrics endpoints.
These endpoints are designed for:
  - Load balancer health probes
  - Uptime monitoring (UptimeRobot, Pingdom, AWS Route53)
  - Internal dashboards and alerting (Grafana, Datadog)

Endpoints:
  GET /health         — Simple liveness probe (always 200 if server is up)
  GET /health/ready   — Readiness probe (checks DB connectivity)
  GET /health/metrics — Application metrics (CPU, memory, DB latency)
"""

import time
import platform
import psutil
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from app.core.database import db

router = APIRouter()

_START_TIME = time.time()
_VERSION = "2.0.0"


@router.get("/health", tags=["Monitoring"])
async def liveness():
    """
    Liveness probe — confirms the application process is alive.
    Used by Docker, Kubernetes, and load balancers.
    Always returns 200 if the server is running.
    """
    return {
        "status": "alive",
        "version": _VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - _START_TIME),
    }


@router.get("/health/ready", tags=["Monitoring"])
async def readiness():
    """
    Readiness probe — verifies that all critical dependencies are reachable.
    Returns 503 if the database connection fails.
    """
    checks = {}

    # Check MongoDB connectivity
    db_start = time.monotonic()
    try:
        await db.command("ping")
        checks["mongodb"] = {
            "status": "ok",
            "latency_ms": round((time.monotonic() - db_start) * 1000, 2),
        }
    except Exception as exc:
        checks["mongodb"] = {"status": "error", "error": str(exc)}

    overall_ok = all(v.get("status") == "ok" for v in checks.values())

    if not overall_ok:
        raise HTTPException(
            status_code=503,
            detail={"status": "not_ready", "checks": checks},
        )

    return {
        "status": "ready",
        "version": _VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }


@router.get("/health/metrics", tags=["Monitoring"])
async def metrics():
    """
    Application metrics endpoint.
    Returns CPU, memory, disk, and database collection counts.
    In production, expose this only to internal/admin networks.
    """
    # System metrics
    cpu_percent = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    # MongoDB collection counts
    db_stats = {}
    for col_name in [
        "users", "nominees", "assets",
        "verification_requests", "verification_documents",
        "audit_logs", "notification_logs",
    ]:
        try:
            db_stats[col_name] = await db[col_name].count_documents({})
        except Exception:
            db_stats[col_name] = -1

    return {
        "status": "ok",
        "version": _VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - _START_TIME),
        "system": {
            "platform": platform.system(),
            "python_version": platform.python_version(),
            "cpu_percent": cpu_percent,
            "memory": {
                "total_mb": round(mem.total / 1024 / 1024),
                "used_mb": round(mem.used / 1024 / 1024),
                "percent": mem.percent,
            },
            "disk": {
                "total_gb": round(disk.total / 1024 / 1024 / 1024, 1),
                "used_gb": round(disk.used / 1024 / 1024 / 1024, 1),
                "percent": disk.percent,
            },
        },
        "database": {
            "collection_counts": db_stats,
        },
    }
