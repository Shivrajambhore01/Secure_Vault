"use client";

import * as React from "react";
import {
  FileText,
  ShieldCheck,
  Clock,
  Users,
  Calendar,
  Lock,
  Plus,
  Trash2,
  Edit,
  Play,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ChevronRight,
  Info,
  Check,
  X,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  Modal,
  Drawer,
  StatusBadge,
  MetricCard,
  EmptyState,
} from "@/components/design-system";

interface Policy {
  id: string;
  name: string;
  description: string;
  conditionType: "IMMEDIATE_ON_TRIGGER" | "AFTER_COOLING_PERIOD" | "MULTI_APPROVAL" | "DATE_LOCKED";
  coolingPeriodDays: number;
  requiredApprovalsCount: number;
  authorizedApproverIds: string[];
  unlockDate?: string;
  assetIds: string[];
  beneficiaryIds: string[];
  approvals: Array<{
    id: string;
    approverId: string;
    approverName: string;
    approvedAt: string;
    notes?: string;
  }>;
  status: "ACTIVE" | "FULFILLED" | "PAUSED";
  version: number;
  createdAt: string;
}

interface VaultAsset {
  id: string;
  title: string;
  category: string;
}

interface Beneficiary {
  id: string;
  name: string;
  relationship: string;
}

