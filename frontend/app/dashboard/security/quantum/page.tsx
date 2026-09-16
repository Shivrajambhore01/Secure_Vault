"use client";

import * as React from "react";
import {
  ShieldCheck,
  Cpu,
  Lock,
  Key,
  Layers,
  CheckCircle2,
  FileCheck2,
  Copy,
  Check,
  Terminal,
  Zap,
  Sparkles,
} from "lucide-react";
import {
  Button,
  DataTable,
  ColumnDef,
  StatusBadge,
  MetricCard,
} from "@/components/design-system";

interface AlgorithmComparison {
  domain: string;
  classicalAlgo: string;
  classicalQuantumStatus: string;
  pqcAlgo: string;
  nistStandard: string;
  securityStrength: string;
}

const ALGORITHM_MATRIX: AlgorithmComparison[] = [
  {
    domain: "Key Encapsulation (KEM)",
    classicalAlgo: "RSA-4096 / ECDH-P256",
    classicalQuantumStatus: "VULNERABLE (Shor's)",
    pqcAlgo: "X25519 + ML-KEM-768 (Kyber)",
    nistStandard: "NIST FIPS 203",
    securityStrength: "Category 3 (192-bit Quantum)",
  },
  {
    domain: "Digital Signatures (RON)",
    classicalAlgo: "ECDSA / RSA-PSS",
    classicalQuantumStatus: "VULNERABLE (Shor's)",
    pqcAlgo: "ML-DSA-65 (Dilithium)",
    nistStandard: "NIST FIPS 204",
    securityStrength: "Category 3 (192-bit Quantum)",
  },
  {
    domain: "Stateful Hash Signatures",
    classicalAlgo: "Ed25519",
    classicalQuantumStatus: "VULNERABLE (Shor's)",
    pqcAlgo: "SLH-DSA-SHA2-192s (SPHINCS+)",
    nistStandard: "NIST FIPS 205",
    securityStrength: "Category 3 (Stateless Hash)",
  },
  {
    domain: "Symmetric Encryption",
    classicalAlgo: "AES-128-CBC",
    classicalQuantumStatus: "WEAKENED (Grover's)",
    pqcAlgo: "AES-256-GCM / ChaCha20-Poly1305",
    nistStandard: "NIST SP 800-38D",
    securityStrength: "128-bit Post-Quantum",
  },
];

