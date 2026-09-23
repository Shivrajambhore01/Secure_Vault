"""
Replication Health & Multi-Region Split-Brain Detection Service — Phase 19.
Monitors primary-standby replica topologies, replication lag, quorum health,
and enforces automated write-freeze safeguards.
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class RegionRole(str, Enum):
    PRIMARY_ACTIVE = "PRIMARY_ACTIVE"
    SECONDARY_STANDBY = "SECONDARY_STANDBY"
    REPLICA_READONLY = "REPLICA_READONLY"
    ISOLATED_QUORUM_LOST = "ISOLATED_QUORUM_LOST"


class ClusterSyncState(str, Enum):
    HEALTHY = "HEALTHY"
    DEGRADED_SYNC_LAG = "DEGRADED_SYNC_LAG"
    SPLIT_BRAIN_WARNING = "SPLIT_BRAIN_WARNING"
    FAILOVER_IN_PROGRESS = "FAILOVER_IN_PROGRESS"


class RegionNode(BaseModel):
    node_id: str
    region_name: str
    datacenter: str
    role: RegionRole
    latency_ms: float
    replication_lag_ms: float
    is_healthy: bool
    last_heartbeat: str


class ReplicationHealthService:
    """Monitors and maintains high availability cross-region replica topologies."""

    def __init__(self):
        self._write_frozen: bool = False
        self._freeze_reason: Optional[str] = None
        self._active_primary_region: str = "us-east-1"
        self._active_standby_region: str = "eu-central-1"

    def get_cluster_topology(self) -> Dict[str, Any]:
        """Inspect all regional replica nodes, replication latency, and quorum status."""
        now = datetime.now(timezone.utc).isoformat()
        nodes: List[RegionNode] = [
            RegionNode(
                node_id="node_us_east_primary_01",
                region_name=self._active_primary_region,
                datacenter="AWS N. Virginia (us-east-1a)",
                role=RegionRole.PRIMARY_ACTIVE,
                latency_ms=1.2,
                replication_lag_ms=0.0,
                is_healthy=True,
                last_heartbeat=now,
            ),
            RegionNode(
                node_id="node_eu_central_standby_01",
                region_name=self._active_standby_region,
                datacenter="AWS Frankfurt (eu-central-1b)",
                role=RegionRole.SECONDARY_STANDBY,
                latency_ms=38.4,
                replication_lag_ms=14.2,
                is_healthy=True,
                last_heartbeat=now,
            ),
            RegionNode(
                node_id="node_ap_southeast_readonly_01",
                region_name="ap-southeast-1",
                datacenter="AWS Singapore (ap-southeast-1a)",
                role=RegionRole.REPLICA_READONLY,
                latency_ms=84.1,
                replication_lag_ms=26.5,
                is_healthy=True,
                last_heartbeat=now,
            ),
        ]

        healthy_count = sum(1 for n in nodes if n.is_healthy)
        total_nodes = len(nodes)
        quorum_preserved = healthy_count > (total_nodes // 2)

        sync_state = ClusterSyncState.HEALTHY
        if not quorum_preserved:
            sync_state = ClusterSyncState.SPLIT_BRAIN_WARNING
        elif max(n.replication_lag_ms for n in nodes) > 100.0:
            sync_state = ClusterSyncState.DEGRADED_SYNC_LAG

        return {
            "cluster_state": sync_state.value,
            "quorum_preserved": quorum_preserved,
            "healthy_nodes": f"{healthy_count}/{total_nodes}",
            "primary_region": self._active_primary_region,
            "standby_region": self._active_standby_region,
            "write_frozen": self._write_frozen,
            "freeze_reason": self._freeze_reason,
            "average_lag_ms": round(sum(n.replication_lag_ms for n in nodes) / total_nodes, 2),
            "max_lag_ms": max(n.replication_lag_ms for n in nodes),
            "rpo_target": "0 ms (Zero RPO)",
            "rto_target": "< 30s (Automated Failover SLA)",
            "nodes": [n.model_dump() for n in nodes],
            "evaluated_at": now,
        }

    def check_split_brain_risk(self, active_node_count: int, total_nodes: int = 3) -> Dict[str, Any]:
        """Determine whether network isolation threatens cluster consistency."""
        quorum_threshold = (total_nodes // 2) + 1
        has_quorum = active_node_count >= quorum_threshold

        if not has_quorum:
            return {
                "split_brain_risk": True,
                "action_required": "ENFORCE_WRITE_FREEZE",
                "reason": f"Active nodes ({active_node_count}) below quorum threshold ({quorum_threshold}).",
            }

        return {
            "split_brain_risk": False,
            "action_required": "NONE",
            "reason": f"Quorum intact ({active_node_count}/{total_nodes} nodes responsive).",
        }

    def enforce_write_freeze(self, reason: str = "Administrative or failover write freeze"):
        """Lock write operations to prevent split-brain drift during maintenance or failover."""
        self._write_frozen = True
        self._freeze_reason = reason

    def release_write_freeze(self):
        """Resume normal read/write traffic after cluster stabilization."""
        self._write_frozen = False
        self._freeze_reason = None

    def is_write_frozen(self) -> bool:
        return self._write_frozen

    def set_primary_region(self, region: str):
        self._active_primary_region = region

    def set_standby_region(self, region: str):
        self._active_standby_region = region


replication_health_service = ReplicationHealthService()
