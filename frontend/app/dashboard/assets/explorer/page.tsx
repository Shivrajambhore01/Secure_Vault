"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Shield,
  Key,
  CreditCard,
  FileText,
  Lock,
  Unlock,
  RotateCcw,
  Plus,
  Search,
  Layers,
  LayoutGrid,
  List,
  Download,
  Trash2,
  Clock,
  Database,
  Users,
  Coins,
  FileCheck,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  Modal,
  Drawer,
  DataTable,
  RiskBadge,
  MetricCard,
  EmptyState,
  LoadingState,
  FileUploader,
  ConfirmDialog,
} from "@/components/design-system";
import { secureFetch, extractErrorMessage, API_BASE } from "@/lib/api";
import { toast } from "sonner";

interface Asset {
  id: string;
  name: string;
  type: string;
  category?: string;
  description?: string;
  content?: string;
  hasContent?: boolean;
  sensitivity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  currentVersion?: number;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  isEncrypted: boolean;
  kmsKeyId?: string;
  tags?: string[];
  nomineeIds?: string[];
  updatedAt: string;
  createdAt?: string;
  metadata?: Record<string, any>;
}

interface VaultSummary {
  total_assets: number;
  total_nominees: number;
  encrypted_assets: number;
  nominee_assigned_assets: number;
  storage_used: number;
  storage_limit: number;
  storage_percentage: number;
  category_breakdown: Record<string, number>;
  sensitivity_breakdown: Record<string, number>;
}

interface VersionItem {
  id: string;
  versionNumber: number;
  name: string;
  category: string;
  content?: string;
  fileName?: string;
  fileSize?: number;
  sensitivity: string;
  createdAt: string;
  createdBy: string;
  changeSummary?: string;
}

interface AccessLog {
  id: string;
  action: string;
  status: string;
  accessorType: string;
  ipAddress: string;
  accessedAt: string;
  details?: Record<string, any>;
}

const CATEGORY_TABS = [
  { id: "ALL", label: "All Items", icon: Layers },
  { id: "FINANCIAL", label: "Financial", icon: CreditCard },
  { id: "CREDENTIALS", label: "Credentials", icon: Key },
  { id: "CRYPTO", label: "Crypto / Seed", icon: Coins },
  { id: "LEGAL", label: "Legal Documents", icon: FileCheck },
  { id: "DOCUMENTS", label: "Files & Documents", icon: FileText },
  { id: "NOTES", label: "Secure Notes", icon: Shield },
];

