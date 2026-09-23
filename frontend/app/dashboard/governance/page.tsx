"use client";

import * as React from "react";
import {
  Users,
  ShieldAlert,
  Key,
  Clock,
  QrCode,
  CheckCircle2,
  XCircle,
  FileText,
  Lock,
  Vote,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import {
  Button,
  DataTable,
  ColumnDef,
  StatusBadge,
  MetricCard,
} from "@/components/design-system";

interface ProposalItem {
  proposal_id: string;
  vault_id: string;
  action: string;
  description: string;
  threshold_required: number;
  total_custodians: number;
  signed_count: number;
  state: "PROPOSED" | "COLLECTING_SIGNATURES" | "TIMELOCK_RUNNING" | "EXECUTABLE" | "EXECUTED" | "VETOED_BY_OWNER";
  timelock_expires_at?: string;
  created_at: string;
}

const INITIAL_PROPOSALS: ProposalItem[] = [
  {
    proposal_id: "prop_89ab12cd34",
    vault_id: "vlt_apex_sovereign_01",
    action: "EMERGENCY_UNFREEZE",
    description: "Emergency unfreeze of tier-3 offshore vault following proof of living owner status",
    threshold_required: 3,
    total_custodians: 5,
    signed_count: 2,
    state: "COLLECTING_SIGNATURES",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    proposal_id: "prop_56ef78ab90",
    vault_id: "vlt_family_trust_02",
    action: "ASSET_COLD_TRANSFER",
    description: "Transfer 500 BTC master keys from hot HSM to Swiss cold storage air-gapped vault",
    threshold_required: 3,
    total_custodians: 5,
    signed_count: 3,
    state: "TIMELOCK_RUNNING",
    timelock_expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    proposal_id: "prop_12cd34ef56",
    vault_id: "vlt_legal_custody_03",
    action: "QUORUM_POLICY_MUTATION",
    description: "Expand custodian board from 3-of-5 to 4-of-7 for enhanced UHNW compliance",
    threshold_required: 3,
    total_custodians: 5,
    signed_count: 3,
    state: "EXECUTABLE",
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

export default function CustodianGovernancePage() {
  const [proposals, setProposals] = React.useState<ProposalItem[]>(INITIAL_PROPOSALS);
  const [selectedProposal, setSelectedProposal] = React.useState<ProposalItem | null>(null);
  const [isSigning, setIsSigning] = React.useState(false);
  const [showAirgapModal, setShowAirgapModal] = React.useState(false);
  const [airgapManifest, setAirgapManifest] = React.useState<string>(
    "SECUREVAULT_AIRGAP:V1:airgap_7721ab89:4e07408562bedb8b:nonce_991823"
  );
  const [copiedKey, setCopiedKey] = React.useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSign = (proposalId: string) => {
    setIsSigning(true);
    setTimeout(() => {
      setIsSigning(false);
      setProposals((prev) =>
        prev.map((p) => {
          if (p.proposal_id === proposalId && p.signed_count < p.total_custodians) {
            const nextCount = p.signed_count + 1;
            const nextState =
              nextCount >= p.threshold_required
                ? p.timelock_expires_at
                  ? "TIMELOCK_RUNNING"
                  : "EXECUTABLE"
                : "COLLECTING_SIGNATURES";
            return { ...p, signed_count: nextCount, state: nextState };
          }
          return p;
        })
      );
    }, 600);
  };

  const handleExecute = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.proposal_id === proposalId ? { ...p, state: "EXECUTED" } : p))
    );
  };

  const handleVeto = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.proposal_id === proposalId ? { ...p, state: "VETOED_BY_OWNER" } : p))
    );
  };

  const getStatusVariant = (state: string) => {
    switch (state) {
      case "EXECUTED":
        return "approved";
      case "EXECUTABLE":
        return "active";
      case "TIMELOCK_RUNNING":
        return "cooling";
      case "VETOED_BY_OWNER":
        return "rejected";
      case "COLLECTING_SIGNATURES":
      case "PROPOSED":
      default:
        return "pending";
    }
  };

  const columns: ColumnDef<ProposalItem>[] = [
    {
      header: "Proposal ID",
      accessorKey: "proposal_id",
      cell: (item) => <span className="font-mono text-xs text-zinc-300">{item.proposal_id}</span>,
    },
    {
      header: "Action Scope",
      accessorKey: "action",
      cell: (item) => (
        <span className="font-mono text-xs text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded font-semibold">
          {item.action}
        </span>
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: (item) => <span className="text-xs text-zinc-300 line-clamp-1 max-w-xs">{item.description}</span>,
    },
    {
      header: "Quorum Progress",
      accessorKey: "signed_count",
      cell: (item) => (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-mono text-zinc-400">
            <span>
              {item.signed_count}/{item.threshold_required} Required
            </span>
            <span className="text-zinc-500">({item.total_custodians} Total)</span>
          </div>
          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                item.signed_count >= item.threshold_required ? "bg-emerald-400" : "bg-cyan-500"
              }`}
              style={{ width: `${Math.min(100, (item.signed_count / item.threshold_required) * 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      header: "Governance State",
      accessorKey: "state",
      cell: (item) => <StatusBadge status={item.state} variant={getStatusVariant(item.state)} />,
    },
    {
      header: "Actions",
      accessorKey: "proposal_id",
      cell: (item) => (
        <div className="flex items-center gap-1.5">
          {item.state === "COLLECTING_SIGNATURES" && (
            <Button
              variant="secondary"
              className="text-xs py-1 px-2.5"
              onClick={() => handleSign(item.proposal_id)}
              isLoading={isSigning}
            >
              Sign
            </Button>
          )}

          {item.state === "EXECUTABLE" && (
            <Button
              variant="primary"
              className="text-xs py-1 px-2.5"
              onClick={() => handleExecute(item.proposal_id)}
            >
              Execute
            </Button>
          )}

          {item.state !== "EXECUTED" && item.state !== "VETOED_BY_OWNER" && (
            <Button
              variant="danger"
              className="text-xs py-1 px-2.5"
              onClick={() => handleVeto(item.proposal_id)}
            >
              Veto
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
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Institutional Multi-Custodian Governance
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                M-of-N threshold quorum voting, 48-hour time-locked delay windows & cold air-gapped signing
              </p>
            </div>
          </div>
        </div>

        {/* Global CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => setShowAirgapModal(true)}
          >
            <QrCode className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            Air-Gap Cold Handshake
          </Button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Proposals"
          value={String(proposals.filter((p) => p.state !== "EXECUTED" && p.state !== "VETOED_BY_OWNER").length)}
          subtitle="Pending custodian quorum"
          icon={<Vote className="w-5 h-5 text-cyan-400" />}
        />
        <MetricCard
          title="Quorum Threshold"
          value="3-of-5 REQUIRED"
          subtitle="60% consensus rule"
          icon={<Users className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="Owner Timelock Grace"
          value="48h WINDOW"
          subtitle="1-click owner veto active"
          icon={<Clock className="w-5 h-5 text-amber-400" />}
        />
        <MetricCard
          title="Air-Gap Security"
          value="OFFLINE QR"
          subtitle="Zero network private keys"
          icon={<Lock className="w-5 h-5 text-emerald-400" />}
        />
      </div>

      {/* Proposals DataTable */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Custodian Quorum Proposals</h2>
            <p className="text-xs text-zinc-400">
              High-value transactions and vault unfreezes require multiple independent cryptographic approvals.
            </p>
          </div>
        </div>

        <DataTable
          data={proposals}
          columns={columns}
          searchPlaceholder="Search proposal ID, action, or vault..."
          pageSize={5}
        />
      </div>

      {/* Air-Gap Cold Handshake Modal / Drawer */}
      {showAirgapModal && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <QrCode className="w-5 h-5 text-cyan-400" />
              <h3 className="font-semibold text-zinc-100 text-sm">
                Cold Storage Air-Gap Handshake (Offline QR Protocol)
              </h3>
            </div>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => setShowAirgapModal(false)}
            >
              Close
            </Button>
          </div>

          <p className="text-xs text-zinc-400">
            Scan this cryptographic challenge manifest using your air-gapped hardware signing module (HSM or dedicated offline terminal) to sign the transaction without exposing private keys.
          </p>

          <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 font-mono text-xs text-cyan-300 flex justify-between items-center">
            <span className="truncate">{airgapManifest}</span>
            <button
              onClick={() => handleCopy(airgapManifest)}
              className="text-zinc-400 hover:text-white p-1 ml-2"
            >
              {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="p-3 bg-zinc-950/60 rounded-lg border border-indigo-900/30 text-xs text-zinc-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Air-gap signature verification uses HMAC-SHA256 challenge-response with 15-minute replay prevention nonces.</span>
          </div>
        </div>
      )}
    </div>
  );
}