export default function LegacyPoliciesPage() {
  const [policies, setPolicies] = React.useState<Policy[]>([
    {
      id: "pol_demo_01",
      name: "Primary Heirs Instant Unlock",
      description: "Direct release of primary living documents upon verified switch trigger.",
      conditionType: "IMMEDIATE_ON_TRIGGER",
      coolingPeriodDays: 14,
      requiredApprovalsCount: 1,
      authorizedApproverIds: ["nom_demo_01"],
      assetIds: ["ast_demo_01", "ast_demo_02"],
      beneficiaryIds: ["nom_demo_01"],
      approvals: [],
      status: "ACTIVE",
      version: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: "pol_demo_02",
      name: "Cold Storage Dual-Key Consensus",
      description: "Requires 2 out of 3 authorized trustees before crypto keys can decrypt.",
      conditionType: "MULTI_APPROVAL",
      coolingPeriodDays: 14,
      requiredApprovalsCount: 2,
      authorizedApproverIds: ["nom_demo_01", "nom_demo_02"],
      assetIds: ["ast_demo_03"],
      beneficiaryIds: ["nom_demo_01", "nom_demo_02"],
      approvals: [
        {
          id: "appr_01",
          approverId: "nom_demo_01",
          approverName: "Eleanor Vance (Spouse)",
          approvedAt: new Date(Date.now() - 3600000).toISOString(),
          notes: "Executor identity verified.",
        },
      ],
      status: "ACTIVE",
      version: 2,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "pol_demo_03",
      name: "Milestone Trust: 21st Birthday",
      description: "Locked until beneficiary reaches majority age on October 15, 2028.",
      conditionType: "DATE_LOCKED",
      coolingPeriodDays: 14,
      requiredApprovalsCount: 1,
      authorizedApproverIds: [],
      unlockDate: "2028-10-15T00:00:00Z",
      assetIds: ["ast_demo_04"],
      beneficiaryIds: ["nom_demo_03"],
      approvals: [],
      status: "ACTIVE",
      version: 1,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ]);

  // Mock available assets & nominees for pickers
  const availableAssets: VaultAsset[] = [
    { id: "ast_demo_01", title: "Residential Deed & Property Title", category: "LEGAL" },
    { id: "ast_demo_02", title: "Primary Family Banking Portal", category: "FINANCIAL" },
    { id: "ast_demo_03", title: "Bitcoin Hardware Multi-Sig Seed", category: "CRYPTO" },
    { id: "ast_demo_04", title: "Offshore College Trust Account", category: "FINANCIAL" },
    { id: "ast_demo_05", title: "Master Cloud Infrastructure Credentials", category: "CREDENTIALS" },
  ];

  const availableBeneficiaries: Beneficiary[] = [
    { id: "nom_demo_01", name: "Eleanor Vance", relationship: "Spouse (Primary)" },
    { id: "nom_demo_02", name: "Marcus Vance", relationship: "Brother (Executor)" },
    { id: "nom_demo_03", name: "Chloe Vance", relationship: "Daughter (Contingent)" },
  ];

  const [isLoading, setIsLoading] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showSimulateDrawer, setShowSimulateDrawer] = React.useState(false);
  const [selectedPolicyForSim, setSelectedPolicyForSim] = React.useState<Policy | null>(null);

  // Form State
  const [policyName, setPolicyName] = React.useState("");
  const [policyDescription, setPolicyDescription] = React.useState("");
  const [conditionType, setConditionType] = React.useState<Policy["conditionType"]>("IMMEDIATE_ON_TRIGGER");
  const [coolingDays, setCoolingDays] = React.useState("14");
  const [approvalsCount, setApprovalsCount] = React.useState("2");
  const [unlockDate, setUnlockDate] = React.useState("");
  const [selectedAssets, setSelectedAssets] = React.useState<string[]>([]);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = React.useState<string[]>([]);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Simulation State
  const [simSwitchTriggered, setSimSwitchTriggered] = React.useState(true);
  const [simDaysSinceTrigger, setSimDaysSinceTrigger] = React.useState("5");
  const [simApprovalsCount, setSimApprovalsCount] = React.useState(1);
  const [simResult, setSimResult] = React.useState<{ is_unlocked: boolean; reason: string } | null>(null);

  // Fetch policies
  const fetchPolicies = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/policies");
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          setPolicies(data.data);
        }
      }
    } catch {
      // Keep demo policies if offline
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // Create Policy Handler
  const handleCreatePolicy = async () => {
    if (!policyName.trim()) return;
    setIsLoading(true);

    const payload = {
      name: policyName,
      description: policyDescription,
      condition_type: conditionType,
      cooling_period_days: parseInt(coolingDays, 10) || 14,
      required_approvals_count: parseInt(approvalsCount, 10) || 2,
      authorized_approver_ids: selectedBeneficiaries,
      unlock_date: conditionType === "DATE_LOCKED" ? unlockDate : undefined,
      asset_ids: selectedAssets,
      beneficiary_ids: selectedBeneficiaries,
    };

    try {
      const res = await fetch("/api/v1/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setPolicies((prev) => [data.data, ...prev]);
        setActionSuccess("Release policy defined and activated successfully.");
      } else {
        // Optimistic local add
        const newPolicy: Policy = {
          id: `pol_${Date.now()}`,
          name: payload.name,
          description: payload.description,
          conditionType: payload.condition_type as any,
          coolingPeriodDays: payload.cooling_period_days,
          requiredApprovalsCount: payload.required_approvals_count,
          authorizedApproverIds: payload.authorized_approver_ids,
          unlockDate: payload.unlock_date,
          assetIds: payload.asset_ids,
          beneficiaryIds: payload.beneficiary_ids,
          approvals: [],
          status: "ACTIVE",
          version: 1,
          createdAt: new Date().toISOString(),
        };
        setPolicies((prev) => [newPolicy, ...prev]);
        setActionSuccess("Policy saved in current session.");
      }
    } catch {
      setActionSuccess("Policy created.");
    } finally {
      setIsLoading(false);
      setShowCreateModal(false);
      resetForm();
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      await fetch(`/api/v1/policies/${id}`, { method: "DELETE" });
    } catch {
      // Ignore
    }
    setPolicies((prev) => prev.filter((p) => p.id !== id));
    setActionSuccess("Policy deleted and detached from vault assets.");
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const resetForm = () => {
    setPolicyName("");
    setPolicyDescription("");
    setConditionType("IMMEDIATE_ON_TRIGGER");
    setCoolingDays("14");
    setApprovalsCount("2");
    setUnlockDate("");
    setSelectedAssets([]);
    setSelectedBeneficiaries([]);
  };

  // Toggle selection helpers
  const toggleAsset = (id: string) => {
    setSelectedAssets((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const toggleBeneficiary = (id: string) => {
    setSelectedBeneficiaries((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  // Simulator Evaluator
  const runSimulation = () => {
    if (!selectedPolicyForSim) return;

    if (selectedPolicyForSim.conditionType === "IMMEDIATE_ON_TRIGGER") {
      setSimResult({
        is_unlocked: simSwitchTriggered,
        reason: simSwitchTriggered
          ? "Immediate unlock: Switch trigger verified."
          : "Locked: Inactivity switch has not been triggered.",
      });
    } else if (selectedPolicyForSim.conditionType === "AFTER_COOLING_PERIOD") {
      const elapsed = parseInt(simDaysSinceTrigger, 10) || 0;
      const buffer = selectedPolicyForSim.coolingPeriodDays || 14;
      if (!simSwitchTriggered) {
        setSimResult({ is_unlocked: false, reason: "Locked: Standby inactivity switch has not triggered." });
      } else if (elapsed < buffer) {
        setSimResult({
          is_unlocked: false,
          reason: `Cooling buffer active: ${elapsed}/${buffer} days elapsed. ${buffer - elapsed} days remaining.`,
        });
      } else {
        setSimResult({ is_unlocked: true, reason: `Cooling period complete (${elapsed} days >= ${buffer} days). Keys decrypted.` });
      }
    } else if (selectedPolicyForSim.conditionType === "MULTI_APPROVAL") {
      const req = selectedPolicyForSim.requiredApprovalsCount || 2;
      if (simApprovalsCount >= req) {
        setSimResult({ is_unlocked: true, reason: `Consensus reached: ${simApprovalsCount}/${req} approvals confirmed.` });
      } else {
        setSimResult({
          is_unlocked: false,
          reason: `Consensus pending: ${simApprovalsCount}/${req} approvals recorded (${req - simApprovalsCount} needed).`,
        });
      }
    } else if (selectedPolicyForSim.conditionType === "DATE_LOCKED") {
      const targetDate = selectedPolicyForSim.unlockDate ? new Date(selectedPolicyForSim.unlockDate) : new Date();
      const isPast = Date.now() >= targetDate.getTime();
      setSimResult({
        is_unlocked: isPast,
        reason: isPast
          ? `Milestone date reached (${targetDate.toLocaleDateString()}). Unlocked.`
          : `Locked until ${targetDate.toLocaleDateString()}. Time capsule active.`,
      });
    }
  };

  // Metrics computation
  const totalPolicies = policies.length;
  const multiApprovalCount = policies.filter((p) => p.conditionType === "MULTI_APPROVAL").length;
  const dateLockedCount = policies.filter((p) => p.conditionType === "DATE_LOCKED").length;
  const coveredAssetsCount = new Set(policies.flatMap((p) => p.assetIds)).size;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <FileText className="w-6 h-6 text-purple-400" />
              Legacy Planning & Release Policies
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300 font-mono">
              Policy Engine v1
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Establish granular cryptographic conditions governing asset disclosure: cooling buffers, M-of-N consensus, and future milestone locks.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="bg-purple-600 hover:bg-purple-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Define Release Policy
        </Button>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Active Directives"
          value={totalPolicies}
          subtitle="Enforced release policies"
          icon={<ShieldCheck className="w-5 h-5 text-purple-400" />}
        />
        <MetricCard
          title="Multi-Party Consensus"
          value={multiApprovalCount}
          subtitle="M-of-N guarded policies"
          icon={<Users className="w-5 h-5 text-indigo-400" />}
          trend={{ value: `${multiApprovalCount} active`, isPositive: true }}
        />
        <MetricCard
          title="Milestone Time Locks"
          value={dateLockedCount}
          subtitle="Future calendar directives"
          icon={<Calendar className="w-5 h-5 text-amber-400" />}
        />
        <MetricCard
          title="Guarded Assets"
          value={coveredAssetsCount}
          subtitle={`Across ${availableAssets.length} total vault assets`}
          icon={<Layers className="w-5 h-5 text-emerald-400" />}
        />
      </div>

      {/* Policy List Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400" />
            Configured Release Policies
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            {policies.length} Directives Registered
          </span>
        </div>

        {policies.length === 0 ? (
          <EmptyState
            title="No Release Policies Defined"
            description="Create your first cryptographic inheritance policy to dictate how and when beneficiaries receive access."
            icon={<FileText className="w-8 h-8 text-zinc-600" />}
            actionLabel="Create First Policy"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {policies.map((policy) => {
              const conditionBadge = {
                IMMEDIATE_ON_TRIGGER: { label: "Immediate on Trigger", variant: "active" as const },
                AFTER_COOLING_PERIOD: { label: `${policy.coolingPeriodDays}-Day Buffer`, variant: "cooling" as const },
                MULTI_APPROVAL: { label: `${policy.requiredApprovalsCount}-of-N Consensus`, variant: "warning" as const },
                DATE_LOCKED: { label: "Milestone Time Lock", variant: "pending" as const },
              }[policy.conditionType];

              return (
                <div
                  key={policy.id}
                  className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">{policy.name}</h3>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                          {policy.description || "No directive notes provided."}
                        </p>
                      </div>
                      <StatusBadge status={conditionBadge.label} variant={conditionBadge.variant} />
                    </div>

                    {/* Condition details card */}
                    <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="text-zinc-500">Directive Mode:</span>
                        <span className="font-mono text-purple-300">{policy.conditionType}</span>
                      </div>

                      {policy.conditionType === "MULTI_APPROVAL" && (
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="text-zinc-500">Approvals Progress:</span>
                          <span className="font-mono text-amber-300">
                            {policy.approvals.length} / {policy.requiredApprovalsCount} Recorded
                          </span>
                        </div>
                      )}

                      {policy.conditionType === "DATE_LOCKED" && (
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="text-zinc-500">Unlock Milestone:</span>
                          <span className="font-mono text-indigo-300">
                            {policy.unlockDate ? new Date(policy.unlockDate).toLocaleDateString() : "TBD"}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="text-zinc-500">Attached Assets:</span>
                        <span className="font-mono text-zinc-200">{policy.assetIds.length} Assets</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-xs">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedPolicyForSim(policy);
                        setSimApprovalsCount(policy.approvals.length);
                        setSimResult(null);
                        setShowSimulateDrawer(true);
                      }}
                      className="text-purple-400 hover:text-purple-300 px-2 py-1 h-auto"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Simulate Rule
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => handleDeletePolicy(policy.id)}
                      className="text-red-400 hover:text-red-300 px-2 py-1 h-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Policy Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Establish Legacy Release Policy"
        maxWidth="lg"
      >
        <div className="space-y-5 pt-2 max-h-[75vh] overflow-y-auto pr-1 text-left">
          <Input
            label="Policy Name"
            placeholder="e.g. Primary Residence & Living Trust Directive"
            value={policyName}
            onChange={(e) => setPolicyName(e.target.value)}
            helperText="Clear identifier displayed to trustees and executors."
          />

          <Input
            label="Policy Description / Directives"
            placeholder="Specific instructions, legal will reference, or probate notes..."
            value={policyDescription}
            onChange={(e) => setPolicyDescription(e.target.value)}
          />

          <Select
            label="Release Condition Directive"
            value={conditionType}
            onChange={(e) => setConditionType(e.target.value as any)}
            options={[
              { label: "Immediate on Switch Trigger (Standard)", value: "IMMEDIATE_ON_TRIGGER" },
              { label: "After Inactivity Cooling Buffer", value: "AFTER_COOLING_PERIOD" },
              { label: "Multi-Party Consensus (M-of-N Signatures)", value: "MULTI_APPROVAL" },
              { label: "Milestone Time Lock (Future Calendar Date)", value: "DATE_LOCKED" },
            ]}
          />

          {/* Conditional Input: Cooling Period */}
          {conditionType === "AFTER_COOLING_PERIOD" && (
            <Select
              label="Cooling Buffer Period"
              value={coolingDays}
              onChange={(e) => setCoolingDays(e.target.value)}
              options={[
                { label: "7 Days Buffer", value: "7" },
                { label: "14 Days Buffer (Standard)", value: "14" },
                { label: "30 Days Buffer (High Caution)", value: "30" },
                { label: "60 Days Buffer", value: "60" },
              ]}
              helperText="Days to wait after Dead Man's Switch standby window expires before decrypting."
            />
          )}

          {/* Conditional Input: Multi-Party Consensus */}
          {conditionType === "MULTI_APPROVAL" && (
            <div className="space-y-3 p-4 rounded-xl bg-purple-950/20 border border-purple-800/30">
              <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                M-of-N Consensus Threshold
              </h4>
              <Select
                label="Required Distinct Signatures (M)"
                value={approvalsCount}
                onChange={(e) => setApprovalsCount(e.target.value)}
                options={[
                  { label: "1 Approval (Single Executor)", value: "1" },
                  { label: "2 Approvals (Dual-Key Consensus)", value: "2" },
                  { label: "3 Approvals (Family Majority)", value: "3" },
                ]}
                helperText="How many authorized trustees or nominees must verify the release."
              />
            </div>
          )}

          {/* Conditional Input: Date Lock */}
          {conditionType === "DATE_LOCKED" && (
            <Input
              label="Unlock Calendar Date (UTC)"
              type="date"
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
              helperText="Asset DEK remains cryptographically sealed until this date arrives."
            />
          )}

          {/* Asset Multi-Picker */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">
              Select Governed Assets ({selectedAssets.length} selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-zinc-950/60 rounded-xl border border-zinc-800">
              {availableAssets.map((asset) => {
                const isSelected = selectedAssets.includes(asset.id);
                return (
                  <div
                    key={asset.id}
                    onClick={() => toggleAsset(asset.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-purple-950/40 border-purple-500/60 text-zinc-100"
                        : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <span className="truncate">{asset.title}</span>
                    {isSelected && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Beneficiary Assignment */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">
              Authorized Beneficiaries / Trustees ({selectedBeneficiaries.length} selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-zinc-950/60 rounded-xl border border-zinc-800">
              {availableBeneficiaries.map((ben) => {
                const isSelected = selectedBeneficiaries.includes(ben.id);
                return (
                  <div
                    key={ben.id}
                    onClick={() => toggleBeneficiary(ben.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-950/40 border-indigo-500/60 text-zinc-100"
                        : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      <div className="font-medium text-zinc-200">{ben.name}</div>
                      <div className="text-[10px] text-zinc-500">{ben.relationship}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreatePolicy}
              isLoading={isLoading}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              Activate Policy Directive
            </Button>
          </div>
        </div>
      </Modal>

      {/* Policy Simulation Drawer */}
      <Drawer
        isOpen={showSimulateDrawer}
        onClose={() => setShowSimulateDrawer(false)}
        title="Policy Verification Sandbox"
        width="md"
      >
        {selectedPolicyForSim && (
          <div className="space-y-6 pt-2 text-left">
            <p className="text-xs text-zinc-400">
              Simulate environment variables to test whether cryptographic decryption keys will release.
            </p>
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
              <h4 className="text-sm font-semibold text-zinc-200">{selectedPolicyForSim.name}</h4>
              <p className="text-xs text-zinc-400">{selectedPolicyForSim.description}</p>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-zinc-500">Condition Mode:</span>
                <span className="text-xs font-mono text-purple-300">{selectedPolicyForSim.conditionType}</span>
              </div>
            </div>

            {/* Simulation Controls */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Simulated Test Parameters
              </h5>

              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                <span className="text-xs text-zinc-300">Switch Inactivity Triggered</span>
                <input
                  type="checkbox"
                  checked={simSwitchTriggered}
                  onChange={(e) => setSimSwitchTriggered(e.target.checked)}
                  className="w-4 h-4 accent-purple-500 cursor-pointer"
                />
              </div>

              {selectedPolicyForSim.conditionType === "AFTER_COOLING_PERIOD" && (
                <Input
                  label="Days Elapsed Since Switch Triggered"
                  type="number"
                  value={simDaysSinceTrigger}
                  onChange={(e) => setSimDaysSinceTrigger(e.target.value)}
                  helperText={`Requires >= ${selectedPolicyForSim.coolingPeriodDays} days to unlock.`}
                />
              )}

              {selectedPolicyForSim.conditionType === "MULTI_APPROVAL" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Simulated Approvals Recorded ({simApprovalsCount} / {selectedPolicyForSim.requiredApprovalsCount})
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setSimApprovalsCount((p) => Math.max(0, p - 1))}
                      className="px-3 py-1 text-xs"
                    >
                      -1 Approval
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSimApprovalsCount((p) => p + 1)}
                      className="px-3 py-1 text-xs"
                    >
                      +1 Approval
                    </Button>
                  </div>
                </div>
              )}

              <Button variant="primary" onClick={runSimulation} className="w-full bg-indigo-600 hover:bg-indigo-500">
                <Play className="w-4 h-4 mr-2" />
                Evaluate Directive Condition
              </Button>
            </div>

            {/* Simulation Evaluation Output */}
            {simResult && (
              <div
                className={`p-4 rounded-xl border space-y-2 ${
                  simResult.is_unlocked
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {simResult.is_unlocked ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>DECRYPTION AUTHORIZED (KEYS UNLOCKED)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      <span>ACCESS DENIED (KEYS SEALED)</span>
                    </>
                  )}
                </div>
                <p className="text-xs leading-relaxed">{simResult.reason}</p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
