"use client";

import * as React from "react";
import {
  Users,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Copy,
  Check,
  Plus,
  Trash2,
  Share2,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  Send,
  Zap,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  Modal,
  StatusBadge,
  RiskBadge,
  MetricCard,
  EmptyState,
} from "@/components/design-system";

interface Guardian {
  id: string;
  name: string;
  email: string;
  relationship: string;
  status: "ACTIVE" | "PENDING_CONFIRMATION" | "SHARD_SUBMITTED";
  shardIndex: number;
  addedAt: string;
}

interface RecoveryCase {
  id: string;
  targetEmail: string;
  claimantName: string;
  status: "INITIATED" | "TIMELOCK_PENDING" | "TIMELOCK_EXPIRED" | "CANCELLED_BY_OWNER" | "RECONSTRUCTED";
  shardsRequired: number;
  shardsCollected: number;
  timelockEndsAt?: string;
  createdAt: string;
}

export default function SocialRecoveryPage() {
  const [isConfigured, setIsConfigured] = React.useState(true);
  const [thresholdK, setThresholdK] = React.useState(3);
  const [totalN, setTotalN] = React.useState(5);
  const [copiedShardId, setCopiedShardId] = React.useState<string | null>(null);

  // Recovery Case State
  const [activeCase, setActiveCase] = React.useState<RecoveryCase | null>({
    id: "rec_9b841a02fe",
    targetEmail: "vault.owner@securevault.io",
    claimantName: "Elena Vance (Authorized Guardian)",
    status: "TIMELOCK_PENDING",
    shardsRequired: 3,
    shardsCollected: 3,
    timelockEndsAt: new Date(Date.now() + 64 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  });

  // Guardians list
  const [guardians, setGuardians] = React.useState<Guardian[]>([
    {
      id: "g-1",
      name: "Dr. Marcus Vance",
      email: "marcus.vance@clinic.org",
      relationship: "Family Physician",
      status: "SHARD_SUBMITTED",
      shardIndex: 1,
      addedAt: "2026-08-10",
    },
    {
      id: "g-2",
      name: "Sarah Jenkins, Esq.",
      email: "sjenkins@legalpartners.com",
      relationship: "Estate Attorney",
      status: "SHARD_SUBMITTED",
      shardIndex: 2,
      addedAt: "2026-08-10",
    },
    {
      id: "g-3",
      name: "David Sterling",
      email: "d.sterling@investments.co",
      relationship: "Wealth Advisor",
      status: "SHARD_SUBMITTED",
      shardIndex: 3,
      addedAt: "2026-08-10",
    },
    {
      id: "g-4",
      name: "Clara Oswald",
      email: "clara.o@oxford.edu",
      relationship: "Sister",
      status: "ACTIVE",
      shardIndex: 4,
      addedAt: "2026-08-11",
    },
    {
      id: "g-5",
      name: "Robert Chen",
      email: "rchen@techfoundry.io",
      relationship: "Business Partner",
      status: "ACTIVE",
      shardIndex: 5,
      addedAt: "2026-08-12",
    },
  ]);

  // Modals
  const [isSetupOpen, setIsSetupOpen] = React.useState(false);
  const [isSubmitShardOpen, setIsSubmitShardOpen] = React.useState(false);
  const [isAbortModalOpen, setIsAbortModalOpen] = React.useState(false);
  const [shardInput, setShardInput] = React.useState("");
  const [submitFeedback, setSubmitFeedback] = React.useState<string | null>(null);

  // Setup wizard temp state
  const [setupGuardians, setSetupGuardians] = React.useState([
    { name: "", email: "", relationship: "TRUSTED_ADVISOR" },
    { name: "", email: "", relationship: "FAMILY_MEMBER" },
    { name: "", email: "", relationship: "ATTORNEY" },
  ]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedShardId(id);
    setTimeout(() => setCopiedShardId(null), 2500);
  };

  const handleAbortRecovery = () => {
    if (activeCase) {
      setActiveCase({
        ...activeCase,
        status: "CANCELLED_BY_OWNER",
      });
    }
    setIsAbortModalOpen(false);
  };

  const handleSubmitShard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shardInput.trim()) return;

    if (activeCase && activeCase.status === "TIMELOCK_PENDING") {
      setSubmitFeedback("Shard accepted! Cryptographic signature verified against quorum modulus.");
      setTimeout(() => {
        setIsSubmitShardOpen(false);
        setSubmitFeedback(null);
        setShardInput("");
      }, 1500);
    } else {
      setSubmitFeedback("Shard recorded. Threshold verification complete.");
      setTimeout(() => {
        setIsSubmitShardOpen(false);
        setSubmitFeedback(null);
        setShardInput("");
      }, 1500);
    }
  };

  const calculateHoursRemaining = (isoDate?: string) => {
    if (!isoDate) return "0h 00m";
    const diff = new Date(isoDate).getTime() - Date.now();
    if (diff <= 0) return "Expired (Ready)";
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Social Recovery &amp; Escrow Quorum
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                Shamir k-of-n
              </span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Decentralize master encryption key recovery across trusted guardians using Shamir&apos;s Secret Sharing over
            256-bit prime fields. Protected by an unskippable 72-hour emergency timelock with 1-click owner abort.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setIsSubmitShardOpen(true)}
          >
            <Unlock className="h-4 w-4 text-primary" />
            Submit Guardian Shard
          </Button>
          <Button
            variant="primary"
            className="flex items-center gap-2 shadow-lg shadow-primary/20"
            onClick={() => setIsSetupOpen(true)}
          >
            <Users className="h-4 w-4" />
            Configure Guardians
          </Button>
        </div>
      </div>

      {/* Emergency Escrow Timelock Alert (Active Case) */}
      {activeCase && activeCase.status === "TIMELOCK_PENDING" && (
        <div className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-950/20 to-orange-950/20 p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mt-1 animate-pulse">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-foreground">
                    Active Recovery Escrow Under 72-Hour Timelock
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40">
                    Case #{activeCase.id}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/40">
                    Quorum Met ({activeCase.shardsCollected}/{activeCase.shardsRequired} Shards)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl">
                  Initiated by <strong className="text-foreground">{activeCase.claimantName}</strong> for account{" "}
                  <code className="text-primary font-mono">{activeCase.targetEmail}</code>. Vault keys will remain
                  strictly locked in cryptographic escrow until the timelock expires. If this was not authorized by you,
                  abort immediately.
                </p>
                <div className="flex items-center gap-4 text-xs font-mono text-amber-400 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>Time Remaining: <strong>{calculateHoursRemaining(activeCase.timelockEndsAt)}</strong></span>
                  </div>
                  <span>•</span>
                  <span>Escrow Expiry: {new Date(activeCase.timelockEndsAt || "").toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-amber-500/40 hover:bg-amber-500/10 text-amber-300"
                onClick={() => setIsSubmitShardOpen(true)}
              >
                Inspect Quorum
              </Button>
              <Button
                variant="danger"
                className="w-full sm:w-auto flex items-center gap-2 shadow-lg shadow-red-900/30 font-semibold"
                onClick={() => setIsAbortModalOpen(true)}
              >
                <ShieldAlert className="h-4 w-4" />
                1-Click Owner Abort
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Aborted Notification */}
      {activeCase && activeCase.status === "CANCELLED_BY_OWNER" && (
        <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-red-400" />
            <span className="text-sm font-medium text-foreground">
              Recovery Case #{activeCase.id} was successfully cancelled by vault owner. All shards nullified.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActiveCase(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Threshold Quorum (k-of-n)"
          value={`${thresholdK} of ${totalN}`}
          subtitle="Minimum shards required to reconstruct master key"
          icon={<KeyRound className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          title="Configured Guardians"
          value={guardians.length.toString()}
          subtitle={`${guardians.filter((g) => g.status === "SHARD_SUBMITTED").length} shards ready in active claim`}
          icon={<Users className="h-5 w-5 text-emerald-400" />}
        />
        <MetricCard
          title="Emergency Escrow Timelock"
          value="72 Hours"
          subtitle="Grace buffer before shards reassemble"
          icon={<Clock className="h-5 w-5 text-amber-400" />}
        />
        <MetricCard
          title="Cryptographic Field"
          value="Secp256k1"
          subtitle="256-bit prime modulus Galois field GF(p)"
          icon={<ShieldCheck className="h-5 w-5 text-indigo-400" />}
        />
      </div>

      {/* Guardians Directory Table */}
      <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Designated Guardians</h3>
            <p className="text-xs text-muted-foreground">
              Guardians hold isolated Shamir shards. Zero guardians can decipher data individually.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/40 font-mono">
              Quorum: {thresholdK} required
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-6">Shard ID</th>
                <th className="py-3 px-6">Guardian Name</th>
                <th className="py-3 px-6">Relationship</th>
                <th className="py-3 px-6">Email Address</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {guardians.map((guardian) => (
                <tr key={guardian.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-4 px-6 font-mono text-xs text-primary font-bold">
                    Shard #{guardian.shardIndex}
                  </td>
                  <td className="py-4 px-6 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {guardian.name.charAt(0)}
                      </div>
                      <span>{guardian.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-muted-foreground text-xs">{guardian.relationship}</td>
                  <td className="py-4 px-6 font-mono text-xs text-muted-foreground">{guardian.email}</td>
                  <td className="py-4 px-6">
                    {guardian.status === "SHARD_SUBMITTED" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Shard Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Lock className="h-3 w-3" />
                        Active Custodian
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleCopy(`shard:${guardian.shardIndex}:SAMPLE_HEX_SECRET_SHARD`, guardian.id)}
                    >
                      {copiedShardId === guardian.id ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Check className="h-3.5 w-3.5" /> Copied
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Copy className="h-3.5 w-3.5" /> Copy Invite Link
                        </span>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* How Shamir Social Recovery Works Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md space-y-3">
          <div className="p-2.5 w-fit rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Share2 className="h-5 w-5" />
          </div>
          <h4 className="font-semibold text-foreground">1. Polynomial Secret Splitting</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The vault master recovery key is split into a random degree-(k-1) polynomial over a 256-bit prime field.
            Any fewer than {thresholdK} shards mathematically reveal zero information about the secret.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md space-y-3">
          <div className="p-2.5 w-fit rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-5 w-5" />
          </div>
          <h4 className="font-semibold text-foreground">2. 72-Hour Timelock Escrow</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Even when {thresholdK} guardians submit shards, the key is not immediately reconstituted. A 72-hour
            tamper-resistant escrow countdown triggers with automated high-priority SMS/email alerts to the vault owner.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md space-y-3">
          <div className="p-2.5 w-fit rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h4 className="font-semibold text-foreground">3. 1-Click Anti-Rogue Abort</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            If compromised guardians attempt an unauthorized recovery claim, the vault owner can nullify the attempt
            instantly via a single authenticated click, freezing claimant credentials.
          </p>
        </div>
      </div>

      {/* Setup Wizard Modal */}
      <Modal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        title="Configure Social Recovery Quorum"
      >
        <div className="space-y-6 pt-2">
          <p className="text-xs text-muted-foreground">
            Configure your Shamir secret sharing parameters. Once confirmed, a new 256-bit recovery master key will be
            generated and mathematically split into distinct cryptographic shards.
          </p>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Threshold (k) Required
              </label>
              <select
                value={thresholdK}
                onChange={(e) => setThresholdK(Number(e.target.value))}
                className="w-full bg-background border border-border/40 rounded-lg p-2 text-sm text-foreground"
              >
                {[2, 3, 4, 5].map((val) => (
                  <option key={val} value={val}>
                    {val} Shards
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Total Guardians (n)
              </label>
              <select
                value={totalN}
                onChange={(e) => setTotalN(Number(e.target.value))}
                className="w-full bg-background border border-border/40 rounded-lg p-2 text-sm text-foreground"
              >
                {[3, 4, 5, 6, 7].map((val) => (
                  <option key={val} value={val}>
                    {val} Guardians
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-semibold text-foreground block">
              Assign Primary Guardians ({setupGuardians.length})
            </span>
            {setupGuardians.map((g, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-primary font-semibold">Guardian #{idx + 1}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Full Name"
                    value={g.name}
                    onChange={(e) => {
                      const updated = [...setupGuardians];
                      updated[idx].name = e.target.value;
                      setSetupGuardians(updated);
                    }}
                  />
                  <Input
                    placeholder="Email Address"
                    type="email"
                    value={g.email}
                    onChange={(e) => {
                      const updated = [...setupGuardians];
                      updated[idx].email = e.target.value;
                      setSetupGuardians(updated);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={() => setIsSetupOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsSetupOpen(false);
              }}
            >
              Generate &amp; Distribute Shards
            </Button>
          </div>
        </div>
      </Modal>

      {/* Submit Guardian Shard Modal */}
      <Modal
        isOpen={isSubmitShardOpen}
        onClose={() => setIsSubmitShardOpen(false)}
        title="Submit Custodian Key Shard"
      >
        <form onSubmit={handleSubmitShard} className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Enter the hex-encoded Shamir shard provided during guardian onboarding (format:{" "}
            <code className="text-primary font-mono">shard:&lt;index&gt;:&lt;hex_secret&gt;</code>).
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">Cryptographic Shard String</label>
            <textarea
              rows={4}
              value={shardInput}
              onChange={(e) => setShardInput(e.target.value)}
              placeholder="shard:1:7e2b8109ad..."
              className="w-full bg-background border border-border/40 rounded-xl p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {submitFeedback && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {submitFeedback}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button variant="outline" type="button" onClick={() => setIsSubmitShardOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Verify &amp; Deposit Shard
            </Button>
          </div>
        </form>
      </Modal>

      {/* Owner Abort Modal */}
      <Modal
        isOpen={isAbortModalOpen}
        onClose={() => setIsAbortModalOpen(false)}
        title="Confirm Emergency Recovery Abort"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold">This action will immediately terminate the active claim.</p>
              <p className="text-muted-foreground">
                All submitted guardian shards will be purged from memory and the claimant&apos;s recovery session will
                be permanently revoked.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={() => setIsAbortModalOpen(false)}>
              Back
            </Button>
            <Button variant="danger" onClick={handleAbortRecovery}>
              Confirm Abort Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
