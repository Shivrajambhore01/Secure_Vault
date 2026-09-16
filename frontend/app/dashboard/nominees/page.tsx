"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Mail,
  Phone,
  Share2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Trash2,
  Sliders,
  Check,
  Search,
  LayoutGrid,
  List,
  Clock,
  ShieldAlert,
  Percent,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  Modal,
  Drawer,
  DataTable,
  StatusBadge,
  MetricCard,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from "@/components/design-system";
import { secureFetch, extractErrorMessage, API_BASE } from "@/lib/api";
import { toast } from "sonner";

interface AllocationItem {
  assetId: string;
  sharePercentage: number;
  releaseCondition: string;
}

interface Nominee {
  id: string;
  name: string;
  email: string;
  relationship: string;
  phone?: string;
  tier: "PRIMARY" | "CONTINGENT" | "EXECUTOR" | "GUARDIAN";
  status: "INVITED" | "ACCEPTED" | "VERIFIED" | "REJECTED" | "REVOKED";
  invitationToken?: string;
  allocatedAssetCount?: number;
  assetAllocations?: AllocationItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface AllocationMatrix {
  total_nominees: number;
  total_assets: number;
  covered_assets: number;
  unallocated_assets_count: number;
  coverage_percentage: number;
  nominees: any[];
  assets: any[];
}

interface VaultAsset {
  id: string;
  name: string;
  type: string;
  sensitivity?: string;
}

const RELATIONSHIPS = [
  { value: "Spouse", label: "Spouse / Partner" },
  { value: "Child", label: "Child / Dependent" },
  { value: "Parent", label: "Parent / Elder" },
  { value: "Sibling", label: "Sibling" },
  { value: "Attorney", label: "Attorney / Legal Counsel" },
  { value: "Trustee", label: "Trustee / Fiduciary" },
  { value: "Business Partner", label: "Business Partner" },
  { value: "Friend", label: "Friend" },
  { value: "Other", label: "Other" },
];

const TIERS = [
  { value: "ALL", label: "All Tiers" },
  { value: "PRIMARY", label: "Primary Heir" },
  { value: "CONTINGENT", label: "Contingent (Fallback)" },
  { value: "EXECUTOR", label: "Executor / Guardian" },
];

export default function NomineesPage() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedTier, setSelectedTier] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Nominees and Matrix Data
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [matrix, setMatrix] = useState<AllocationMatrix | null>(null);
  const [vaultAssets, setVaultAssets] = useState<VaultAsset[]>([]);

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNominee, setEditingNominee] = useState<Nominee | null>(null);
  const [nomineeName, setNomineeName] = useState("");
  const [nomineeEmail, setNomineeEmail] = useState("");
  const [nomineeRelationship, setNomineeRelationship] = useState("Spouse");
  const [nomineePhone, setNomineePhone] = useState("");
  const [nomineeTier, setNomineeTier] = useState<string>("PRIMARY");
  const [nomineeNotes, setNomineeNotes] = useState("");
  const [savingNominee, setSavingNominee] = useState(false);

  // Allocation Drawer
  const [allocationDrawerOpen, setAllocationDrawerOpen] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState<Nominee | null>(null);
  const [currentAllocations, setCurrentAllocations] = useState<AllocationItem[]>([]);
  const [savingAllocations, setSavingAllocations] = useState(false);

  // Revoke Dialog
  const [revokeTarget, setRevokeTarget] = useState<Nominee | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Delete Dialog
  const [deleteTarget, setDeleteTarget] = useState<Nominee | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchNomineesAndMatrix();
  }, [selectedTier]);

  const fetchNomineesAndMatrix = async () => {
    setLoading(true);
    try {
      // 1. List nominees
      let url = "/v1/nominees";
      if (selectedTier !== "ALL") url += `?tier=${selectedTier}`;
      const res = await secureFetch(url);
      if (res.ok) {
        const json = await res.json();
        setNominees(json.data || []);
      }

      // 2. Allocation matrix
      const matRes = await secureFetch("/v1/nominees/matrix");
      if (matRes.ok) {
        const matJson = await matRes.json();
        setMatrix(matJson.data);
      }

      // 3. Vault assets for allocation drawer
      const assetsRes = await secureFetch("/v1/assets?page=1&page_size=200");
      if (assetsRes.ok) {
        const assetsJson = await assetsRes.json();
        setVaultAssets(assetsJson.data || []);
      }
    } catch {
      toast.error("Failed to load beneficiaries");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingNominee(null);
    setNomineeName("");
    setNomineeEmail("");
    setNomineeRelationship("Spouse");
    setNomineePhone("");
    setNomineeTier("PRIMARY");
    setNomineeNotes("");
    setModalOpen(true);
  };

  const handleOpenEditModal = (nom: Nominee) => {
    setEditingNominee(nom);
    setNomineeName(nom.name);
    setNomineeEmail(nom.email);
    setNomineeRelationship(nom.relationship);
    setNomineePhone(nom.phone || "");
    setNomineeTier(nom.tier);
    setNomineeNotes(nom.notes || "");
    setModalOpen(true);
  };

  const handleSaveNominee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomineeName.trim() || !nomineeEmail.trim()) {
      toast.error("Name and Email are required");
      return;
    }

    setSavingNominee(true);
    try {
      const payload = {
        id: editingNominee ? editingNominee.id : undefined,
        name: nomineeName.trim(),
        email: nomineeEmail.trim(),
        relationship: nomineeRelationship,
        phone: nomineePhone.trim() || undefined,
        tier: nomineeTier,
        notes: nomineeNotes.trim() || undefined,
      };

      const res = await secureFetch("/v1/nominees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(json, "Failed to save nominee"));

      toast.success(editingNominee ? "Nominee updated" : "Nominee enrolled & invitation issued");
      setModalOpen(false);
      fetchNomineesAndMatrix();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingNominee(false);
    }
  };

  const handleResendInvite = async (nomineeId: string) => {
    try {
      const res = await secureFetch(`/v1/nominees/${nomineeId}/invite`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(json, "Failed to resend invite"));

      toast.success("New invitation token generated");
      fetchNomineesAndMatrix();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCopyInviteLink = (token?: string) => {
    if (!token) {
      toast.error("No active invitation token for this beneficiary");
      return;
    }
    const fullUrl = `${window.location.origin}/nominee/invite/${token}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Invitation link copied to clipboard");
  };

  // Open Allocation Drawer
  const handleOpenAllocations = (nom: Nominee) => {
    setSelectedNominee(nom);
    setCurrentAllocations(nom.assetAllocations || []);
    setAllocationDrawerOpen(true);
  };

  const toggleAssetAllocation = (assetId: string) => {
    setCurrentAllocations((prev) => {
      const exists = prev.find((a) => a.assetId === assetId);
      if (exists) {
        return prev.filter((a) => a.assetId !== assetId);
      } else {
        return [
          ...prev,
          { assetId, sharePercentage: 100.0, releaseCondition: "IMMEDIATE_ON_CLAIM" },
        ];
      }
    });
  };

  const updateAssetShare = (assetId: string, share: number) => {
    setCurrentAllocations((prev) =>
      prev.map((a) => (a.assetId === assetId ? { ...a, sharePercentage: share } : a))
    );
  };

  const updateAssetCondition = (assetId: string, condition: string) => {
    setCurrentAllocations((prev) =>
      prev.map((a) => (a.assetId === assetId ? { ...a, releaseCondition: condition } : a))
    );
  };

  const handleSaveAllocations = async () => {
    if (!selectedNominee) return;
    setSavingAllocations(true);
    try {
      const res = await secureFetch(`/v1/nominees/${selectedNominee.id}/allocations`, {
        method: "POST",
        body: JSON.stringify({ allocations: currentAllocations }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(json, "Failed to update allocations"));

      toast.success("Asset allocation matrix synchronized");
      setAllocationDrawerOpen(false);
      fetchNomineesAndMatrix();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingAllocations(false);
    }
  };

  const handleRevokeNominee = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await secureFetch(`/v1/nominees/${revokeTarget.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason: "Revoked from Beneficiary Command Center" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(json, "Revoke failed"));

      toast.success("Beneficiary entitlement revoked and unlinked from assets");
      setRevokeTarget(null);
      fetchNomineesAndMatrix();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRevoking(false);
    }
  };

  const handleDeleteNominee = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await secureFetch(`/v1/nominees/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove nominee");

      toast.success("Beneficiary removed");
      setDeleteTarget(null);
      fetchNomineesAndMatrix();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredNominees = useMemo(() => {
    if (!searchQuery.trim()) return nominees;
    const q = searchQuery.toLowerCase();
    return nominees.filter(
      (n) =>
        (n?.name || "").toLowerCase().includes(q) ||
        (n?.email || "").toLowerCase().includes(q) ||
        (n?.relationship || "").toLowerCase().includes(q)
    );
  }, [nominees, searchQuery]);

  const primaryCount = useMemo(() => nominees.filter((n) => n.tier === "PRIMARY").length, [nominees]);
  const contingentCount = useMemo(() => nominees.filter((n) => n.tier === "CONTINGENT").length, [nominees]);

  const tableColumns = [
    {
      header: "Beneficiary",
      accessorKey: "name",
      cell: (n: Nominee) => (
        <div>
          <div className="font-semibold text-black">{n?.name || "Unnamed"}</div>
          <div className="text-xs text-neutral-500">{n?.email || "No email"}</div>
        </div>
      ),
    },
    {
      header: "Relationship",
      accessorKey: "relationship",
      cell: (n: Nominee) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs bg-neutral-100 border border-black/5 text-neutral-700 font-medium">
          {n?.relationship || "Beneficiary"}
        </span>
      ),
    },
    {
      header: "Tier",
      accessorKey: "tier",
      cell: (n: Nominee) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${
            n?.tier === "PRIMARY"
              ? "bg-black text-white"
              : "bg-neutral-100 text-neutral-800 border border-black/10"
          }`}
        >
          {n?.tier || "PRIMARY"}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (n: Nominee) => <StatusBadge status={n?.status || "Active"} />,
    },
    {
      header: "Allocated Assets",
      accessorKey: "allocatedAssetCount",
      cell: (n: Nominee) => (
        <span className="text-xs text-neutral-600 font-mono font-medium">
          {n?.allocatedAssetCount || 0} Assets
        </span>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (n: Nominee) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleOpenAllocations(n)}>
            <Sliders className="w-3.5 h-3.5 mr-1" /> Allocations
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleOpenEditModal(n)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300"
            onClick={() => setRevokeTarget(n)}
          >
            Revoke
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="font-tt-norms font-sans text-black space-y-8 pb-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/8 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-neutral-100 border border-black/5 text-black flex items-center justify-center shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-black tracking-tight">Beneficiary Command Center</h1>
              <p className="text-sm text-neutral-500">
                Designate primary &amp; contingent heirs, distribute asset shares, and track onboarding acceptance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 rounded-full bg-neutral-100 border border-black/8 shadow-2xs">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === "grid" ? "bg-black text-white shadow-2xs" : "text-neutral-600 hover:text-black"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === "table" ? "bg-black text-white shadow-2xs" : "text-neutral-600 hover:text-black"
                }`}
              >
                <List className="w-3.5 h-3.5" /> Table
              </button>
            </div>

            <Button variant="primary" onClick={handleOpenAddModal}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Add Beneficiary
            </Button>
          </div>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Beneficiaries"
            value={nominees.length}
            subtitle="Designated inheritance nominees"
            icon={<Users className="w-5 h-5 text-purple-400" />}
          />
          <MetricCard
            title="Primary Heirs"
            value={primaryCount}
            subtitle={`${contingentCount} Contingent (backup) heirs`}
            icon={<Shield className="w-5 h-5 text-emerald-400" />}
          />
          <MetricCard
            title="Asset Coverage"
            value={`${matrix ? matrix.coverage_percentage : 0}%`}
            subtitle={`${matrix ? matrix.covered_assets : 0} of ${matrix ? matrix.total_assets : 0} assets allocated`}
            icon={<Percent className="w-5 h-5 text-blue-400" />}
          />
          <MetricCard
            title="Unallocated Items"
            value={matrix ? matrix.unallocated_assets_count : 0}
            subtitle="Assets without designated nominee"
            icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
          />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search by name, email, relationship..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-neutral-500" />}
            />
          </div>

          <div className="w-full md:w-56">
            <Select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              options={TIERS}
            />
          </div>
        </div>

        {/* Nominees Content */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingState variant="card" label="Loading Beneficiaries & Allocation Matrix..." />
          </div>
        ) : filteredNominees.length === 0 ? (
          <EmptyState
            icon={<Users className="w-12 h-12 text-purple-500/50" />}
            title="No Beneficiaries Found"
            description="Add primary and contingent heirs to ensure your digital vault assets are securely transferred according to your legacy plan."
            actionLabel="Add Beneficiary"
            onAction={handleOpenAddModal}
          />
        ) : viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredNominees.map((nom) => (
              <div
                key={nom.id}
                className="bg-white border border-black/8 hover:border-black/15 rounded-3xl p-6 space-y-4 shadow-sm transition-all text-black"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-black border border-black/8 font-bold text-sm flex items-center justify-center shadow-2xs">
                      {(nom?.name || "UN").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-black line-clamp-1">{nom?.name || "Unnamed Beneficiary"}</h3>
                      <div className="text-xs text-neutral-500 font-medium mt-0.5">{nom?.relationship || "Beneficiary"}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      nom?.tier === "PRIMARY"
                        ? "bg-black text-white"
                        : "bg-neutral-100 text-neutral-800 border border-black/10"
                    }`}
                  >
                    {nom?.tier || "PRIMARY"}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-neutral-600 border-t border-b border-black/5 py-3.5">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="truncate">{nom?.email || "No email"}</span>
                  </div>
                  {nom?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{nom.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {nom?.allocatedAssetCount || 0} Assets Allocated
                    </span>
                    <StatusBadge status={nom?.status || "Active"} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenAllocations(nom)}
                  >
                    <Sliders className="w-3.5 h-3.5 mr-1" /> Allocations
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {nom.invitationToken && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Copy Invitation Link"
                        onClick={() => handleCopyInviteLink(nom.invitationToken)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Resend Invitation"
                      onClick={() => handleResendInvite(nom.id)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300"
                      title="Revoke Entitlement"
                      onClick={() => setRevokeTarget(nom)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white border border-black/8 rounded-2xl overflow-hidden shadow-sm">
            <DataTable data={filteredNominees} columns={tableColumns} pageSize={15} />
          </div>
        )}

        {/* Add / Edit Nominee Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingNominee ? "Edit Beneficiary Profile" : "Enroll New Beneficiary"}
          description="Designate relationship tier and contact coordinates. A secure invitation token will be generated."
          maxWidth="md"
        >
          <form onSubmit={handleSaveNominee} className="space-y-4">
            <Input
              label="Full Legal Name *"
              placeholder="e.g. Eleanor Vance"
              value={nomineeName}
              onChange={(e) => setNomineeName(e.target.value)}
              required
            />

            <Input
              type="email"
              label="Email Address *"
              placeholder="e.g. eleanor@family.org"
              value={nomineeEmail}
              onChange={(e) => setNomineeEmail(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Relationship Tier"
                value={nomineeTier}
                onChange={(e) => setNomineeTier(e.target.value)}
                options={[
                  { value: "PRIMARY", label: "Primary Heir" },
                  { value: "CONTINGENT", label: "Contingent (Backup)" },
                  { value: "EXECUTOR", label: "Executor / Legal Counsel" },
                  { value: "GUARDIAN", label: "Guardian" },
                ]}
              />

              <Select
                label="Relationship"
                value={nomineeRelationship}
                onChange={(e) => setNomineeRelationship(e.target.value)}
                options={RELATIONSHIPS}
              />
            </div>

            <Input
              label="Phone Number (SMS OTP Verification)"
              placeholder="+1 555 123 4567"
              value={nomineePhone}
              onChange={(e) => setNomineePhone(e.target.value)}
            />

            <Input
              label="Personal Directives & Notes"
              placeholder="Instructions or reference to family trust..."
              value={nomineeNotes}
              onChange={(e) => setNomineeNotes(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-black/8">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={savingNominee}>
                {editingNominee ? "Save Changes" : "Enroll & Issue Token"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Asset Allocation Drawer */}
        <Drawer
          isOpen={allocationDrawerOpen}
          onClose={() => setAllocationDrawerOpen(false)}
          title={`Asset Allocations: ${selectedNominee?.name || ""}`}
          width="lg"
        >
          <div className="space-y-5">
            <div className="bg-neutral-50 p-3.5 rounded-xl border border-black/8 text-xs text-neutral-600">
              Select which vault assets are assigned to <strong className="text-black font-semibold">{selectedNominee?.name}</strong>, their percentage share, and release triggers.
            </div>

            <div className="space-y-3">
              {vaultAssets.length === 0 ? (
                <div className="text-center py-10 text-xs text-neutral-400">
                  No assets in vault. Add assets first in the Vault Explorer.
                </div>
              ) : (
                vaultAssets.map((asset) => {
                  const alloc = currentAllocations.find((a) => a.assetId === asset.id);
                  const isAssigned = !!alloc;

                  return (
                    <div
                      key={asset.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isAssigned
                          ? "bg-neutral-100 border-black/20"
                          : "bg-white border-black/8 hover:border-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => toggleAssetAllocation(asset.id)}
                            className="w-4 h-4 rounded border-neutral-300 text-black focus:ring-black"
                          />
                          <div>
                            <div className="text-sm font-medium text-black">{asset.name}</div>
                            <div className="text-[11px] text-neutral-500 font-mono">{asset.type}</div>
                          </div>
                        </div>

                        {isAssigned && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-black font-mono font-bold">
                              {alloc?.sharePercentage || 100}% Share
                            </span>
                          </div>
                        )}
                      </div>

                      {isAssigned && (
                        <div className="mt-3 pt-3 border-t border-black/10 grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-neutral-500 block mb-1">Share Percentage</label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={alloc?.sharePercentage || 100}
                              onChange={(e) => updateAssetShare(asset.id, parseFloat(e.target.value) || 100)}
                              className="w-full bg-white border border-black/15 rounded-lg p-1.5 text-xs text-black font-mono focus:border-black focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-neutral-500 block mb-1">Release Condition</label>
                            <select
                              value={alloc?.releaseCondition || "IMMEDIATE_ON_CLAIM"}
                              onChange={(e) => updateAssetCondition(asset.id, e.target.value)}
                              className="w-full bg-white border border-black/15 rounded-lg p-1.5 text-xs text-black focus:border-black focus:outline-none"
                            >
                              <option value="IMMEDIATE_ON_CLAIM">Immediate On Claim</option>
                              <option value="AFTER_COOLING_PERIOD">After Cooling Period</option>
                              <option value="DUAL_APPROVAL_REQUIRED">Dual Approval Required</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-black/8">
              <Button variant="ghost" onClick={() => setAllocationDrawerOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={savingAllocations}
                onClick={handleSaveAllocations}
              >
                Save Allocations
              </Button>
            </div>
          </div>
        </Drawer>

        {/* Revoke Confirmation */}
        <ConfirmDialog
          isOpen={!!revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onConfirm={handleRevokeNominee}
          title={`Revoke Rights for ${revokeTarget?.name}?`}
          description="This will immediately revoke their claim eligibility, invalidate all active invitation tokens, and unlink them from all vault assets."
          confirmLabel="Revoke Beneficiary"
          variant="danger"
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteNominee}
          title={`Delete ${deleteTarget?.name}?`}
          description="Permanently delete this beneficiary from your digital vault records."
          confirmLabel="Delete Nominee"
          variant="danger"
        />
      </div>
    </div>
  );
}
