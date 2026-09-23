"use client";

import * as React from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Scale,
  FileDown,
  FileCheck,
  Trash2,
  AlertTriangle,
  Clock,
  Lock,
  Unlock,
  Copy,
  Check,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Eye,
  SlidersHorizontal,
  FileText,
  HelpCircle,
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

interface ExportManifest {
  exportId: string;
  sha256Checksum: string;
  issuedAt: string;
  expiresAt: string;
  totalAssets: number;
}

export default function PrivacyCompliancePage() {
  const [legalHoldActive, setLegalHoldActive] = React.useState(false);
  const [legalHoldDetails, setLegalHoldDetails] = React.useState<{
    caseId?: string;
    reason?: string;
    imposedBy?: string;
  }>({
    caseId: "PROB-2026-9901",
    reason: "Estate Probate Administration Hold",
    imposedBy: "Compliance Officer S. Jenkins",
  });

  const [exportManifest, setExportManifest] = React.useState<ExportManifest | null>({
    exportId: "exp_8c91a03f4e2b",
    sha256Checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    issuedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
    totalAssets: 6,
  });

  const [isGeneratingExport, setIsGeneratingExport] = React.useState(false);
  const [copiedHash, setCopiedHash] = React.useState(false);

  // Consent Settings State
  const [telemetrySharing, setTelemetrySharing] = React.useState(false);
  const [retentionDays, setRetentionDays] = React.useState(90);
  const [notarySharing, setNotarySharing] = React.useState(true);
  const [cookieAnalytics, setCookieAnalytics] = React.useState(false);
  const [consentSaved, setConsentSaved] = React.useState(false);

  // Erasure Modal State
  const [isErasureModalOpen, setIsErasureModalOpen] = React.useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = React.useState("");
  const [erasureExecuting, setErasureExecuting] = React.useState(false);
  const [erasureCompleted, setErasureCompleted] = React.useState(false);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2500);
  };

  const handleGenerateExport = () => {
    setIsGeneratingExport(true);
    setTimeout(() => {
      setExportManifest({
        exportId: `exp_${Date.now().toString(16)}`,
        sha256Checksum: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        totalAssets: 6,
      });
      setIsGeneratingExport(false);
    }, 1200);
  };

  const handleSaveConsent = () => {
    setConsentSaved(true);
    setTimeout(() => setConsentSaved(false), 2000);
  };

  const handleExecuteErasure = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationPhrase.trim() !== "PERMANENTLY ZEROIZE ALL MY DATA") return;

    setErasureExecuting(true);
    setTimeout(() => {
      setErasureExecuting(false);
      setErasureCompleted(true);
      setTimeout(() => {
        setIsErasureModalOpen(false);
        setErasureCompleted(false);
        setConfirmationPhrase("");
      }, 2000);
    }, 1500);
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Scale className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Compliance, Legal Archival &amp; Privacy Desk
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                GDPR &amp; CCPA
              </span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Exercise statutory data rights under GDPR Article 20 (Data Portability) and Article 17 (Right-to-be-Forgotten
            via NIST SP 800-88 Cryptographic Zeroization). Manage estate legal holds and third-party biometric retention.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setLegalHoldActive(!legalHoldActive)}
          >
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            Simulate Legal Hold Toggle
          </Button>
        </div>
      </div>

      {/* Legal Hold Alert Banner (If Active) */}
      {legalHoldActive && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-950/20 to-orange-950/20 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse mt-0.5">
              <Scale className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-foreground">
                  Active Legal Hold Placed on Account
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40">
                  Case #{legalHoldDetails.caseId}
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-3xl">
                Reason: <strong className="text-foreground">{legalHoldDetails.reason}</strong>. Imposed by{" "}
                {legalHoldDetails.imposedBy}. Under statutory guidelines, account deletion, key shredding, and asset
                releases are suspended until this hold is formally resolved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Data Portability Standard"
          value="GDPR Art. 20"
          subtitle="Signed JSON manifest + SHA-256"
          icon={<FileCheck className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          title="Legal Hold Status"
          value={legalHoldActive ? "ACTIVE HOLD" : "CLEAR"}
          subtitle={legalHoldActive ? "Probate suspension in effect" : "Zero active litigation holds"}
          icon={
            legalHoldActive ? (
              <ShieldAlert className="h-5 w-5 text-amber-400" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            )
          }
        />
        <MetricCard
          title="Zeroization Protocol"
          value="NIST SP 800-88"
          subtitle="Irreversible crypto-shredding"
          icon={<Lock className="h-5 w-5 text-indigo-400" />}
        />
        <MetricCard
          title="IDV Data Retention"
          value={`${retentionDays} Days`}
          subtitle="Automated biometric scrubbing"
          icon={<Clock className="h-5 w-5 text-rose-400" />}
        />
      </div>

      {/* GDPR Article 20 Data Portability Card */}
      <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              GDPR Article 20 / CCPA Data Portability Export
            </h3>
            <p className="text-xs text-muted-foreground">
              Download your complete digital estate archive: asset metadata, heir allocations, release policies, and
              tamper-evident Merkle audit blocks signed with a SHA-256 cryptographic checksum.
            </p>
          </div>
          <Button
            variant="primary"
            className="flex items-center gap-2 shadow-lg shadow-primary/20 shrink-0"
            onClick={handleGenerateExport}
            disabled={isGeneratingExport}
          >
            {isGeneratingExport ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Generate Signed Estate Manifest
          </Button>
        </div>

        {exportManifest && (
          <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-foreground">
                  Verified Estate Manifest Ready (Valid for 24 Hours)
                </span>
                <span className="text-xs font-mono text-muted-foreground">#{exportManifest.exportId}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Expires: {new Date(exportManifest.expiresAt).toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-background/60 border border-border/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">SHA-256 Checksum Signature:</span>
                <button
                  type="button"
                  onClick={() => handleCopyHash(exportManifest.sha256Checksum)}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-mono"
                >
                  {copiedHash ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Copy className="h-3 w-3" /> Copy Signature
                    </span>
                  )}
                </button>
              </div>
              <code className="text-xs font-mono text-foreground break-all block">
                {exportManifest.sha256Checksum}
              </code>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs flex items-center gap-1.5"
                onClick={() => {
                  const dataStr =
                    "data:text/json;charset=utf-8," +
                    encodeURIComponent(JSON.stringify(exportManifest, null, 2));
                  const downloadAnchor = document.createElement("a");
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", `securevault_estate_${exportManifest.exportId}.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                Download Manifest (.JSON)
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Privacy Consent & Retention Settings */}
      <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-indigo-400" />
              Data Retention &amp; Privacy Consent Controls
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure third-party data exchange opt-ins and biometric identity verification document retention schedules.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSaveConsent}>
            {consentSaved ? "Saved!" : "Save Preferences"}
          </Button>
        </div>

        <div className="space-y-4">
          {/* IDV Retention Slider */}
          <div className="p-4 rounded-xl border border-border/30 bg-muted/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Biometric IDV Document Retention Period
                </span>
                <p className="text-xs text-muted-foreground">
                  Days to retain uploaded death certificates and identity verification documents before automated purge.
                </p>
              </div>
              <span className="text-xs font-bold text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 font-mono">
                {retentionDays} Days
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={365}
              step={30}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Toggle items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-border/30 bg-muted/10 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground block">
                  Remote Online Notary (RON) Integration Share
                </span>
                <p className="text-xs text-muted-foreground">
                  Permit secure transmission of affidavit envelopes to licensed notaries during claim verification.
                </p>
              </div>
              <input
                type="checkbox"
                checked={notarySharing}
                onChange={(e) => setNotarySharing(e.target.checked)}
                className="h-4 w-4 accent-primary rounded"
              />
            </div>

            <div className="p-4 rounded-xl border border-border/30 bg-muted/10 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground block">
                  Anonymous Performance Telemetry
                </span>
                <p className="text-xs text-muted-foreground">
                  Share anonymized latency and error logs to improve platform encryption performance.
                </p>
              </div>
              <input
                type="checkbox"
                checked={telemetrySharing}
                onChange={(e) => setTelemetrySharing(e.target.checked)}
                className="h-4 w-4 accent-primary rounded"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone: GDPR Article 17 Right-to-be-Forgotten */}
      <div className="rounded-2xl border-2 border-red-500/30 bg-red-950/10 backdrop-blur-md p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-red-400 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Danger Zone: GDPR Article 17 Right to Erasure (Crypto-Shredding)
            </h4>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Permanently zeroizes all personal Data Encryption Keys (DEKs), destroys Shamir social recovery shards,
              erases asset payloads, and scrubs PII from audit records. Once executed, data cannot be recovered by anyone.
            </p>
          </div>
          <Button
            variant="danger"
            className="flex items-center gap-2 shadow-lg shadow-red-900/40 shrink-0"
            onClick={() => setIsErasureModalOpen(true)}
            disabled={legalHoldActive}
          >
            <Trash2 className="h-4 w-4" />
            {legalHoldActive ? "Blocked by Legal Hold" : "Initiate Crypto-Shredding"}
          </Button>
        </div>
      </div>

      {/* Erasure Confirmation Modal */}
      <Modal
        isOpen={isErasureModalOpen}
        onClose={() => setIsErasureModalOpen(false)}
        title="Confirm Irreversible Cryptographic Zeroization"
      >
        <form onSubmit={handleExecuteErasure} className="space-y-4 pt-2">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold">This action cannot be reversed under any circumstances.</p>
              <p className="text-muted-foreground">
                In compliance with NIST SP 800-88 cryptographic sanitization, your master keys will be destroyed. All
                encrypted files, nominee links, and recovery polynomials will become mathematically unrecoverable.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">
              Type <strong className="text-primary font-mono select-all">PERMANENTLY ZEROIZE ALL MY DATA</strong> to
              confirm:
            </label>
            <Input
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder="PERMANENTLY ZEROIZE ALL MY DATA"
            />
          </div>

          {erasureCompleted && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Cryptographic zeroization complete. Account purged.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsErasureModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={confirmationPhrase.trim() !== "PERMANENTLY ZEROIZE ALL MY DATA" || erasureExecuting}
              className="flex items-center gap-2"
            >
              {erasureExecuting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Zeroize All Data Now
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