export default function QuantumSecurityPage() {
  const [copiedLabel, setCopiedLabel] = React.useState<string | null>(null);
  const [plaintextInput, setPlaintextInput] = React.useState("mnemonic: alpine arctic crystal matrix orbit silver legacy vault 2026");
  const [isEncapsulating, setIsEncapsulating] = React.useState(false);
  const [encapsulatedResult, setEncapsulatedResult] = React.useState<any>(null);
  const [deedText, setDeedText] = React.useState("IRREVOCABLE ESTATE CONVEYANCE: All sovereign assets in Vault #7792 are hereby bequeathed to Eleanor Vance.");
  const [isSigning, setIsSigning] = React.useState(false);
  const [signatureResult, setSignatureResult] = React.useState<any>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  const handleSimulateEncapsulation = () => {
    setIsEncapsulating(true);
    setTimeout(() => {
      setIsEncapsulating(false);
      setEncapsulatedResult({
        key_id: "pqc_key_primary_vault_01",
        algorithm: "HYBRID_X25519_ML_KEM_768",
        classical_ephemeral_pubkey: "u7hK3...X25519EphemPublicKey...",
        pqc_kem_ciphertext: "88Fa2B19c...ML_KEM_768_Ciphertext_Matrix_1088_bytes...",
        ciphertext: "d9e8f7a6b5c4...AES256GCM_Encrypted_Secret_Payload...",
        nonce: "7a8b9c0d1e2f",
        created_at: new Date().toISOString(),
      });
    }, 600);
  };

  const handleSimulateSignDeed = () => {
    setIsSigning(true);
    setTimeout(() => {
      setIsSigning(false);
      setSignatureResult({
        signature_id: `pqc_sig_${Math.random().toString(16).slice(2, 12)}`,
        algorithm: "ML_DSA_65_DILITHIUM",
        digest: "74b1e4c9f1a2b3c4...SHA3_256_Document_Digest...",
        signature: "33A19F8...ML_DSA_Lattice_Signature_3309_bytes...",
        verified: true,
        signed_at: new Date().toISOString(),
      });
    }, 600);
  };

  const columns: ColumnDef<AlgorithmComparison>[] = [
    {
      header: "Cryptographic Domain",
      accessorKey: "domain",
      cell: (item) => <span className="font-semibold text-xs text-zinc-200">{item.domain}</span>,
    },
    {
      header: "Classical Suite",
      accessorKey: "classicalAlgo",
      cell: (item) => <span className="font-mono text-xs text-zinc-400">{item.classicalAlgo}</span>,
    },
    {
      header: "Quantum Threat Status",
      accessorKey: "classicalQuantumStatus",
      cell: (item) => (
        <StatusBadge
          status={item.classicalQuantumStatus}
          variant={item.classicalQuantumStatus.includes("VULNERABLE") ? "rejected" : "warning"}
        />
      ),
    },
    {
      header: "SecureVault PQC Suite",
      accessorKey: "pqcAlgo",
      cell: (item) => (
        <span className="font-mono text-xs text-cyan-300 font-semibold bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
          {item.pqcAlgo}
        </span>
      ),
    },
    {
      header: "NIST Standard",
      accessorKey: "nistStandard",
      cell: (item) => <span className="text-xs text-indigo-400">{item.nistStandard}</span>,
    },
    {
      header: "Security Strength",
      accessorKey: "securityStrength",
      cell: (item) => <span className="text-xs text-zinc-400">{item.securityStrength}</span>,
    },
  ];

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto text-zinc-100">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Post-Quantum Cryptography & Enclaves
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                NIST FIPS 203 (ML-KEM / Kyber-768) hybrid key encapsulation & FIPS 204 (ML-DSA / Dilithium) signatures
              </p>
            </div>
          </div>
        </div>

        {/* Global CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            className="text-xs"
            onClick={handleSimulateEncapsulation}
            isLoading={isEncapsulating}
          >
            <Key className="w-3.5 h-3.5 mr-1.5" />
            Generate Hybrid PQC Keypair
          </Button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Quantum Readiness"
          value="100% SECURED"
          subtitle="NIST FIPS 203 & 204"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          title="Hybrid KEM Suite"
          value="ML-KEM-768"
          subtitle="Dual X25519 + Lattice fusion"
          icon={<Layers className="w-5 h-5 text-cyan-400" />}
        />
        <MetricCard
          title="Post-Quantum Signatures"
          value="ML-DSA-65"
          subtitle="Lattice-based Dilithium deeds"
          icon={<FileCheck2 className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="HNDL Immunity"
          value="ACTIVE"
          subtitle="Harvest-Now-Decrypt-Later proof"
          icon={<Lock className="w-5 h-5 text-amber-400" />}
        />
      </div>

      {/* Cryptographic Agility Comparison Table */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-md">
        <h2 className="text-base font-semibold text-zinc-100 mb-1">
          Cryptographic Algorithm Agility & Quantum Threat Matrix
        </h2>
        <p className="text-xs text-zinc-400 mb-4">
          All vault assets and remote online notarizations are encapsulated with hybrid post-quantum defenses to survive quantum cryptanalysis.
        </p>

        <DataTable
          data={ALGORITHM_MATRIX}
          columns={columns}
          searchPlaceholder="Search algorithm or standard..."
          pageSize={4}
        />
      </div>

      {/* Interactive Sandboxes: KEM & Signatures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sandbox 1: Hybrid KEM Encapsulation */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-sm text-zinc-100">
              Hybrid Key Encapsulation (ML-KEM-768 + X25519)
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Fuses classical elliptic curve Diffie-Hellman with Module Learning With Errors (MLWE) lattice secrets to encrypt the symmetric data key.
          </p>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Sample Vault Asset Secret Content
            </label>
            <input
              type="text"
              value={plaintextInput}
              onChange={(e) => setPlaintextInput(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <Button
            variant="secondary"
            className="w-full text-xs"
            onClick={handleSimulateEncapsulation}
            isLoading={isEncapsulating}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            Simulate Hybrid Encapsulation
          </Button>

          {encapsulatedResult && (
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-xs font-mono space-y-2 text-zinc-300">
              <div className="flex justify-between text-cyan-400 font-bold border-b border-zinc-800/80 pb-1">
                <span>{encapsulatedResult.algorithm}</span>
                <span className="text-emerald-400 text-xs">ENVELOPE SEALED</span>
              </div>
              <div>
                <span className="text-zinc-500">X25519 Ephemeral Key:</span>
                <p className="text-zinc-300 truncate">{encapsulatedResult.classical_ephemeral_pubkey}</p>
              </div>
              <div>
                <span className="text-zinc-500">ML-KEM-768 Lattice Ciphertext:</span>
                <p className="text-cyan-300 truncate">{encapsulatedResult.pqc_kem_ciphertext}</p>
              </div>
              <div>
                <span className="text-zinc-500">AES-256-GCM Ciphertext:</span>
                <p className="text-zinc-400 truncate">{encapsulatedResult.ciphertext}</p>
              </div>
            </div>
          )}
        </div>

        {/* Sandbox 2: Post-Quantum Digital Signatures */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-sm text-zinc-100">
              Post-Quantum Deed Notarization (ML-DSA-65)
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Produces irrevocable quantum-forgery-proof digital signatures over legal inheritance decrees and notary certifications.
          </p>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Inheritance Decree / Deed Statement
            </label>
            <textarea
              rows={3}
              value={deedText}
              onChange={(e) => setDeedText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <Button
            variant="secondary"
            className="w-full text-xs"
            onClick={handleSimulateSignDeed}
            isLoading={isSigning}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
            Apply Post-Quantum Dilithium Signature
          </Button>

          {signatureResult && (
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-xs font-mono space-y-2 text-zinc-300">
              <div className="flex justify-between text-indigo-400 font-bold border-b border-zinc-800/80 pb-1">
                <span>{signatureResult.algorithm}</span>
                <span className="text-emerald-400 text-xs">FORGERY-PROOF VERIFIED</span>
              </div>
              <div>
                <span className="text-zinc-500">Document SHA3-256 Digest:</span>
                <p className="text-zinc-300 truncate">{signatureResult.digest}</p>
              </div>
              <div>
                <span className="text-zinc-500">Dilithium Lattice Signature:</span>
                <p className="text-indigo-300 truncate">{signatureResult.signature}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
