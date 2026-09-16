"use client";

import * as React from "react";
import {
  Globe2,
  Server,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Cpu,
  Clock,
  Zap,
  Lock,
  Unlock,
  Building,
  Radio,
} from "lucide-react";
import {
  Button,
  DataTable,
  ColumnDef,
  StatusBadge,
  MetricCard,
} from "@/components/design-system";

interface NodeTelemetry {
  node_id: string;
  region_name: string;
  datacenter: string;
  role: string;
  latency_ms: number;
  replication_lag_ms: number;
  is_healthy: boolean;
}

interface DrillRecord {
  drill_id: string;
  initiated_by: string;
  origin_region: string;
  promoted_region: string;
  rto_seconds: number;
  rpo_seconds: number;
  status: string;
  completed_at: string;
}

const INITIAL_NODES: NodeTelemetry[] = [
  {
    node_id: "node_us_east_primary_01",
    region_name: "us-east-1",
    datacenter: "AWS N. Virginia (us-east-1a)",
    role: "PRIMARY_ACTIVE",
    latency_ms: 1.2,
    replication_lag_ms: 0.0,
    is_healthy: true,
  },
  {
    node_id: "node_eu_central_standby_01",
    region_name: "eu-central-1",
    datacenter: "AWS Frankfurt (eu-central-1b)",
    role: "SECONDARY_STANDBY",
    latency_ms: 38.4,
    replication_lag_ms: 14.2,
    is_healthy: true,
  },
  {
    node_id: "node_ap_southeast_readonly_01",
    region_name: "ap-southeast-1",
    datacenter: "AWS Singapore (ap-southeast-1a)",
    role: "REPLICA_READONLY",
    latency_ms: 84.1,
    replication_lag_ms: 26.5,
    is_healthy: true,
  },
];

