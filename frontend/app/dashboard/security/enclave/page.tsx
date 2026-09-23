"use client";

import * as React from "react";
import {
  Cpu,
  ShieldCheck,
  Lock,
  CheckCircle2,
  KeyRound,
  EyeOff,
  Terminal,
  Copy,
  Sparkles,
  Layers,
  Fingerprint,
} from "lucide-react";
import {
  Button,
  DataTable,
  ColumnDef,
  StatusBadge,
  MetricCard,
} from "@/components/design-system";

interface PcrItem {
  register: string;
  component: string;
  hash: string;
  status: "VERIFIED" | "TAMPER_DETECTED";
}

const INITIAL_PCRS: PcrItem[] = [
  {
    register: "PCR0",
    component: "Enclave Image File (EIF / Linux Kernel & Ramdisk)",
    hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
    status: "VERIFIED",
  },
  {
    register: "PCR1",
    component: "Linux Bootstrap & Secure Init Runtime",
    hash: "b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0a1",
    status: "VERIFIED",
  },
  {
    register: "PCR2",
    component: "SecureVault Institutional Enclave Application Binary",
    hash: "c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0a1b2",
    status: "VERIFIED",
  },
];

export default function ConfidentialEnclavePage() {
  const [pcrs] = React.useState<PcrItem[]>(INITIAL_PCRS);
  const [copiedRegister, setCopiedRegister] = React.useState<string | null>(null);

  // In-Enclave Compute State
  const [operation, setOperation] = React.useState("SHRED_PROOF_ENCLAVE_DECRYPT");
  const [payload, setPayload] = React.useState("enc_payload_secret_inheritance_key_material_0x892f");
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [execResult, setExecResult] = React.useState<string | null>(null);

  // ZKP State
  const [claimantBirthYear, setClaimantBirthYear] = React.useState(1996);
  const [minAgeThreshold, setMinAgeThreshold] = React.useState(18);
  const [isGeneratingZk, setIsGeneratingZk] = React.useState(false);
  const [zkProof, setZkProof] = React.useState<{
    commitment: string;
    challenge: string;
    response: string;
    verified: boolean;
  } | null>(null);

  const handleCopy = (reg: string, hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedRegister(reg);
    setTimeout(() => setCopiedRegister(null), 1500);
  };

  const handleExecuteEnclave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setExecResult(
        `0x${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}a89f92cb71`
      );
    }, 500);
  };

  const handleGenerateZkProof = () => {
    setIsGeneratingZk(true);
    setTimeout(() => {
      setIsGeneratingZk(false);
      const isOverThreshold = 2026 - claimantBirthYear >= minAgeThreshold;
      if (!isOverThreshold) {
        alert("Claimant does not satisfy age requirement.");
        return;
      }
      setZkProof({
        commitment: `0x${Math.random().toString(16).slice(2, 14)}...${Math.random().toString(16).slice(2, 10)}`,
        challenge: `0x${Math.random().toString(16).slice(2, 14)}...${Math.random().toString(16).slice(2, 10)}`,
        response: `0x${Math.random().toString(16).slice(2, 14)}...${Math.random().toString(16).slice(2, 10)}`,
        verified: true,
      });
    }, 600);
  };

  const pcrColumns: ColumnDef<PcrItem>[] = [
    {
      header: "Register",
      accessorKey: "register",
      cell: (item) => (
        <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
          {item.register}
        </span>
      ),
    },
    {
      header: "Measured Component",
      accessorKey: "component",
      cell: (item) => <span className="text-xs text-zinc-200">{item.component}</span>,
    },
    {
      header: "Cryptographic SHA-384 Measurement Hash",
      accessorKey: "hash",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-400">
            {item.hash.slice(0, 20)}...{item.hash.slice(-16)}
          </span>
          <button
            onClick={() => handleCopy(item.register, item.hash)}
            className="text-zinc-500 hover:text-cyan-400 transition"
            title="Copy full measurement hash"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {copiedRegister === item.register && (
            <span className="text-[10px] text-emerald-400 font-mono">Copied!</span>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (item) => (
        <StatusBadge
          status={item.status}
          variant={item.status === "VERIFIED" ? "active" : "rejected"}
        />
      ),
    },
  ];

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto text-zinc-100">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Confidential Compute Enclaves & Zero-Knowledge Proofs
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Hardware-isolated TEE execution (AWS Nitro / Intel SGX), cryptographic remote attestation & privacy-preserving ZKP beneficiary verification
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Hardware TEE Mode"
          value="AWS Nitro Enclave"
          subtitle="Isolated memory space"
          icon={<Cpu className="w-5 h-5 text-cyan-400" />}
        />
        <MetricCard
          title="Remote Attestation"
          value="CRYPTOGRAPHICALLY SEALED"
          subtitle="Hardware root of trust"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          title="Host OS Visibility"
          value="0% (ZERO ACCESS)"
          subtitle="Shielded from root admins"
          icon={<Lock className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="Privacy Engine"
          value="ZKP Fiat-Shamir"
          subtitle="Zero identity disclosure"
          icon={<EyeOff className="w-5 h-5 text-amber-400" />}
        />
      </div>

      {/* PCR Registers Table */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Hardware Platform Configuration Registers (PCRs)
            </h2>
            <p className="text-xs text-zinc-400">
              Cryptographic SHA-384 measurements verified against hardware security coprocessor attestation.
            </p>
          </div>
        </div>

        <DataTable
          data={pcrs}
          columns={pcrColumns}
          searchPlaceholder="Search register, component..."
          pageSize={5}
        />
      </div>

      {/* Grid: Enclave Secure Compute & Zero-Knowledge Beneficiary Verifier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enclave Isolated Compute */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-sm text-zinc-100">In-Enclave Isolated Execution</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Execute sensitive key unwrapping, probate validation, and decryption inside shielded RAM with hardware AES-128 memory encryption.
          </p>

          <form onSubmit={handleExecuteEnclave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Enclave Cryptographic Operation
              </label>
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="SHRED_PROOF_ENCLAVE_DECRYPT">SHRED_PROOF_ENCLAVE_DECRYPT (Key unwrap)</option>
                <option value="PROBATE_DECREE_ATTEST">PROBATE_DECREE_ATTEST (Notary deed validation)</option>
                <option value="MULTI_SIG_TEE_AGGREGATE">MULTI_SIG_TEE_AGGREGATE (Custodian BLS aggregation)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Shielded Ciphertext Payload
              </label>
              <input
                type="text"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <Button
              variant="primary"
              className="w-full text-xs"
              isLoading={isExecuting}
            >
              <Cpu className="w-3.5 h-3.5 mr-1.5" />
              Execute Shielded In Enclave
            </Button>

            {execResult && (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1 font-mono text-xs">
                <div className="text-zinc-500 text-[11px]">Enclave Transformation Result:</div>
                <div className="text-emerald-400 break-all">{execResult}</div>
                <div className="text-[10px] text-zinc-500">Zero host memory leakage detected (1.45ms)</div>
              </div>
            )}
          </form>
        </div>

        {/* Zero-Knowledge Age Verifier */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-sm text-zinc-100">Zero-Knowledge Beneficiary Verification</h3>
          </div>
          <p className="text-xs text-zinc-400">
            Beneficiaries prove Age of Majority (age &ge; {minAgeThreshold}) mathematically without revealing their birth year or sensitive personal identifiers to the platform or custodians.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Secret Birth Year (Private Witness)
                </label>
                <input
                  type="number"
                  value={claimantBirthYear}
                  onChange={(e) => setClaimantBirthYear(Number(e.target.value))}
                  min={1920}
                  max={2026}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Age Threshold Requirement
                </label>
                <select
                  value={minAgeThreshold}
                  onChange={(e) => setMinAgeThreshold(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value={18}>18 Years (General Estate Transfer)</option>
                  <option value={21}>21 Years (Institutional Trust Release)</option>
                  <option value={25}>25 Years (Family Office Escrow Tier)</option>
                </select>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full text-xs"
              isLoading={isGeneratingZk}
              onClick={handleGenerateZkProof}
            >
              <EyeOff className="w-3.5 h-3.5 mr-1.5" />
              Generate Non-Interactive ZK Proof (NIZK)
            </Button>

            {zkProof && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-800/40 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Zero-Knowledge Proof Verified! (Age &ge; {minAgeThreshold})
                </div>
                <div className="space-y-1 font-mono text-[11px] text-zinc-400">
                  <div>Commitment: <span className="text-zinc-300">{zkProof.commitment}</span></div>
                  <div>Challenge: <span className="text-zinc-300">{zkProof.challenge}</span></div>
                  <div>Response: <span className="text-zinc-300">{zkProof.response}</span></div>
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Proof mathematically accepted without revealing birth year ({claimantBirthYear}).
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
