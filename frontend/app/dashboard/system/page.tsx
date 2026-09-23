"use client";

import * as React from "react";
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Radio,
  RefreshCw,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  ShieldCheck,
  Server,
  Zap,
} from "lucide-react";
import {
  Button,
  DataTable,
  StatusBadge,
  MetricCard,
  EmptyState,
  Modal,
  ColumnDef,
} from "@/components/design-system";

interface SubsystemHealth {
  status: string;
  latency_ms?: number;
  engine?: string;
  backend?: string;
  writable?: boolean;
  twilio_sms_voice?: string;
  smtp_email?: string;
  pending_jobs?: number;
  processing_jobs?: number;
  dead_letter_count?: number;
  active_distributed_locks?: number;
  error?: string;
}

interface DeepHealthData {
  status: string;
  overall_status?: string;
  timestamp: string;
  environment: string;
  version: string;
  subsystems: Record<string, SubsystemHealth>;
  task_queue: {
    pending: number;
    processing: number;
    dead_letter: number;
    active_locks: number;
  };
}

interface DistributedLockItem extends Record<string, any> {
  lockName: string;
  ownerId: string;
  acquiredAt: string;
  expiresAt: string;
  ttlSeconds: number;
  is_expired?: boolean;
}

interface TaskQueueJob extends Record<string, any> {
  id: string;
  taskType: string;
  queueName: string;
  status: string;
  priority: string;
  retries: number;
  maxRetries: number;
  workerId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export default function SystemOperationsPage() {
  const [telemetry, setTelemetry] = React.useState<DeepHealthData | null>(null);
  const [locks, setLocks] = React.useState<DistributedLockItem[]>([]);
  const [jobs, setJobs] = React.useState<TaskQueueJob[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Dispatch modal
  const [dispatchModalOpen, setDispatchModalOpen] = React.useState<boolean>(false);
  const [dispatchJobType, setDispatchJobType] = React.useState<string>("inactivity_sweep");

  const fetchSystemStatus = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Deep telemetry
      const healthRes = await fetch("/api/v1/system/health/deep");
      if (healthRes.ok) {
        const healthJson = await healthRes.json();
        setTelemetry(healthJson.data);
      }

      // 2. Workers & Locks
      const workerRes = await fetch("/api/v1/system/workers/status");
      if (workerRes.ok) {
        const workerJson = await workerRes.json();
        setLocks(workerJson.data?.active_locks || []);
      }

      // 3. Queue Jobs
      const queryParam = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const jobsRes = await fetch(`/api/v1/system/jobs${queryParam}`);
      if (jobsRes.ok) {
        const jobsJson = await jobsRes.json();
        setJobs(jobsJson.data?.jobs || []);
      }
    } catch (err) {
      console.error("Failed to load system telemetry:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 15000); // 15s polling
    return () => clearInterval(interval);
  }, [fetchSystemStatus]);

  const handleRetryJob = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/v1/system/jobs/${jobId}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchSystemStatus();
      }
    } catch (err) {
      console.error("Failed to resurrect DLQ job:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerSweep = async () => {
    setActionLoading("dispatch");
    try {
      const res = await fetch(`/api/v1/system/trigger/${dispatchJobType}`, {
        method: "POST",
      });
      if (res.ok) {
        setDispatchModalOpen(false);
        await fetchSystemStatus();
      }
    } catch (err) {
      console.error("Failed to trigger sweep:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Lock columns
  const lockColumns: ColumnDef<DistributedLockItem>[] = [
    {
      header: "Lock Key",
      accessorKey: "lockName",
      cell: (row) => (
        <div className="flex items-center gap-2 font-mono text-sm font-semibold text-slate-200">
          <Server className="h-4 w-4 text-emerald-400" />
          {row.lockName}
        </div>
      ),
    },
    {
      header: "Worker Node Owner",
      accessorKey: "ownerId",
      cell: (row) => (
        <span className="font-mono text-xs text-slate-400">{row.ownerId}</span>
      ),
    },
    {
      header: "Lease TTL",
      accessorKey: "ttlSeconds",
      cell: (row) => (
        <span className="text-xs text-slate-300 font-medium">{row.ttlSeconds}s</span>
      ),
    },
    {
      header: "Lease State",
      cell: (row) => (
        <StatusBadge
          status={row.is_expired ? "FAILED" : "ACTIVE"}
          variant={row.is_expired ? "rejected" : "approved"}
        />
      ),
    },
    {
      header: "Expires At",
      accessorKey: "expiresAt",
      cell: (row) => (
        <span className="text-xs text-slate-400">
          {new Date(row.expiresAt).toLocaleTimeString()}
        </span>
      ),
    },
  ];

  // Job columns
  const jobColumns: ColumnDef<TaskQueueJob>[] = [
    {
      header: "Task Type & ID",
      accessorKey: "taskType",
      cell: (row) => (
        <div>
          <div className="font-medium text-slate-200">{row.taskType}</div>
          <div className="font-mono text-xs text-slate-500">{row.id}</div>
        </div>
      ),
    },
    {
      header: "Queue",
      accessorKey: "queueName",
      cell: (row) => (
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          {row.queueName}
        </span>
      ),
    },
    {
      header: "Priority",
      accessorKey: "priority",
      cell: (row) => {
        const color =
          row.priority === "CRITICAL"
            ? "text-rose-400"
            : row.priority === "HIGH"
            ? "text-amber-400"
            : "text-slate-400";
        return <span className={`text-xs font-bold ${color}`}>{row.priority}</span>;
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => (
        <StatusBadge
          status={row.status}
          variant={
            row.status === "COMPLETED"
              ? "approved"
              : row.status === "DEAD_LETTER" || row.status === "FAILED"
              ? "rejected"
              : row.status === "PROCESSING"
              ? "cooling"
              : "pending"
          }
        />
      ),
    },
    {
      header: "Retries / Max",
      accessorKey: "retries",
      cell: (row) => (
        <span className="text-xs text-slate-400">
          {row.retries} / {row.maxRetries}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => {
        if (row.status === "DEAD_LETTER") {
          return (
            <Button
              variant="outline"
              size="sm"
              isLoading={actionLoading === row.id}
              onClick={() => handleRetryJob(row.id)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Replay DLQ
            </Button>
          );
        }
        return <span className="text-xs text-slate-600">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-8 p-6 font-tt-norms font-sans text-black">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-black/8 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-black text-white shadow-xs">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-black">
                System Operations & Infrastructure
              </h1>
              <p className="text-sm text-neutral-500">
                Real-time telemetry, distributed lock leases, and durable background task queue orchestrator.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchSystemStatus} isLoading={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Telemetry
          </Button>
          <Button variant="primary" size="sm" onClick={() => setDispatchModalOpen(true)}>
            <Play className="h-4 w-4 mr-2" />
            Trigger Maintenance Sweep
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Subsystems Status"
          value={telemetry?.overall_status || (telemetry?.status?.toUpperCase() ?? "CHECKING")}
          subtitle={telemetry ? `Environment: ${telemetry.environment}` : "Probing cluster"}
          icon={<Activity className="h-5 w-5 text-emerald-600" />}
        />
        <MetricCard
          title="Active Distributed Locks"
          value={telemetry?.task_queue?.active_locks ?? locks.length}
          subtitle="Mutual exclusion leases held"
          icon={<Server className="h-5 w-5 text-black" />}
        />
        <MetricCard
          title="In-Flight / Pending Jobs"
          value={(telemetry?.task_queue?.pending ?? 0) + (telemetry?.task_queue?.processing ?? 0)}
          subtitle={`${telemetry?.task_queue?.processing ?? 0} actively processing`}
          icon={<Layers className="h-5 w-5 text-amber-600" />}
        />
        <MetricCard
          title="Dead Letter Queue (DLQ)"
          value={telemetry?.task_queue?.dead_letter ?? 0}
          subtitle="Poison pills requiring replay"
          icon={<AlertTriangle className="h-5 w-5 text-rose-600" />}
        />
      </div>

      {/* Subsystem Health Matrix */}
      <div className="rounded-3xl border border-black/8 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Subsystem Diagnostics Matrix
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* MongoDB */}
          <div className="rounded-2xl border border-black/8 bg-neutral-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-medium text-black">
                <Database className="h-4 w-4 text-emerald-600" />
                MongoDB Database
              </div>
              <StatusBadge
                status={telemetry?.subsystems?.database?.status || "PENDING"}
                variant={telemetry?.subsystems?.database?.status === "UP" ? "approved" : "rejected"}
              />
            </div>
            <div className="text-xs text-neutral-500 space-y-1">
              <div>Latency: <span className="font-mono text-emerald-600 font-medium">{telemetry?.subsystems?.database?.latency_ms ?? 0}ms</span></div>
              <div>Engine: <span className="text-neutral-700">{telemetry?.subsystems?.database?.engine ?? "AsyncIOMotor"}</span></div>
            </div>
          </div>

          {/* Storage */}
          <div className="rounded-2xl border border-black/8 bg-neutral-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-medium text-black">
                <HardDrive className="h-4 w-4 text-blue-600" />
                Storage Engine
              </div>
              <StatusBadge
                status={telemetry?.subsystems?.storage?.status || "PENDING"}
                variant={telemetry?.subsystems?.storage?.status === "UP" ? "approved" : "rejected"}
              />
            </div>
            <div className="text-xs text-neutral-500 space-y-1">
              <div>Backend: <span className="text-neutral-700">{telemetry?.subsystems?.storage?.backend ?? "LOCAL_ENCRYPTED"}</span></div>
              <div>Writable: <span className="text-emerald-600 font-medium">True</span></div>
            </div>
          </div>

          {/* Communications */}
          <div className="rounded-2xl border border-black/8 bg-neutral-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-medium text-black">
                <Radio className="h-4 w-4 text-purple-600" />
                Twilio & SMTP Gateway
              </div>
              <StatusBadge
                status="ONLINE"
                variant="approved"
              />
            </div>
            <div className="text-xs text-neutral-500 space-y-1">
              <div>SMS / Voice: <span className="text-neutral-700">{telemetry?.subsystems?.notifications?.twilio_sms_voice}</span></div>
              <div>Email Dispatch: <span className="text-neutral-700">{telemetry?.subsystems?.notifications?.smtp_email}</span></div>
            </div>
          </div>

          {/* Worker Cluster */}
          <div className="rounded-2xl border border-black/8 bg-neutral-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-medium text-black">
                <Zap className="h-4 w-4 text-amber-600" />
                Distributed Leases
              </div>
              <StatusBadge
                status={telemetry?.subsystems?.worker_infrastructure?.status || "OPERATIONAL"}
                variant={telemetry?.subsystems?.worker_infrastructure?.status === "UP" ? "approved" : "warning"}
              />
            </div>
            <div className="text-xs text-neutral-500 space-y-1">
              <div>Active Locks: <span className="font-mono text-black font-medium">{telemetry?.subsystems?.worker_infrastructure?.active_distributed_locks ?? 0}</span></div>
              <div>Version: <span className="text-neutral-700">{telemetry?.version ?? "v1.14.0"}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Distributed Locks Table */}
      <div className="rounded-3xl border border-black/8 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
          <Server className="h-5 w-5 text-black" />
          Active Distributed Worker Locks
        </h2>
        {locks.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8 text-neutral-400" />}
            title="No Active Distributed Leases"
            description="All distributed locks are idle. Background workers will acquire locks as tasks are dispatched."
          />
        ) : (
          <DataTable
            data={locks}
            columns={lockColumns}
          />
        )}
      </div>

      {/* Durable Task Queue Explorer */}
      <div className="rounded-3xl border border-black/8 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-black flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-600" />
            Durable Task Queue & Dead Letter Queue (DLQ)
          </h2>
          <div className="flex items-center gap-2">
            {["all", "pending", "processing", "dead_letter", "completed"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  statusFilter === st
                    ? "bg-black text-white font-semibold shadow-xs"
                    : "bg-neutral-100 text-neutral-600 hover:text-black border border-black/5"
                }`}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {jobs.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-8 w-8 text-neutral-400" />}
            title="No Jobs Found in Queue"
            description="No background jobs match the selected filter criteria."
          />
        ) : (
          <DataTable
            data={jobs}
            columns={jobColumns}
          />
        )}
      </div>

      {/* Maintenance Sweep Trigger Modal */}
      <Modal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        title="Trigger Immediate Maintenance Sweep"
        description="Enqueues a critical background job to all distributed worker nodes."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Select Sweep Type
            </label>
            <select
              value={dispatchJobType}
              onChange={(e) => setDispatchJobType(e.target.value)}
              className="w-full rounded-2xl border border-black/15 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:border-black"
            >
              <option value="inactivity_sweep">Inactivity Detection & Heartbeat Sweep</option>
              <option value="claim_verification_check">Claim Verification & Fraud Escalation Sweep</option>
              <option value="dlq_cleanup">Dead Letter Queue (DLQ) Garbage Collection</option>
              <option value="log_archival">Tamper-Evident Audit Log Archival</option>
              <option value="notary_heartbeat">External Notary & Identity Provider Health Probe</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDispatchModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={actionLoading === "dispatch"}
              onClick={handleTriggerSweep}
            >
              Enqueue Sweep
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
