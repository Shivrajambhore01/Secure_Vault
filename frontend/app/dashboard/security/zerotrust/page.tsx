"use client";

import * as React from "react";
import {
  ShieldAlert,
  Clock,
  KeyRound,
  Lock,
  UserCheck,
  AlertTriangle,
  Fingerprint,
  Usb,
  Laptop,
  CheckCircle2,
  Trash2,
  Play,
  Plus,
} from "lucide-react";
import {
  Button,
  DataTable,
  ColumnDef,
  StatusBadge,
  MetricCard,
} from "@/components/design-system";

interface JitGrantItem {
  grant_id: string;
  requester_id: string;
  scope: string;
  justification: string;
  duration_minutes: number;
  status: "PENDING_APPROVAL" | "ACTIVE_ELEVATED" | "EXPIRED" | "REVOKED";
  expires_at?: string;
  created_at: string;
}

interface HardwareKeyItem {
  credential_id: string;
  device_name: string;
  hardware_type: string;
  aaguid: string;
  registered_at: string;
  is_primary: boolean;
}

const INITIAL_GRANTS: JitGrantItem[] = [
  {
    grant_id: "jit_44a19b22cd",
    requester_id: "eng_alexander_vault",
    scope: "FORENSIC_READ",
    justification: "Investigate SIEM impossible travel trigger for vault #9921",
    duration_minutes: 15,
    status: "ACTIVE_ELEVATED",
    expires_at: new Date(Date.now() + 600000).toISOString(),
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    grant_id: "jit_88c21d44ef",
    requester_id: "auditor_elena_gdpr",
    scope: "VAULT_EMERGENCY_RECOVERY",
    justification: "Annual SOC2 Type II cryptographic key verification audit",
    duration_minutes: 30,
    status: "PENDING_APPROVAL",
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    grant_id: "jit_11e77f99ab",
    requester_id: "support_ops_lead",
    scope: "KMS_MAINTENANCE",
    justification: "Assist beneficiary with Ron Notary session timeout",
    duration_minutes: 15,
    status: "EXPIRED",
    expires_at: new Date(Date.now() - 3600000).toISOString(),
    created_at: new Date(Date.now() - 4500000).toISOString(),
  },
];

const INITIAL_KEYS: HardwareKeyItem[] = [
  {
    credential_id: "cred_fido2_yubi5c_99",
    device_name: "YubiKey 5C NFC (Primary Hardware Token)",
    hardware_type: "USB-C / NFC Security Key",
    aaguid: "cb69481e-8ff7-4039-93ec-0a2729a154a8",
    registered_at: "2026-01-15T10:30:00Z",
    is_primary: true,
  },
  {
    credential_id: "cred_webauthn_touchid_01",
    device_name: "MacBook Pro Touch ID (Secure Enclave)",
    hardware_type: "Platform Authenticator",
    aaguid: "adce0002-35bc-c60a-648b-0b25f1f05503",
    registered_at: "2026-03-02T14:22:00Z",
    is_primary: false,
  },
];

