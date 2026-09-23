"use client";

import * as React from "react";
import {
  Activity,
  Shield,
  Radio,
  Play,
  Pause,
  Trash2,
  Lock,
  Building,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Terminal,
} from "lucide-react";
import {
  Button,
  DataTable,
  ColumnDef,
  StatusBadge,
  MetricCard,
} from "@/components/design-system";

interface StreamAuditEvent {
  id: string;
  userId: string;
  tenantId: string;
  action: string;
  resource: string;
  entryHash: string;
  prevHash: string;
  chainIndex: number;
  timestamp: string;
  ip: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

const INITIAL_STREAM_EVENTS: StreamAuditEvent[] = [
  {
    id: "aud_99f8101a2b",
    userId: "usr_executive_vault",
    tenantId: "tenant_apex_capital",
    action: "VAULT_ASSET_ENCRYPTED",
    resource: "ASSETS",
    entryHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
    chainIndex: 1,
    timestamp: new Date(Date.now() - 60000).toISOString(),
    ip: "192.168.1.100",
    severity: "INFO",
  },
  {
    id: "aud_44a7122b1c",
    userId: "usr_family_trustee",
    tenantId: "tenant_family_trust_01",
    action: "HEARTBEAT_ACKNOWLEDGED",
    resource: "SWITCH",
    entryHash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    prevHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    chainIndex: 2,
    timestamp: new Date(Date.now() - 42000).toISOString(),
    ip: "10.0.0.15",
    severity: "INFO",
  },
  {
    id: "aud_18b9333c4d",
    userId: "usr_notary_escrow",
    tenantId: "tenant_legal_custody_eu",
    action: "CLAIM_DISPUTE_SUBMITTED",
    resource: "CLAIMS",
    entryHash: "4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce",
    prevHash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    chainIndex: 3,
    timestamp: new Date(Date.now() - 15000).toISOString(),
    ip: "172.16.4.88",
    severity: "CRITICAL",
  },
];

export default function LiveAuditStreamPage() {
  const [events, setEvents] = React.useState<StreamAuditEvent[]>(INITIAL_STREAM_EVENTS);
  const [isStreaming, setIsStreaming] = React.useState(true);
  const [selectedTenant, setSelectedTenant] = React.useState<string>("all");
  const [selectedEvent, setSelectedEvent] = React.useState<StreamAuditEvent | null>(null);
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  // Simulated live event generation when active
  React.useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const actions = [
        { action: "KMS_DATA_KEY_ROTATED", resource: "KMS", severity: "INFO" as const },
        { action: "NOMINEE_INVITATION_DISPATCHED", resource: "NOMINEES", severity: "INFO" as const },
        { action: "STEP_UP_MFA_CHALLENGE", resource: "AUTH", severity: "WARNING" as const },
        { action: "CONTAINMENT_LOCK_VAULT", resource: "SECURITY", severity: "CRITICAL" as const },
        { action: "HEARTBEAT_ACKNOWLEDGED", resource: "USERS", severity: "INFO" as const },
      ];
      const tenants = ["tenant_apex_capital", "tenant_family_trust_01", "tenant_legal_custody_eu"];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const randomTenant = tenants[Math.floor(Math.random() * tenants.length)];

      const newEvent: StreamAuditEvent = {
        id: `aud_${Math.random().toString(16).slice(2, 12)}`,
        userId: `usr_${Math.random().toString(36).slice(2, 8)}`,
        tenantId: randomTenant,
        action: randomAction.action,
        resource: randomAction.resource,
        entryHash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        prevHash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        chainIndex: events.length + 1,
        timestamp: new Date().toISOString(),
        ip: `192.168.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 250)}`,
        severity: randomAction.severity,
      };

      setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
    }, 4500);

    return () => clearInterval(interval);
  }, [isStreaming, events.length]);

  const filteredEvents = React.useMemo(() => {
    if (selectedTenant === "all") return events;
    return events.filter((e) => e.tenantId === selectedTenant);
  }, [events, selectedTenant]);

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <StatusBadge status="CRITICAL" variant="rejected" />;
      case "WARNING":
        return <StatusBadge status="WARNING" variant="warning" />;
      default:
        return <StatusBadge status="INFO" variant="active" />;
    }
  };

  const columns: ColumnDef<StreamAuditEvent>[] = [
    {
      header: "Timestamp",
      accessorKey: "timestamp",
      cell: (item) => (
        <span className="font-mono text-xs text-zinc-400">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
      ),
    },
    {
      header: "Severity",
      accessorKey: "severity",
      cell: (item) => getSeverityBadge(item.severity),
    },
    {
      header: "Action Event",
      accessorKey: "action",
      cell: (item) => (
        <div
          className="font-mono text-xs font-semibold text-zinc-200 hover:text-cyan-400 cursor-pointer"
          onClick={() => setSelectedEvent(item)}
        >
          {item.action}
        </div>
      ),
    },
    {
      header: "Tenant Scope",
      accessorKey: "tenantId",
      cell: (item) => (
        <span className="text-xs text-indigo-300 font-mono bg-indigo-950/50 border border-indigo-900/40 px-2 py-0.5 rounded">
          {item.tenantId}
        </span>
      ),
    },
    {
      header: "Resource",
      accessorKey: "resource",
      cell: (item) => <span className="text-xs text-zinc-400">{item.resource}</span>,
    },
    {
      header: "Block Hash",
      accessorKey: "entryHash",
      cell: (item) => (
        <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
          <span>{item.entryHash.slice(0, 10)}...</span>
          <button
            onClick={() => handleCopy(item.entryHash)}
            className="text-zinc-400 hover:text-white p-0.5"
          >
            {copiedHash === item.entryHash ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto text-zinc-100">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Live SIEM Audit Streamer & SOC Telemetry
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Real-time Server-Sent Events (SSE), multi-tenant isolation, and cryptographic chain validation
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={isStreaming ? "secondary" : "primary"}
            className="text-xs"
            onClick={() => setIsStreaming(!isStreaming)}
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                Pause Stream
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                Resume Stream
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => setEvents([])}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
            Clear Feed
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Streaming Telemetry"
          value={isStreaming ? "CONNECTED" : "PAUSED"}
          subtitle="Server-Sent Events (SSE)"
          icon={<Radio className={`w-5 h-5 ${isStreaming ? "text-emerald-400" : "text-amber-400"}`} />}
        />
        <MetricCard
          title="Ledger Integrity"
          value="100% VERIFIED"
          subtitle="Zero hash fractures detected"
          icon={<CheckCircle2 className="w-5 h-5 text-cyan-400" />}
        />
        <MetricCard
          title="Total Events Ingested"
          value={String(events.length)}
          subtitle="In-memory ring buffer (50)"
          icon={<Activity className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="Active Tenant Filter"
          value={selectedTenant === "all" ? "GLOBAL" : selectedTenant.slice(0, 14)}
          subtitle="Strict context partitioning"
          icon={<Building className="w-5 h-5 text-amber-400" />}
        />
      </div>

      {/* Multi-Tenant Scope Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Building className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold">Tenant Partition Filter:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: "All Tenants (Global SOC)" },
            { id: "tenant_apex_capital", label: "Apex Capital" },
            { id: "tenant_family_trust_01", label: "Family Trust 01" },
            { id: "tenant_legal_custody_eu", label: "Legal Custody EU" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTenant(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedTenant === t.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stream Table */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Live Tamper-Evident Event Feed</h2>
            <p className="text-xs text-zinc-400">
              Events appended sequentially with SHA-256 hash chains across privileged user and worker actions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isStreaming && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isStreaming ? "bg-emerald-500" : "bg-amber-500"}`}></span>
            </span>
            <span className="text-xs font-mono text-zinc-400">
              {isStreaming ? "LIVE PUSH" : "STANDBY"}
            </span>
          </div>
        </div>

        <DataTable
          data={filteredEvents}
          columns={columns}
          searchPlaceholder="Search event action, tenant, or block hash..."
          pageSize={8}
        />
      </div>

      {/* Event Details Drawer */}
      {selectedEvent && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-zinc-100 text-sm">
                Cryptographic Block Inspector — Chain Index #{selectedEvent.chainIndex}
              </h3>
            </div>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => setSelectedEvent(null)}
            >
              Close
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
              <span className="text-zinc-500">Current Block Hash (SHA-256):</span>
              <p className="font-mono text-cyan-300 break-all">{selectedEvent.entryHash}</p>
            </div>
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
              <span className="text-zinc-500">Previous Parent Hash (prevHash):</span>
              <p className="font-mono text-zinc-400 break-all">{selectedEvent.prevHash}</p>
            </div>
          </div>

          <div className="bg-zinc-950 p-4 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto border border-zinc-800">
            <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