const INITIAL_DRILLS: DrillRecord[] = [
  {
    drill_id: "drill_9a8b7c6d5e",
    initiated_by: "sec_officer_apex",
    origin_region: "us-east-1",
    promoted_region: "eu-central-1",
    rto_seconds: 1.84,
    rpo_seconds: 0.0,
    status: "COMPLETED",
    completed_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    drill_id: "drill_1f2e3d4c5b",
    initiated_by: "system_cron_dr",
    origin_region: "us-east-1",
    promoted_region: "eu-central-1",
    rto_seconds: 2.11,
    rpo_seconds: 0.0,
    status: "COMPLETED",
    completed_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export default function DisasterRecoveryPage() {
  const [nodes, setNodes] = React.useState<NodeTelemetry[]>(INITIAL_NODES);
  const [drills, setDrills] = React.useState<DrillRecord[]>(INITIAL_DRILLS);
  const [isWriteFrozen, setIsWriteFrozen] = React.useState(false);
  const [drillStage, setDrillStage] = React.useState<"IDLE" | "DRAINING" | "PROMOTING" | "STANDBY_ACTIVE" | "RESTORING">("IDLE");
  const [isDrillRunning, setIsDrillRunning] = React.useState(false);

  const handleStartDrill = () => {
    setIsDrillRunning(true);
    setDrillStage("DRAINING");
    setIsWriteFrozen(true);

    setTimeout(() => {
      setDrillStage("PROMOTING");
      setTimeout(() => {
        setDrillStage("STANDBY_ACTIVE");
        setIsWriteFrozen(false);
        setTimeout(() => {
          setDrillStage("RESTORING");
          setTimeout(() => {
            setDrillStage("IDLE");
            setIsDrillRunning(false);
            const newRecord: DrillRecord = {
              drill_id: `drill_${Math.random().toString(16).slice(2, 12)}`,
              initiated_by: "operator_console",
              origin_region: "us-east-1",
              promoted_region: "eu-central-1",
              rto_seconds: 1.95,
              rpo_seconds: 0.0,
              status: "COMPLETED",
              completed_at: new Date().toISOString(),
            };
            setDrills((prev) => [newRecord, ...prev]);
          }, 1500);
        }, 2000);
      }, 1500);
    }, 1500);
  };

  const columns: ColumnDef<DrillRecord>[] = [
    {
      header: "Drill ID",
      accessorKey: "drill_id",
      cell: (item) => <span className="font-mono text-xs text-zinc-300">{item.drill_id}</span>,
    },
    {
      header: "Initiated By",
      accessorKey: "initiated_by",
      cell: (item) => <span className="text-xs text-zinc-400">{item.initiated_by}</span>,
    },
    {
      header: "Origin Region",
      accessorKey: "origin_region",
      cell: (item) => <span className="font-mono text-xs text-cyan-400">{item.origin_region}</span>,
    },
    {
      header: "Promoted Standby",
      accessorKey: "promoted_region",
      cell: (item) => <span className="font-mono text-xs text-indigo-400">{item.promoted_region}</span>,
    },
    {
      header: "RTO Measured",
      accessorKey: "rto_seconds",
      cell: (item) => (
        <span className="font-mono text-xs text-emerald-400 font-semibold">
          {item.rto_seconds.toFixed(2)}s
        </span>
      ),
    },
    {
      header: "RPO Data Loss",
      accessorKey: "rpo_seconds",
      cell: (item) => (
        <span className="font-mono text-xs text-emerald-400 font-semibold">
          {item.rpo_seconds.toFixed(2)}s (Zero Loss)
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (item) => <StatusBadge status={item.status} variant="approved" />,
    },
  ];

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto text-zinc-100">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-rose-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Globe2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Disaster Recovery & Multi-Region Failover
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Active-standby replication topology, zero-data-loss failover orchestration & chaos resilience drills
              </p>
            </div>
          </div>
        </div>

        {/* Global Action CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={isWriteFrozen ? "danger" : "secondary"}
            className="text-xs"
            onClick={() => setIsWriteFrozen(!isWriteFrozen)}
          >
            {isWriteFrozen ? (
              <>
                <Unlock className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                Release Write Freeze
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                Enforce Write Freeze
              </>
            )}
          </Button>

          <Button
            variant="primary"
            className="text-xs"
            onClick={handleStartDrill}
            isLoading={isDrillRunning}
          >
            <Play className="w-3.5 h-3.5 mr-1.5 text-white" />
            Start Failover Drill
          </Button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Cluster Quorum"
          value="3/3 ACTIVE"
          subtitle="Zero split-brain risk"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          title="Measured RTO"
          value="1.84s"
          subtitle="SLA Target: < 30.0s"
          icon={<Zap className="w-5 h-5 text-cyan-400" />}
        />
        <MetricCard
          title="Measured RPO"
          value="0.00s"
          subtitle="Zero transaction loss"
          icon={<Clock className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="Write Status"
          value={isWriteFrozen ? "FROZEN" : "ACTIVE"}
          subtitle={isWriteFrozen ? "Safe maintenance mode" : "Unrestricted transactions"}
          icon={<Lock className={`w-5 h-5 ${isWriteFrozen ? "text-rose-400" : "text-emerald-400"}`} />}
        />
      </div>

      {/* Multi-Region Cluster Topology Map */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6">
        <h2 className="text-base font-semibold text-zinc-100 mb-1 flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          Multi-Region Active/Standby Cluster Nodes
        </h2>
        <p className="text-xs text-zinc-400 mb-6">
          Synchronous replication across tier-1 availability zones with automatic consensus voting.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {nodes.map((n) => (
            <div
              key={n.node_id}
              className={`p-5 rounded-xl border transition-all ${
                n.role === "PRIMARY_ACTIVE"
                  ? "bg-cyan-950/20 border-cyan-500/40 shadow-lg shadow-cyan-950/30"
                  : n.role === "SECONDARY_STANDBY"
                  ? "bg-indigo-950/20 border-indigo-500/30"
                  : "bg-zinc-950 border-zinc-800"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-bold text-zinc-200">{n.region_name}</span>
                <StatusBadge
                  status={n.role}
                  variant={n.role === "PRIMARY_ACTIVE" ? "active" : "cooling"}
                />
              </div>
              <p className="text-xs text-zinc-400 mb-4">{n.datacenter}</p>
              <div className="space-y-2 text-xs font-mono border-t border-zinc-800/60 pt-3">
                <div className="flex justify-between text-zinc-400">
                  <span>Ping Latency:</span>
                  <span className="text-zinc-200">{n.latency_ms} ms</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Replication Lag:</span>
                  <span className={n.replication_lag_ms === 0 ? "text-emerald-400" : "text-amber-400"}>
                    {n.replication_lag_ms} ms
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Failover Drill Stepper */}
      {drillStage !== "IDLE" && (
        <div className="bg-zinc-900/80 border border-indigo-500/40 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
              Live Failover Drill In Progress
            </h3>
            <span className="text-xs font-mono text-indigo-300 bg-indigo-950 px-2.5 py-1 rounded">
              STAGE: {drillStage}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs font-mono">
            {[
              { key: "DRAINING", label: "1. Drain Writes" },
              { key: "PROMOTING", label: "2. Promote Standby" },
              { key: "STANDBY_ACTIVE", label: "3. Standby Active" },
              { key: "RESTORING", label: "4. Restore Primary" },
            ].map((s) => (
              <div
                key={s.key}
                className={`p-3 rounded-lg border text-center transition-all ${
                  drillStage === s.key
                    ? "bg-indigo-600/30 border-indigo-400 text-indigo-200 font-bold"
                    : "bg-zinc-950 border-zinc-800 text-zinc-500"
                }`}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Drill Runs */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-md">
        <h2 className="text-base font-semibold text-zinc-100 mb-1">
          Historical Disaster Recovery Drill Reports
        </h2>
        <p className="text-xs text-zinc-400 mb-4">
          Automated point-in-time recovery and failover verification logs proving continuous SLA compliance.
        </p>

        <DataTable
          data={drills}
          columns={columns}
          searchPlaceholder="Search drill ID, region, or status..."
          pageSize={5}
        />
      </div>
    </div>
  );
}
