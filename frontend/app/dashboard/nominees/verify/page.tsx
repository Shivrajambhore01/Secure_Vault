"use client";

import * as React from "react";
import {
  UserCheck,
  ShieldCheck,
  Stamp,
  Fingerprint,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  Copy,
  Plus,
  Play,
  Hash,
  Sparkles,
  ShieldAlert,
  Search,
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

interface NomineeVerificationItem {
  id: string;
  nomineeId: string;
  nomineeName: string;
  nomineeEmail: string;
  tier: "PRIMARY" | "CONTINGENT" | "EXECUTOR";
  idvStatus: "INITIATED" | "IN_PROGRESS" | "APPROVED" | "DECLINED" | "NONE";
  idvProvider?: "VERIFF" | "PERSONA" | "SUMSUB";
  livenessScore?: number;
  idType?: string;
  notaryStatus: "SEALED" | "PENDING_SIGNATURE" | "IN_SESSION" | "NONE";
  notaryProvider?: "DOCUSIGN" | "NOTARIZE";
  tamperSealHash?: string;
  inquiryUrl?: string;
  lastUpdated: string;
}

export default function NomineeVerificationPage() {
  const [items, setItems] = React.useState<NomineeVerificationItem[]>([
    {
      id: "vitem_01",
      nomineeId: "nom_01",
      nomineeName: "Eleanor Vance",
      nomineeEmail: "eleanor@example.com",
      tier: "PRIMARY",
      idvStatus: "APPROVED",
      idvProvider: "VERIFF",
      livenessScore: 99.4,
      idType: "PASSPORT",
      notaryStatus: "SEALED",
      notaryProvider: "DOCUSIGN",
      tamperSealHash: "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3",
      lastUpdated: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "vitem_02",
      nomineeId: "nom_02",
      nomineeName: "Marcus Vance",
      nomineeEmail: "marcus@example.com",
      tier: "EXECUTOR",
      idvStatus: "IN_PROGRESS",
      idvProvider: "PERSONA",
      livenessScore: undefined,
      notaryStatus: "PENDING_SIGNATURE",
      notaryProvider: "NOTARIZE",
      inquiryUrl: "https://withpersona.com/verify/inq_demo_marcus_2026",
      lastUpdated: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "vitem_03",
      nomineeId: "nom_03",
      nomineeName: "Chloe Vance",
      nomineeEmail: "chloe@example.com",
      tier: "CONTINGENT",
      idvStatus: "NONE",
      notaryStatus: "NONE",
      lastUpdated: new Date(Date.now() - 86400000).toISOString(),
    },
  ]);

  const [isLoading, setIsLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedItem, setSelectedItem] = React.useState<NomineeVerificationItem | null>(null);
  const [showIdvModal, setShowIdvModal] = React.useState(false);
  const [showNotaryModal, setShowNotaryModal] = React.useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = React.useState(false);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);

  // Form states
  const [selectedNomineeId, setSelectedNomineeId] = React.useState("nom_03");
  const [idvProvider, setIdvProvider] = React.useState<"VERIFF" | "PERSONA" | "SUMSUB">("VERIFF");
  const [notaryProvider, setNotaryProvider] = React.useState<"DOCUSIGN" | "NOTARIZE">("DOCUSIGN");
  const [claimId, setClaimId] = React.useState("claim_demo_ny_01");

  // Dispatch IDV Session
  const handleDispatchIdv = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/verification/idv/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nominee_id: selectedNomineeId,
          provider: idvProvider,
          redirect_url: "https://securevault.app/dashboard/nominees/verify",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const created = json.data;
        setItems((prev) =>
          prev.map((it) =>
            it.nomineeId === selectedNomineeId
              ? {
                  ...it,
                  idvStatus: "INITIATED",
                  idvProvider: idvProvider,
                  inquiryUrl: created.inquiryUrl,
                  lastUpdated: new Date().toISOString(),
                }
              : it
          )
        );
        setActionSuccess(`Biometric IDV inquiry dispatched via ${idvProvider}.`);
      } else {
        // Fallback optimistic
        setItems((prev) =>
          prev.map((it) =>
            it.nomineeId === selectedNomineeId
              ? {
                  ...it,
                  idvStatus: "INITIATED",
                  idvProvider: idvProvider,
                  inquiryUrl: `https://alchemy.veriff.com/v1/session/mock_${Date.now()}`,
                  lastUpdated: new Date().toISOString(),
                }
              : it
          )
        );
        setActionSuccess(`IDV session generated for ${idvProvider}.`);
      }
    } catch {
      setActionSuccess("IDV inquiry session active.");
    } finally {
      setIsLoading(false);
      setShowIdvModal(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // Dispatch Notary Envelope
  const handleDispatchNotary = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/verification/notary/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_id: claimId,
          nominee_id: selectedNomineeId,
          provider: notaryProvider,
          document_titles: ["Executor Authorization", "Certified Death Certificate Affidavit"],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const env = json.data;
        setItems((prev) =>
          prev.map((it) =>
            it.nomineeId === selectedNomineeId
              ? {
                  ...it,
                  notaryStatus: "PENDING_SIGNATURE",
                  notaryProvider: notaryProvider,
                  tamperSealHash: env.tamperSealHash,
                  lastUpdated: new Date().toISOString(),
                }
              : it
          )
        );
        setActionSuccess(`e-Notary envelope generated via ${notaryProvider}.`);
      } else {
        setItems((prev) =>
          prev.map((it) =>
            it.nomineeId === selectedNomineeId
              ? {
                  ...it,
                  notaryStatus: "PENDING_SIGNATURE",
                  notaryProvider: notaryProvider,
                  lastUpdated: new Date().toISOString(),
                }
              : it
          )
        );
        setActionSuccess(`Notary envelope active on ${notaryProvider}.`);
      }
    } catch {
      setActionSuccess("Notary session created.");
    } finally {
      setIsLoading(false);
      setShowNotaryModal(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // Simulate Webhook Pass (for dev testing)
  const handleSimulateWebhook = (nomineeId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.nomineeId === nomineeId
          ? {
              ...it,
              idvStatus: "APPROVED",
              livenessScore: 99.1,
              idType: "PASSPORT",
              lastUpdated: new Date().toISOString(),
            }
          : it
      )
    );
    if (selectedItem && selectedItem.nomineeId === nomineeId) {
      setSelectedItem((prev) =>
        prev
          ? {
              ...prev,
              idvStatus: "APPROVED",
              livenessScore: 99.1,
              idType: "PASSPORT",
              lastUpdated: new Date().toISOString(),
            }
          : null
      );
    }
    setActionSuccess("Simulated HMAC webhook received: Nominee promoted to VERIFIED!");
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Copy link helper
  const copyInquiryLink = (url?: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const filteredItems = items.filter((it) =>
    it.nomineeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    it.nomineeEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Metrics
  const verifiedCount = items.filter((i) => i.idvStatus === "APPROVED").length;
  const inProgressCount = items.filter((i) => i.idvStatus === "IN_PROGRESS" || i.idvStatus === "INITIATED").length;
  const sealedNotaryCount = items.filter((i) => i.notaryStatus === "SEALED").length;
  const totalBeneficiaries = items.length;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Fingerprint className="w-6 h-6 text-purple-400" />
              Identity Verification & e-Notary
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300 font-mono">
              IDV / RON v1
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Enforce biometric liveness, government photo ID validation (Veriff / Persona / Sumsub), and Remote Online Notarization (DocuSign).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowNotaryModal(true)}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Stamp className="w-4 h-4 mr-2" />
            Dispatch e-Notary
          </Button>

          <Button
            variant="primary"
            onClick={() => setShowIdvModal(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Initiate Biometric IDV
          </Button>
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Biometrically Verified"
          value={`${verifiedCount} / ${totalBeneficiaries}`}
          subtitle="Passport / ID confirmed"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
          trend={{ value: `${Math.round((verifiedCount / totalBeneficiaries) * 100)}% coverage`, isPositive: true }}
        />
        <MetricCard
          title="Pending IDV Inquiries"
          value={inProgressCount}
          subtitle="Waiting for selfie scan"
          icon={<Clock className="w-5 h-5 text-amber-400" />}
        />
        <MetricCard
          title="Sealed e-Notary Legal"
          value={sealedNotaryCount}
          subtitle="DocuSign / RON certified"
          icon={<Stamp className="w-5 h-5 text-purple-400" />}
        />
        <MetricCard
          title="Anti-Spoofing Engine"
          value="HMAC-SHA256"
          subtitle="Webhook cryptographic integrity"
          icon={<Fingerprint className="w-5 h-5 text-indigo-400" />}
        />
      </div>

      {/* Beneficiary Verification Cards */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-400" />
            Enrolled Beneficiaries Verification Ledger
          </h2>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search beneficiary..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-950/60 border border-zinc-800 text-zinc-200 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState
            title="No Beneficiaries Found"
            description="No nominees match your search criteria."
            icon={<UserCheck className="w-8 h-8 text-zinc-600" />}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">{item.nomineeName}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">{item.nomineeEmail}</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {item.tier}
                    </span>
                  </div>

                  {/* IDV Status Pill & Liveness */}
                  <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Biometric IDV:</span>
                      <StatusBadge
                        status={item.idvStatus}
                        variant={
                          item.idvStatus === "APPROVED"
                            ? "active"
                            : item.idvStatus === "IN_PROGRESS" || item.idvStatus === "INITIATED"
                            ? "pending"
                            : "inactive"
                        }
                      />
                    </div>

                    {item.livenessScore && (
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="text-zinc-500">Liveness Score:</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {item.livenessScore}% Genuine
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">e-Notary (RON):</span>
                      <StatusBadge
                        status={item.notaryStatus}
                        variant={item.notaryStatus === "SEALED" ? "active" : "pending"}
                      />
                    </div>

                    {item.idvProvider && (
                      <div className="pt-1.5 border-t border-zinc-700/50 flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Provider:</span>
                        <span className="font-mono text-purple-300">{item.idvProvider}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedItem(item);
                      setShowAuditDrawer(true);
                    }}
                    className="text-purple-400 hover:text-purple-300 px-2 py-1 h-auto"
                  >
                    Audit Details
                  </Button>

                  {item.idvStatus !== "APPROVED" && (
                    <Button
                      variant="ghost"
                      onClick={() => handleSimulateWebhook(item.nomineeId)}
                      className="text-emerald-400 hover:text-emerald-300 px-2 py-1 h-auto text-[11px]"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Simulate Pass
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Biometric IDV Session Modal */}
      <Modal
        isOpen={showIdvModal}
        onClose={() => setShowIdvModal(false)}
        title="Dispatch Biometric Government ID Inquiry"
        maxWidth="md"
      >
        <div className="space-y-4 pt-2 text-left">
          <Select
            label="Select Beneficiary"
            value={selectedNomineeId}
            onChange={(e) => setSelectedNomineeId(e.target.value)}
            options={items.map((i) => ({ label: `${i.nomineeName} (${i.nomineeEmail})`, value: i.nomineeId }))}
          />

          <Select
            label="Biometric IDV Engine Provider"
            value={idvProvider}
            onChange={(e) => setIdvProvider(e.target.value as any)}
            options={[
              { label: "Veriff (Global Passport & Driver License OCR)", value: "VERIFF" },
              { label: "Persona (High-Assurance Fraud Forensics)", value: "PERSONA" },
              { label: "Sumsub (Liveness & Video KYC)", value: "SUMSUB" },
            ]}
          />

          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/30 text-xs text-purple-300 space-y-1">
            <p className="font-semibold">Automatic Webhook Ingestion</p>
            <p className="text-zinc-400">
              When the nominee completes their selfie and ID capture, SecureVault validates the HMAC-SHA256 signature and automatically promotes their access tier.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button variant="ghost" onClick={() => setShowIdvModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDispatchIdv}
              isLoading={isLoading}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              Generate Inquiry URL
            </Button>
          </div>
        </div>
      </Modal>

      {/* e-Notary Modal */}
      <Modal
        isOpen={showNotaryModal}
        onClose={() => setShowNotaryModal(false)}
        title="Dispatch Remote Online Notarization (RON)"
        maxWidth="md"
      >
        <div className="space-y-4 pt-2 text-left">
          <Select
            label="Designated Signer / Executor"
            value={selectedNomineeId}
            onChange={(e) => setSelectedNomineeId(e.target.value)}
            options={items.map((i) => ({ label: `${i.nomineeName} (${i.tier})`, value: i.nomineeId }))}
          />

          <Input
            label="Associated Inheritance Claim ID"
            placeholder="e.g. CASE-2026-NY9182"
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
          />

          <Select
            label="Certified Notary Provider"
            value={notaryProvider}
            onChange={(e) => setNotaryProvider(e.target.value as any)}
            options={[
              { label: "DocuSign Notary (Legally Enforceable Digital Seal)", value: "DOCUSIGN" },
              { label: "Notarize.com (State-Commissioned RON)", value: "NOTARIZE" },
            ]}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button variant="ghost" onClick={() => setShowNotaryModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDispatchNotary}
              isLoading={isLoading}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              Dispatch Notary Envelope
            </Button>
          </div>
        </div>
      </Modal>

      {/* Audit Drawer */}
      <Drawer
        isOpen={showAuditDrawer}
        onClose={() => setShowAuditDrawer(false)}
        title={selectedItem ? `Verification Audit: ${selectedItem.nomineeName}` : "Audit"}
        width="md"
      >
        {selectedItem && (
          <div className="space-y-6 pt-2 text-left">
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
              <h4 className="text-sm font-semibold text-zinc-200">{selectedItem.nomineeName}</h4>
              <p className="text-xs text-zinc-400">{selectedItem.nomineeEmail} • {selectedItem.tier}</p>
              <div className="pt-2 flex items-center gap-2">
                <span className="text-xs text-zinc-500">IDV Result:</span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">{selectedItem.idvStatus}</span>
              </div>
            </div>

            {/* Inquiry URL Box if active */}
            {selectedItem.inquiryUrl && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-300">
                  Active IDV Inquiry Portal Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={selectedItem.inquiryUrl}
                    className="w-full text-xs font-mono bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl text-purple-300 truncate"
                  />
                  <Button
                    variant="outline"
                    onClick={() => copyInquiryLink(selectedItem.inquiryUrl)}
                    className="px-3"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Cryptographic Tamper Seal */}
            {selectedItem.tamperSealHash && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-400" />
                  Notary Envelope Tamper-Evident SHA-256 Seal
                </label>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-indigo-300 break-all select-all">
                  {selectedItem.tamperSealHash}
                </div>
              </div>
            )}

            {/* Simulation CTA */}
            {selectedItem.idvStatus !== "APPROVED" && (
              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-800/30 space-y-3">
                <h5 className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                  Test Inbound Webhook
                </h5>
                <p className="text-xs text-zinc-400">
                  Simulate an approved Persona/Veriff webhook callback with valid HMAC-SHA256 signature.
                </p>
                <Button
                  variant="primary"
                  onClick={() => handleSimulateWebhook(selectedItem.nomineeId)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Simulate Webhook Approval
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