export default function ZeroTrustPage() {
  const [grants, setGrants] = React.useState<JitGrantItem[]>(INITIAL_GRANTS);
  const [keys, setKeys] = React.useState<HardwareKeyItem[]>(INITIAL_KEYS);
  const [showRequestModal, setShowRequestModal] = React.useState(false);
  const [newScope, setNewScope] = React.useState("FORENSIC_READ");
  const [newJustification, setNewJustification] = React.useState("");
  const [newDuration, setNewDuration] = React.useState(15);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleApprove = (grantId: string) => {
    setGrants((prev) =>
      prev.map((g) =>
        g.grant_id === grantId
          ? {
              ...g,
              status: "ACTIVE_ELEVATED",
              expires_at: new Date(Date.now() + g.duration_minutes * 60000).toISOString(),
            }
          : g
      )
    );
  };

  const handleRevoke = (grantId: string) => {
    setGrants((prev) =>
      prev.map((g) => (g.grant_id === grantId ? { ...g, status: "REVOKED" } : g))
    );
  };

  const handleCreateGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJustification) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const created: JitGrantItem = {
        grant_id: `jit_${Math.random().toString(16).slice(2, 12)}`,
        requester_id: "current_authenticated_user",
        scope: newScope,
        justification: newJustification,
        duration_minutes: newDuration,
        status: "PENDING_APPROVAL",
        created_at: new Date().toISOString(),
      };
      setGrants([created, ...grants]);
      setShowRequestModal(false);
      setNewJustification("");
    }, 500);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "ACTIVE_ELEVATED":
        return "active";
      case "PENDING_APPROVAL":
        return "pending";
      case "REVOKED":
        return "rejected";
      case "EXPIRED":
      default:
        return "inactive";
    }
  };

  const columns: ColumnDef<JitGrantItem>[] = [
    {
      header: "Grant ID",
      accessorKey: "grant_id",
      cell: (item) => <span className="font-mono text-xs text-zinc-300">{item.grant_id}</span>,
    },
    {
      header: "Requester",
      accessorKey: "requester_id",
      cell: (item) => <span className="text-xs text-zinc-400">{item.requester_id}</span>,
    },
    {
      header: "Elevation Scope",
      accessorKey: "scope",
      cell: (item) => (
        <span className="font-mono text-xs text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded font-semibold">
          {item.scope}
        </span>
      ),
    },
    {
      header: "Justification",
      accessorKey: "justification",
      cell: (item) => <span className="text-xs text-zinc-300 line-clamp-1 max-w-xs">{item.justification}</span>,
    },
    {
      header: "Duration",
      accessorKey: "duration_minutes",
      cell: (item) => <span className="font-mono text-xs text-zinc-400">{item.duration_minutes}m</span>,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (item) => <StatusBadge status={item.status} variant={getStatusVariant(item.status)} />,
    },
    {
      header: "Actions",
      accessorKey: "grant_id",
      cell: (item) => (
        <div className="flex items-center gap-1.5">
          {item.status === "PENDING_APPROVAL" && (
            <Button
              variant="secondary"
              className="text-xs py-1 px-2.5"
              onClick={() => handleApprove(item.grant_id)}
            >
              Approve
            </Button>
          )}

          {item.status === "ACTIVE_ELEVATED" && (
            <Button
              variant="danger"
              className="text-xs py-1 px-2.5"
              onClick={() => handleRevoke(item.grant_id)}
            >
              Revoke
            </Button>
          )}
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
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-xl border border-emerald-500/30 text-emerald-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Zero-Trust Ephemeral Access & Passkeys
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Just-In-Time (JIT) self-expiring privilege elevation, hardware FIDO2 attestation & standing privilege elimination
              </p>
            </div>
          </div>
        </div>

        {/* Global Action CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            className="text-xs"
            onClick={() => setShowRequestModal(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Request JIT Elevation
          </Button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active JIT Grants"
          value={String(grants.filter((g) => g.status === "ACTIVE_ELEVATED").length)}
          subtitle="Self-expiring privileges"
          icon={<Clock className="w-5 h-5 text-cyan-400" />}
        />
        <MetricCard
          title="Max Window"
          value="15 Minutes"
          subtitle="Enforced time bounds"
          icon={<Clock className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="Hardware Passkeys"
          value={String(keys.length)}
          subtitle="FIDO2 / WebAuthn Level 3"
          icon={<Fingerprint className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          title="Standing Admins"
          value="0 (Zero Standing)"
          subtitle="Zero persistent privileges"
          icon={<Lock className="w-5 h-5 text-amber-400" />}
        />
      </div>

      {/* JIT Elevation Request Modal */}
      {showRequestModal && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              Request Just-In-Time Ephemeral Elevation
            </h3>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => setShowRequestModal(false)}
            >
              Cancel
            </Button>
          </div>

          <form onSubmit={handleCreateGrant} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Requested Elevation Scope
              </label>
              <select
                value={newScope}
                onChange={(e) => setNewScope(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="FORENSIC_READ">FORENSIC_READ (SIEM anomaly investigation)</option>
                <option value="VAULT_EMERGENCY_RECOVERY">VAULT_EMERGENCY_RECOVERY (Custodial recovery)</option>
                <option value="KMS_MAINTENANCE">KMS_MAINTENANCE (Key rotation & hardware HSM probe)</option>
                <option value="TENANT_MIGRATION">TENANT_MIGRATION (Institutional family office onboarding)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Operational Justification (Mandatory for SIEM Ledger)
              </label>
              <textarea
                rows={3}
                value={newJustification}
                onChange={(e) => setNewJustification(e.target.value)}
                placeholder="Provide detailed incident ticket ID or operational purpose..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <Button
              variant="primary"
              className="w-full text-xs"
              isLoading={isSubmitting}
            >
              Submit Elevation Request for Dual Approval
            </Button>
          </form>
        </div>
      )}

      {/* JIT Grants Table */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Ephemeral Access Grants (JIT)</h2>
            <p className="text-xs text-zinc-400">
              Access is granted on-demand with automatic self-revocation upon expiration.
            </p>
          </div>
        </div>

        <DataTable
          data={grants}
          columns={columns}
          searchPlaceholder="Search grant ID, requester, or scope..."
          pageSize={5}
        />
      </div>

      {/* Hardware Passkeys Inventory */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6">
        <h2 className="text-base font-semibold text-zinc-100 mb-1 flex items-center gap-2">
          <Usb className="w-4 h-4 text-emerald-400" />
          Enrolled FIDO2 / WebAuthn Hardware Security Keys
        </h2>
        <p className="text-xs text-zinc-400 mb-6">
          Cryptographically bound hardware tokens protecting against phishing, credential interception, and SIM-swaps.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {keys.map((k) => (
            <div
              key={k.credential_id}
              className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-cyan-400" />
                  <span className="font-semibold text-sm text-zinc-200">{k.device_name}</span>
                </div>
                {k.is_primary && (
                  <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800/40 px-2 py-0.5 rounded font-mono">
                    PRIMARY
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-zinc-400 space-y-1">
                <p>Type: <span className="text-zinc-300">{k.hardware_type}</span></p>
                <p>AAGUID: <span className="text-zinc-500">{k.aaguid}</span></p>
                <p>Enrolled: <span className="text-zinc-500">{new Date(k.registered_at).toLocaleDateString()}</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