export default function VaultExplorerPage() {
  // View states
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedSensitivity, setSelectedSensitivity] = useState("ALL");
  const [selectedTag, setSelectedTag] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Data states
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [summary, setSummary] = useState<VaultSummary | null>(null);

  // Drawer / Detail state
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"overview" | "versions" | "audit">("overview");

  // Decryption & Step-up PIN
  const [pinInput, setPinInput] = useState("");
  const [decryptedData, setDecryptedData] = useState<any | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  // Version history & Rollback
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<VersionItem | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  // Access audit logs
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Creation modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<"FILE" | "CREDENTIALS" | "FINANCIAL" | "CRYPTO" | "NOTE">("CREDENTIALS");
  const [assetName, setAssetName] = useState("");
  const [assetDescription, setAssetDescription] = useState("");
  const [assetSensitivity, setAssetSensitivity] = useState("MEDIUM");
  const [assetTags, setAssetTags] = useState("");
  const [secretContent, setSecretContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [savingAsset, setSavingAsset] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Initial fetch
  useEffect(() => {
    fetchVaultData();
  }, [selectedCategory, selectedSensitivity, selectedTag]);

  const fetchVaultData = async () => {
    setLoading(true);
    try {
      // 1. Vault summary
      const sumRes = await secureFetch("/v1/vault/summary");
      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        setSummary(sumJson.data);
      }

      // 2. Distinct tags
      const tagsRes = await secureFetch("/v1/assets/tags");
      if (tagsRes.ok) {
        const tagsJson = await tagsRes.json();
        setTags(tagsJson.data || []);
      }

      // 3. Filtered assets
      let queryParams = new URLSearchParams({ page: "1", page_size: "100" });
      if (selectedCategory !== "ALL") queryParams.set("category", selectedCategory);
      if (selectedSensitivity !== "ALL") queryParams.set("sensitivity", selectedSensitivity);
      if (selectedTag !== "ALL") queryParams.set("tag", selectedTag);
      if (searchQuery.trim()) queryParams.set("search", searchQuery.trim());

      const assetsRes = await secureFetch(`/v1/assets?${queryParams.toString()}`);
      if (assetsRes.ok) {
        const assetsJson = await assetsRes.json();
        setAssets(assetsJson.data || []);
      }
    } catch {
      toast.error("Failed to load vault data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssetDrawer = async (asset: Asset) => {
    setActiveAsset(asset);
    setDrawerTab("overview");
    setDecryptedData(null);
    setPinInput("");
    setDrawerOpen(true);
  };

  const handleDecryptSecret = async () => {
    if (!activeAsset) return;
    setDecrypting(true);
    try {
      const res = await secureFetch(`/v1/assets/${activeAsset.id}/decrypt`, {
        method: "POST",
        body: JSON.stringify({ pin: pinInput }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(extractErrorMessage(json, "Step-up verification failed"));
      }
      setDecryptedData(json.data);
      toast.success("Secret revealed with KMS DEK decryption");
    } catch (err: any) {
      toast.error(err.message || "Failed to decrypt secret");
    } finally {
      setDecrypting(false);
    }
  };

  const handleLoadVersions = async () => {
    if (!activeAsset) return;
    setLoadingVersions(true);
    try {
      const res = await secureFetch(`/v1/assets/${activeAsset.id}/versions`);
      if (res.ok) {
        const json = await res.json();
        setVersions(json.data || []);
      }
    } catch {
      toast.error("Failed to load version history");
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleLoadAccessLogs = async () => {
    if (!activeAsset) return;
    setLoadingLogs(true);
    try {
      const res = await secureFetch(`/v1/assets/${activeAsset.id}/audit`);
      if (res.ok) {
        const json = await res.json();
        setAccessLogs(json.data || []);
      }
    } catch {
      toast.error("Failed to load access logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleExecuteRollback = async () => {
    if (!activeAsset || !rollbackTarget) return;
    setRollingBack(true);
    try {
      const res = await secureFetch(
        `/v1/assets/${activeAsset.id}/rollback/${rollbackTarget.versionNumber}`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(json, "Rollback failed"));

      toast.success(`Rolled back to v${rollbackTarget.versionNumber}`);
      setRollbackTarget(null);
      fetchVaultData();
      handleLoadVersions();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRollingBack(false);
    }
  };

  const handleSaveNewAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim()) {
      toast.error("Asset name is required");
      return;
    }

    setSavingAsset(true);
    try {
      if (createType === "FILE" && uploadedFile) {
        const formData = new FormData();
        formData.append("name", assetName.trim());
        formData.append("type", "DOCUMENTS");
        formData.append("description", assetDescription);
        formData.append("sensitivity", assetSensitivity);
        formData.append("tags", assetTags);
        formData.append("file", uploadedFile);

        const res = await fetch(`${API_BASE}/api/v1/assets`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(extractErrorMessage(json, "Upload failed"));
      } else {
        let category = "NOTES";
        if (createType === "CREDENTIALS") category = "CREDENTIALS";
        if (createType === "FINANCIAL") category = "FINANCIAL";
        if (createType === "CRYPTO") category = "CRYPTO";

        const payload = {
          name: assetName.trim(),
          type: category,
          description: assetDescription,
          sensitivity: assetSensitivity,
          tags: assetTags.split(",").map((t) => t.trim()).filter(Boolean),
          content: secretContent,
        };

        const res = await secureFetch("/v1/assets", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(extractErrorMessage(json, "Failed to save asset"));
      }

      toast.success("Asset encrypted and stored in digital vault");
      setCreateModalOpen(false);
      resetCreateForm();
      fetchVaultData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create asset");
    } finally {
      setSavingAsset(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await secureFetch(`/v1/assets/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Asset deleted and quota released");
      setDeleteTarget(null);
      if (activeAsset?.id === deleteTarget.id) setDrawerOpen(false);
      fetchVaultData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const resetCreateForm = () => {
    setAssetName("");
    setAssetDescription("");
    setSecretContent("");
    setAssetTags("");
    setAssetSensitivity("MEDIUM");
    setUploadedFile(null);
  };

  const formatStorage = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q)) ||
        (a.tags && a.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, [assets, searchQuery]);

  // Columns for DataTable view
  const tableColumns = [
    {
      header: "Asset Name",
      accessorKey: "name",
      cell: (a: Asset) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {a.type === "CREDENTIALS" ? <Key className="w-4 h-4" /> :
             a.type === "FINANCIAL" ? <CreditCard className="w-4 h-4" /> :
             a.type === "CRYPTO" ? <Coins className="w-4 h-4" /> :
             a.type === "LEGAL" ? <FileCheck className="w-4 h-4" /> :
             <FileText className="w-4 h-4" />}
          </div>
          <div>
            <div className="font-medium text-white">{a.name}</div>
            <div className="text-xs text-neutral-400">{a.type}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Sensitivity",
      accessorKey: "sensitivity",
      cell: (a: Asset) => <RiskBadge level={a.sensitivity || "MEDIUM"} />,
    },
    {
      header: "Version",
      accessorKey: "currentVersion",
      cell: (a: Asset) => (
        <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono">
          v{a.currentVersion || 1}
        </span>
      ),
    },
    {
      header: "Size",
      accessorKey: "fileSize",
      cell: (a: Asset) => (
        <span className="text-xs text-neutral-400 font-mono">
          {a.fileSize ? formatStorage(a.fileSize) : "Encrypted Payload"}
        </span>
      ),
    },
    {
      header: "Tags",
      accessorKey: "tags",
      cell: (a: Asset) => (
        <div className="flex flex-wrap gap-1">
          {(a.tags || []).slice(0, 2).map((t) => (
            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/40 text-purple-300 border border-purple-800/40">
              #{t}
            </span>
          ))}
          {(a.tags || []).length > 2 && (
            <span className="text-[10px] text-neutral-500">+{a.tags!.length - 2}</span>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (a: Asset) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleOpenAssetDrawer(a)}>
            Inspect
          </Button>
          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => setDeleteTarget(a)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-black font-tt-norms font-sans p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/8 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-black text-white shadow-xs">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-black tracking-tight">Digital Vault Explorer</h1>
                <p className="text-sm text-neutral-500">
                  Envelope-encrypted storage with per-asset KMS keys, version history, and nominee assignments.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 rounded-full bg-white border border-black/8 shadow-2xs">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === "grid" ? "bg-black text-white shadow-xs font-semibold" : "text-neutral-500 hover:text-black"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === "table" ? "bg-black text-white shadow-xs font-semibold" : "text-neutral-500 hover:text-black"
                }`}
              >
                <List className="w-3.5 h-3.5" /> Table
              </button>
            </div>

            <Button
              variant="primary"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add New Asset
            </Button>
          </div>
        </div>

        {/* KPI Metrics */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Assets"
              value={summary.total_assets}
              subtitle="Across all encrypted categories"
              icon={<Layers className="w-5 h-5 text-purple-400" />}
            />
            <MetricCard
              title="KMS Protected"
              value={summary.encrypted_assets}
              subtitle="100% envelope encryption"
              icon={<Lock className="w-5 h-5 text-emerald-400" />}
            />
            <MetricCard
              title="Storage Quota"
              value={formatStorage(summary.storage_used)}
              subtitle={`of ${formatStorage(summary.storage_limit)} (${summary.storage_percentage}%)`}
              icon={<Database className="w-5 h-5 text-blue-400" />}
            />
            <MetricCard
              title="Nominee Assigned"
              value={summary.nominee_assigned_assets}
              subtitle="Protected under legacy plan"
              icon={<Users className="w-5 h-5 text-amber-400" />}
            />
          </div>
        )}

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-black/8 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-2 transition-all ${
                  active
                    ? "bg-black text-white font-semibold shadow-xs"
                    : "bg-white text-neutral-600 border border-black/8 hover:text-black hover:border-black/20"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search assets, descriptions, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-neutral-400" />}
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-44">
              <Select
                value={selectedSensitivity}
                onChange={(e) => setSelectedSensitivity(e.target.value)}
                options={[
                  { value: "ALL", label: "All Sensitivities" },
                  { value: "LOW", label: "Low Risk" },
                  { value: "MEDIUM", label: "Medium Risk" },
                  { value: "HIGH", label: "High Risk" },
                  { value: "CRITICAL", label: "Critical Risk" },
                ]}
              />
            </div>

            {tags.length > 0 && (
              <div className="w-40">
                <Select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  options={[
                    { value: "ALL", label: "All Tags" },
                    ...tags.map((t) => ({ value: t, label: `#${t}` })),
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingState variant="card" label="Decrypting Vault Index..." />
          </div>
        ) : filteredAssets.length === 0 ? (
          <EmptyState
            icon={<Shield className="w-12 h-12 text-black/40" />}
            title="No Vault Assets Found"
            description="You don't have any items matching your filter criteria. Create a new financial record, credential, crypto seed, or document."
            actionLabel="Add First Asset"
            onAction={() => setCreateModalOpen(true)}
          />
        ) : viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => handleOpenAssetDrawer(asset)}
                className="group relative bg-white hover:bg-neutral-50/80 border border-black/8 hover:border-black/20 rounded-3xl p-6 transition-all cursor-pointer shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-neutral-100 text-black border border-black/8 group-hover:scale-105 transition-transform">
                      {asset.type === "CREDENTIALS" ? <Key className="w-5 h-5" /> :
                       asset.type === "FINANCIAL" ? <CreditCard className="w-5 h-5" /> :
                       asset.type === "CRYPTO" ? <Coins className="w-5 h-5" /> :
                       asset.type === "LEGAL" ? <FileCheck className="w-5 h-5" /> :
                       <FileText className="w-5 h-5 text-neutral-800" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-black group-hover:text-neutral-700 transition-colors line-clamp-1">
                        {asset.name}
                      </h3>
                      <div className="text-xs text-neutral-500 font-mono mt-0.5">
                        {asset.type} • v{asset.currentVersion || 1}
                      </div>
                    </div>
                  </div>

                  <RiskBadge level={asset.sensitivity || "MEDIUM"} />
                </div>

                {asset.description && (
                  <p className="text-xs text-neutral-600 line-clamp-2 mt-3.5 leading-relaxed">
                    {asset.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 mt-4">
                  {(asset.tags || []).slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-0.5 rounded-full text-[10px] bg-neutral-100 text-neutral-700 border border-black/5 font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                  {asset.fileSize ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-neutral-100 text-neutral-700 border border-black/5 font-mono ml-auto">
                      {formatStorage(asset.fileSize)}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono ml-auto flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> KMS DEK
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white border border-black/8 rounded-2xl overflow-hidden shadow-sm">
            <DataTable
              data={filteredAssets}
              columns={tableColumns}
              pageSize={15}
            />
          </div>
        )}

        {/* Asset Detail & Secret Revelation Drawer */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`${activeAsset?.name || "Asset Details"} (v${activeAsset?.currentVersion || 1})`}
          width="lg"
        >
          {activeAsset && (
            <div className="space-y-6">
              {/* Drawer Tabs */}
              <div className="flex border-b border-black/8 pb-2 gap-4">
                <button
                  onClick={() => setDrawerTab("overview")}
                  className={`text-xs font-semibold pb-2 border-b-2 transition-colors ${
                    drawerTab === "overview"
                      ? "border-black text-black"
                      : "border-transparent text-neutral-400 hover:text-black"
                  }`}
                >
                  Overview & Decryption
                </button>
                <button
                  onClick={() => {
                    setDrawerTab("versions");
                    handleLoadVersions();
                  }}
                  className={`text-xs font-semibold pb-2 border-b-2 transition-colors ${
                    drawerTab === "versions"
                      ? "border-black text-black"
                      : "border-transparent text-neutral-400 hover:text-black"
                  }`}
                >
                  Version History
                </button>
                <button
                  onClick={() => {
                    setDrawerTab("audit");
                    handleLoadAccessLogs();
                  }}
                  className={`text-xs font-semibold pb-2 border-b-2 transition-colors ${
                    drawerTab === "audit"
                      ? "border-black text-black"
                      : "border-transparent text-neutral-400 hover:text-black"
                  }`}
                >
                  Access Audit Trail
                </button>
              </div>

              {/* Tab 1: Overview & Decryption */}
              {drawerTab === "overview" && (
                <div className="space-y-6">
                  {/* Security Highlights */}
                  <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-4 rounded-2xl border border-black/8">
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase font-mono tracking-wider">
                        Sensitivity Level
                      </div>
                      <div className="mt-1">
                        <RiskBadge level={activeAsset.sensitivity || "MEDIUM"} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase font-mono tracking-wider">
                        KMS Protection
                      </div>
                      <div className="text-xs text-emerald-600 font-mono mt-1 flex items-center gap-1.5 font-medium">
                        <Lock className="w-3.5 h-3.5" /> AES-256-GCM Envelope
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {activeAsset.description && (
                    <div>
                      <label className="text-xs text-neutral-500 font-medium">Description</label>
                      <p className="text-sm text-black mt-1 bg-neutral-50 p-3 rounded-2xl border border-black/8 leading-relaxed">
                        {activeAsset.description}
                      </p>
                    </div>
                  )}

                  {/* Secret Payload Decryption Section */}
                  <div className="border border-black/8 bg-neutral-50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-black" />
                        <span className="text-sm font-semibold text-black">Protected Secret Content</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">Step-up Verified</span>
                    </div>

                    {decryptedData ? (
                      <div className="bg-white border border-black/10 rounded-2xl p-4 space-y-2 shadow-2xs">
                        <div className="text-xs text-emerald-600 font-mono flex items-center gap-1.5 font-medium">
                          <Unlock className="w-3.5 h-3.5" /> Decrypted with KMS DEK
                        </div>
                        <pre className="text-xs text-black font-mono whitespace-pre-wrap break-all bg-neutral-50 p-3 rounded-xl border border-black/8">
                          {decryptedData.decryptedContent || "No text content stored in this asset."}
                        </pre>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-neutral-600">
                          To decrypt and reveal credentials or secret notes, enter your master secondary PIN.
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="Enter 6-digit PIN"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                          />
                          <Button
                            variant="primary"
                            isLoading={decrypting}
                            onClick={handleDecryptSecret}
                          >
                            Reveal
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Binary File Download */}
                  {activeAsset.fileName && (
                    <div className="border border-black/8 bg-neutral-50 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-black">{activeAsset.fileName}</div>
                        <div className="text-xs text-neutral-500 font-mono">
                          {formatStorage(activeAsset.fileSize || 0)} • {activeAsset.mimeType}
                        </div>
                      </div>
                      <a
                        href={`${API_BASE}/api/v1/assets/file/${activeAsset.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black hover:bg-neutral-800 text-xs font-semibold text-white transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Decrypted
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Version History */}
              {drawerTab === "versions" && (
                <div className="space-y-4">
                  {loadingVersions ? (
                    <div className="py-10 flex justify-center">
                      <LoadingState variant="spinner" label="Fetching revision timeline..." />
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="text-center py-12 text-xs text-neutral-400">
                      No historical revisions yet. Updates create automatic immutable snapshots.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((ver) => (
                        <div
                          key={ver.id}
                          className="bg-white border border-black/8 rounded-2xl p-4 flex items-center justify-between shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-100 text-black font-mono font-bold border border-black/8">
                                v{ver.versionNumber}
                              </span>
                              <span className="text-sm text-black font-medium">{ver.name}</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-2">
                              <Clock className="w-3 h-3 text-neutral-400" />
                              {new Date(ver.createdAt).toLocaleString()}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRollbackTarget(ver)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" /> Rollback
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Access Audit Trail */}
              {drawerTab === "audit" && (
                <div className="space-y-4">
                  {loadingLogs ? (
                    <div className="py-10 flex justify-center">
                      <LoadingState variant="spinner" label="Reading immutable audit trail..." />
                    </div>
                  ) : accessLogs.length === 0 ? (
                    <div className="text-center py-12 text-xs text-neutral-400">
                      No access records logged yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {accessLogs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-white border border-black/8 rounded-xl p-3 text-xs flex items-center justify-between shadow-2xs"
                        >
                          <div>
                            <div className="font-semibold text-black flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                  log.action === "DECRYPT" ? "bg-black text-white" :
                                  log.action === "ROLLBACK" ? "bg-amber-100 text-amber-900 border border-amber-300" :
                                  log.action === "DOWNLOAD" ? "bg-blue-100 text-blue-900 border border-blue-300" :
                                  "bg-neutral-100 text-neutral-800"
                                }`}
                              >
                                {log.action}
                              </span>
                              <span className="text-neutral-500 font-mono">{log.accessorType}</span>
                            </div>
                            <div className="text-[11px] text-neutral-500 mt-1">
                              IP: {log.ipAddress} • {new Date(log.accessedAt).toLocaleString()}
                            </div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                              log.status === "SUCCESS"
                                ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                : "text-red-700 bg-red-50 border border-red-200"
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Drawer>

        {/* Create Asset Modal */}
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Store New Vault Asset"
          description="Payload will be encrypted with a dedicated AES-256-GCM DEK wrapped in your master KEK."
          maxWidth="lg"
        >
          <form onSubmit={handleSaveNewAsset} className="space-y-5">
            {/* Category Select Buttons */}
            <div>
              <label className="text-xs text-neutral-500 font-medium block mb-2">Asset Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "CREDENTIALS", label: "Credentials", icon: Key },
                  { id: "FINANCIAL", label: "Financial", icon: CreditCard },
                  { id: "CRYPTO", label: "Crypto Seed", icon: Coins },
                  { id: "FILE", label: "File / Doc", icon: FileText },
                  { id: "NOTE", label: "Secure Note", icon: Shield },
                ].map((type) => {
                  const Icon = type.icon;
                  const active = createType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setCreateType(type.id as any)}
                      className={`p-3 rounded-2xl text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                        active
                          ? "bg-black text-white shadow-xs border border-black font-semibold"
                          : "bg-white text-neutral-600 border border-black/8 hover:text-black hover:border-black/20"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Asset Name & Sensitivity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Asset Name *"
                placeholder="e.g. Chase Bank Login / Swiss Vault"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                required
              />
              <Select
                label="Sensitivity Level"
                value={assetSensitivity}
                onChange={(e) => setAssetSensitivity(e.target.value)}
                options={[
                  { value: "LOW", label: "Low (General Notes)" },
                  { value: "MEDIUM", label: "Medium (Standard Docs)" },
                  { value: "HIGH", label: "High (Financial / Legal)" },
                  { value: "CRITICAL", label: "Critical (Private Keys / Root Passwords)" },
                ]}
              />
            </div>

            {/* Secret Content or File Upload */}
            {createType === "FILE" ? (
              <div>
                <label className="text-xs text-neutral-500 font-medium block mb-1.5">
                  Select Document / Binary File
                </label>
                <FileUploader
                  onFileSelect={(file: File | null) => setUploadedFile(file)}
                  selectedFile={uploadedFile}
                  maxSizeMB={50}
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-neutral-500 font-medium block mb-1.5">
                  {createType === "CRYPTO" ? "BIP-39 Mnemonic Seed Phrase / Private Key *" :
                   createType === "CREDENTIALS" ? "Username & Password / API Key *" :
                   createType === "FINANCIAL" ? "Account / Routing / Folio Details *" :
                   "Confidential Note Content *"}
                </label>
                <textarea
                  rows={4}
                  required
                  value={secretContent}
                  onChange={(e) => setSecretContent(e.target.value)}
                  placeholder={
                    createType === "CRYPTO"
                      ? "witch collapse practice feed shame open despair creek road again ice leap"
                      : "Enter secrets to be encrypted at rest..."
                  }
                  className="w-full bg-white border border-black/15 rounded-2xl p-3 text-sm text-black placeholder-neutral-400 font-mono focus:outline-none focus:border-black transition-colors"
                />
              </div>
            )}

            {/* Tags & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Tags (Comma-separated)"
                placeholder="finance, banking, switzerland"
                value={assetTags}
                onChange={(e) => setAssetTags(e.target.value)}
              />
              <Input
                label="Description (Optional)"
                placeholder="Short context or release instructions"
                value={assetDescription}
                onChange={(e) => setAssetDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-black/8">
              <Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={savingAsset}>
                Encrypt & Store
              </Button>
            </div>
          </form>
        </Modal>

        {/* Rollback Confirmation */}
        <ConfirmDialog
          isOpen={!!rollbackTarget}
          onClose={() => setRollbackTarget(null)}
          onConfirm={handleExecuteRollback}
          title={`Roll Back to Version ${rollbackTarget?.versionNumber}?`}
          description={`This will restore "${rollbackTarget?.name}" to its state from ${rollbackTarget?.createdAt ? new Date(rollbackTarget.createdAt).toLocaleDateString() : ""}. Your current active version will be preserved in version history.`}
          confirmLabel="Confirm Rollback"
        />

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteAsset}
          title={`Delete "${deleteTarget?.name}"?`}
          description="Are you sure you want to permanently delete this asset? All historical versions and encrypted file payloads will be permanently erased."
          confirmLabel="Delete Asset"
          variant="danger"
        />
      </div>
    </div>
  );
}
