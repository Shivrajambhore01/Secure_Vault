"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Shield,
  Lock,
  Clock,
  Users,
  FileKey,
  Blocks,
  CheckCircle2,
  X,
  KeyRound,
  Cpu,
} from "lucide-react";

/**
 * Custom SecureVault Geometric Mark — stylized interlocking secure cryptographic enclave.
 */
function LogoIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M 128.005 191.173 C 128.448 156.208 156.93 128 192 128 L 192 64 L 128 64 C 128 99.346 99.346 128 64 128 L 64 192 L 128 192 Z M 192 256 L 64 256 C 28.654 256 0 227.346 0 192 L 0 64 L 64 64 L 64 0 L 192 0 C 227.346 0 256 28.654 256 64 L 256 192 L 192 192 Z" />
    </svg>
  );
}

// 1. Hero Cryptographic Standards Marquee Items
const HERO_STANDARDS = [
  {
    name: "AES-256-GCM",
    style: {
      fontFamily: "Georgia, serif",
      fontWeight: 700,
      letterSpacing: "-0.02em",
      fontSize: "15px",
    },
  },
  {
    name: "FIPS 203 ML-KEM",
    style: {
      fontFamily: "Arial, sans-serif",
      fontWeight: 900,
      letterSpacing: "0.08em",
      fontSize: "13px",
      textTransform: "uppercase" as const,
    },
  },
  {
    name: "AWS Nitro Enclave",
    style: {
      fontFamily: "'Trebuchet MS', sans-serif",
      fontWeight: 600,
      letterSpacing: "0.01em",
      fontSize: "15px",
      fontStyle: "italic" as const,
    },
  },
  {
    name: "Argon2id KDF",
    style: {
      fontFamily: "'Courier New', monospace",
      fontWeight: 700,
      letterSpacing: "0.12em",
      fontSize: "13px",
      textTransform: "uppercase" as const,
    },
  },
  {
    name: "Shamir (k, n) Secret",
    style: {
      fontFamily: "Palatino, 'Book Antiqua', serif",
      fontWeight: 400,
      letterSpacing: "-0.01em",
      fontSize: "16px",
    },
  },
  {
    name: "FIPS 204 ML-DSA",
    style: {
      fontFamily: "Impact, 'Arial Narrow', sans-serif",
      fontWeight: 400,
      letterSpacing: "0.04em",
      fontSize: "14px",
    },
  },
  {
    name: "W3C WebAuthn",
    style: {
      fontFamily: "Verdana, sans-serif",
      fontWeight: 700,
      letterSpacing: "-0.03em",
      fontSize: "13px",
    },
  },
];

// 2. Audit & Regulatory Compliance Marquee Items
const COMPLIANCE_FRAMEWORKS = [
  {
    name: "SOC2 Type II Certified",
    style: {
      fontFamily: "'Times New Roman', serif",
      fontWeight: 400,
      letterSpacing: "0.02em",
      fontSize: "14px",
    },
  },
  {
    name: "ISO/IEC 27001",
    style: {
      fontFamily: "'Arial Black', sans-serif",
      fontWeight: 900,
      letterSpacing: "0.08em",
      fontSize: "16px",
    },
  },
  {
    name: "HIPAA Security Rule",
    style: {
      fontFamily: "Impact, sans-serif",
      fontWeight: 700,
      letterSpacing: "0.05em",
      fontSize: "18px",
    },
  },
  {
    name: "GDPR Article 32",
    style: {
      fontFamily: "Georgia, serif",
      fontWeight: 600,
      letterSpacing: "-0.02em",
      fontSize: "17px",
    },
  },
  {
    name: "NIST Quantum FIPS",
    style: {
      fontFamily: "Helvetica, Arial, sans-serif",
      fontWeight: 700,
      letterSpacing: "-0.01em",
      fontSize: "15px",
    },
  },
  {
    name: "YubiKey FIDO2 Level 3",
    style: {
      fontFamily: "Verdana, sans-serif",
      fontWeight: 700,
      letterSpacing: "0.06em",
      fontSize: "14px",
      textTransform: "uppercase" as const,
    },
  },
  {
    name: "Intel SGX Hardware TEE",
    style: {
      fontFamily: "'Courier New', monospace",
      fontWeight: 700,
      letterSpacing: "0.18em",
      fontSize: "14px",
    },
  },
  {
    name: "Ethereum Smart Escrow",
    style: {
      fontFamily: "Palatino, serif",
      fontWeight: 500,
      letterSpacing: "0.03em",
      fontSize: "15px",
    },
  },
];

// 3. Core Feature Pillars (Imported from SecureVault domain)
const CORE_PILLARS = [
  {
    icon: Lock,
    title: "AES-256-GCM Envelope Encryption",
    description:
      "Every credential, recovery phrase, and document is sealed with unique per-asset Data Encryption Keys.",
  },
  {
    icon: Clock,
    title: "Digital Dead Man's Switch",
    description:
      "Continuous heartbeat monitoring detects prolonged inactivity and autonomously initiates escalation alerts.",
  },
  {
    icon: Users,
    title: "Multi-Tier Nominee Allocation",
    description:
      "Designate primary and contingent heirs with precise percentage allocation matrices and fraud protection.",
  },
  {
    icon: Cpu,
    title: "Post-Quantum & TEE Enclaves",
    description:
      "Hardware-isolated AWS Nitro memory enclaves and FIPS 203 ML-KEM lattice cryptography immune to quantum decryption.",
  },
];

export default function SecureVaultLandingPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = React.useState(false);

  const handleLogin = () => {
    router.push("/login");
  };

  const handleRegister = () => {
    router.push("/signup");
  };

  const scrollToInfo = () => {
    const el = document.getElementById("meet-securevault");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col bg-[#F5F5F5] min-h-screen text-black antialiased selection:bg-black selection:text-white font-tt-norms">
      {/* Scoped CSS Keyframe Marquees */}
      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @keyframes backers-marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee 22s linear infinite;
        }
        .backers-track {
          display: flex;
          width: max-content;
          animation: backers-marquee 30s linear infinite;
        }
        .marquee-track:hover,
        .backers-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* =========================================================================
          SECTION 1: NAVBAR + HERO SECTION
          Wrapped in a h-screen flex flex-col overflow-hidden container
          ========================================================================= */}
      <div className="h-screen flex flex-col overflow-hidden relative w-full">
        {/* 1. Navbar (absolute, transparent over hero) */}
        <nav className="absolute top-0 left-0 right-0 z-20 px-6 py-5">
          <div className="flex items-center justify-between max-w-[88rem] mx-auto w-full">
            {/* Left: LogoIcon + word "SecureVault" */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <LogoIcon className="w-7 h-7 text-black transition-transform duration-200 group-hover:scale-105" />
              <span className="text-2xl font-medium tracking-tight text-black">
                SecureVault
              </span>
            </Link>

            {/* Center (hidden below md): links Features · Dead Man's Switch · Security · Compliance · Docs */}
            <div className="hidden md:flex items-center gap-8 text-base text-gray-700 font-medium">
              <Link
                href="#meet-securevault"
                className="hover:text-black transition-colors duration-200"
              >
                Features
              </Link>
              <Link
                href="#meet-securevault"
                className="hover:text-black transition-colors duration-200"
              >
                Dead Man's Switch
              </Link>
              <Link
                href="#use-cases"
                className="hover:text-black transition-colors duration-200"
              >
                Security & Enclaves
              </Link>
              <Link
                href="/dashboard/compliance/solvency"
                className="hover:text-black transition-colors duration-200"
              >
                Compliance
              </Link>
              <Link
                href="/dashboard/developers"
                className="hover:text-black transition-colors duration-200"
              >
                Docs
              </Link>
            </div>

            {/* Right: Sign In link + black pill button "Create Vault" */}
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-base font-medium text-black/80 hover:text-black transition-colors px-2 py-1"
              >
                Sign In
              </Link>
              <button
                onClick={handleRegister}
                className="bg-black text-white text-base font-medium px-7 py-2.5 rounded-full hover:bg-gray-800 transition-colors duration-200 cursor-pointer shadow-sm active:scale-95"
              >
                Create Vault
              </button>
            </div>
          </div>
        </nav>

        {/* 2. Hero Section */}
        <div className="flex-1 px-6 pt-20 pb-6 flex items-end w-full">
          {/* Inner card with height: calc(100vh - 96px) */}
          <div
            className="relative w-full rounded-2xl overflow-hidden max-w-[88rem] mx-auto"
            style={{ height: "calc(100vh - 96px)" }}
          >
            {/* Background video */}
            <video
              autoPlay
              muted
              loop
              playsInline
              className="object-cover absolute inset-0 w-full h-full"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4"
            />

            {/* Content overlay */}
            <div className="relative z-10 flex flex-col items-start justify-start h-full p-8 md:p-12 pt-28 md:pt-36">
              {/* Heading */}
              <h1
                className="text-black text-5xl md:text-6xl font-medium leading-tight max-w-xl mb-4"
                style={{ letterSpacing: "-0.04em" }}
              >
                Your Legacy
                <br />
                Guaranteed
              </h1>

              {/* Subheading Paragraph */}
              <p
                className="text-black/70 text-base md:text-lg max-w-md mb-8 leading-relaxed"
                style={{
                  fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
                }}
              >
                An autonomous, defense-grade digital inheritance platform built
                for sovereign custody, post-quantum resilience, and guaranteed
                transfer to your heirs.
              </p>

              {/* Pill button "Create Vault" with arrow circle */}
              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={handleRegister}
                  className="inline-flex items-center gap-3 bg-black text-white text-base md:text-lg font-medium pl-8 pr-2 py-2 rounded-full hover:bg-gray-800 transition-colors duration-200 cursor-pointer shadow-md group active:scale-95"
                >
                  <span>Create Vault</span>
                  <span className="bg-white rounded-full p-2 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowRight className="w-5 h-5 text-black" />
                  </span>
                </button>

                <Link
                  href="/login"
                  className="text-sm font-medium text-black/70 hover:text-black transition-colors pl-2"
                >
                  Already protected? Access Vault →
                </Link>
              </div>

              {/* Brand Marquee (inside hero, below button) */}
              <div className="mt-auto md:mt-24 w-full max-w-md overflow-hidden pb-4 md:pb-0">
                <div className="marquee-track flex items-center">
                  {/* First render */}
                  {HERO_STANDARDS.map((b, idx) => (
                    <span
                      key={`b1-${idx}`}
                      className="mx-7 shrink-0 text-black/60 whitespace-nowrap select-none"
                      style={b.style}
                    >
                      {b.name}
                    </span>
                  ))}
                  {/* Second render for seamless loop */}
                  {HERO_STANDARDS.map((b, idx) => (
                    <span
                      key={`b2-${idx}`}
                      className="mx-7 shrink-0 text-black/60 whitespace-nowrap select-none"
                      style={b.style}
                    >
                      {b.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: INFO SECTION ("Meet SecureVault.")
          ========================================================================= */}
      <section id="meet-securevault" className="bg-[#F5F5F5] px-6 py-24 w-full">
        <div className="max-w-[88rem] mx-auto">
          {/* Row 1: 2-col grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16 items-start">
            {/* Left */}
            <div>
              <h2
                className="text-black text-4xl md:text-5xl font-medium leading-tight mb-8"
                style={{ letterSpacing: "-0.03em" }}
              >
                Meet SecureVault.
              </h2>
              {/* Black pill "Discover Protocol" button with white arrow circle */}
              <button
                onClick={scrollToInfo}
                className="inline-flex items-center gap-3 bg-black text-white text-base font-medium pl-6 pr-2 py-1.5 rounded-full hover:bg-gray-800 transition-colors duration-200 cursor-pointer group shadow-sm active:scale-95"
              >
                <span>Discover Protocol</span>
                <span className="bg-white rounded-full p-2 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight className="w-4 h-4 text-black" />
                </span>
              </button>
            </div>

            {/* Right */}
            <div>
              <p className="text-black/70 text-2xl md:text-3xl leading-relaxed font-normal">
                SecureVault is an institutional digital inheritance platform that
                guarantees your passwords, crypto assets, and family wealth safely
                transition to your nominees only when verified life events occur.
              </p>
            </div>
          </div>

          {/* Row 2: 4-col card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 (spans 2 cols on lg): with background image */}
            <div
              className="lg:col-span-2 rounded-2xl relative overflow-hidden flex flex-col justify-between p-7 min-h-80 shadow-sm border border-black/5"
              style={{
                backgroundImage: `url('https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260423_164207_f243351d-ed59-48ec-83a0-a5e996bdbe3c.png&w=1280&q=85')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Top Title */}
              <h3
                className="text-black text-2xl font-medium leading-snug"
                style={{ letterSpacing: "-0.02em" }}
              >
                Inheritance that endures
              </h3>

              {/* Bottom Body */}
              <p className="text-black/70 text-base max-w-xs leading-relaxed">
                Gain absolute certainty as your credentials and custody seeds
                are shielded in military-grade AES-256-GCM and post-quantum
                lattice enclaves.
              </p>
            </div>

            {/* Card 2: solid #2B2644 */}
            <div className="bg-[#2B2644] rounded-2xl p-7 min-h-80 flex flex-col justify-between shadow-sm">
              <h3
                className="text-white text-2xl font-medium leading-snug whitespace-pre-line"
                style={{ letterSpacing: "-0.02em" }}
              >
                Always protected,
                {"\n"}always sovereign.
              </h3>
              <p className="text-white/60 text-base leading-relaxed">
                Retain 100% control with "I Am Alive" heartbeats, PIN emergency
                freeze, and unilateral living-owner vetoes.
              </p>
            </div>

            {/* Card 3: same #2B2644 */}
            <div className="bg-[#2B2644] rounded-2xl p-7 min-h-80 flex flex-col justify-between shadow-sm">
              <h3
                className="text-white text-2xl font-medium leading-snug whitespace-pre-line"
                style={{ letterSpacing: "-0.02em" }}
              >
                Autonomous
                {"\n"}Dead Man's Switch
              </h3>
              <p className="text-white/60 text-base leading-relaxed">
                Skip the catastrophic risk of lost seed phrases or legal probate
                gridlock. SecureVault monitors inactivity and transfers assets
                autonomously.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: BACKED & AUDITED BY SECTION (marquee row)
          ========================================================================= */}
      <section className="bg-[#F5F5F5] px-6 py-12 w-full border-t border-b border-black/[0.06]">
        <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
          {/* Left col (1/4) */}
          <div className="text-black/70 text-base leading-relaxed whitespace-pre-line font-medium">
            Audited against premier frameworks
            {"\n"}and institutional standards.
          </div>

          {/* Right col (3/4): infinite marquee */}
          <div className="md:col-span-3 overflow-hidden w-full">
            <div className="backers-track flex items-center">
              {/* First render */}
              {COMPLIANCE_FRAMEWORKS.map((item, idx) => (
                <span
                  key={`backer1-${idx}`}
                  className="mx-10 shrink-0 text-black/50 whitespace-nowrap select-none"
                  style={item.style}
                >
                  {item.name}
                </span>
              ))}
              {/* Second render for seamless loop */}
              {COMPLIANCE_FRAMEWORKS.map((item, idx) => (
                <span
                  key={`backer2-${idx}`}
                  className="mx-10 shrink-0 text-black/50 whitespace-nowrap select-none"
                  style={item.style}
                >
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: USE CASES SECTION ("Custody modes")
          ========================================================================= */}
      <section id="use-cases" className="bg-[#F5F5F5] px-6 py-24 w-full">
        <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left column */}
          <div className="md:pr-12 md:pt-2">
            <div className="text-black/60 text-sm mb-2 font-medium tracking-wide">
              SecureVault in Practice
            </div>
            <h2
              className="text-5xl md:text-6xl font-medium leading-none mb-6 text-black"
              style={{ letterSpacing: "-0.04em" }}
            >
              Custody modes
            </h2>
            <p className="text-black/60 text-base leading-relaxed max-w-sm">
              SecureVault powers a comprehensive range of succession and
              contingency modes for family offices, founders, crypto investors,
              and fiduciaries wanting unbreakable continuity.
            </p>

            {/* Feature Mini Cards */}
            <div className="mt-10 space-y-4 max-w-sm">
              {CORE_PILLARS.map((p, idx) => {
                const Icon = p.icon;
                return (
                  <div
                    key={idx}
                    className="p-4 bg-white/70 border border-black/5 rounded-xl shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 text-black font-medium text-sm mb-1">
                      <Icon className="w-4 h-4 text-black" />
                      <span>{p.title}</span>
                    </div>
                    <p className="text-xs text-black/60 leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column: large relative rounded-3xl overflow-hidden min-h-[720px] with background video */}
          <div className="relative rounded-3xl overflow-hidden min-h-[720px] w-full shadow-lg border border-black/5 flex flex-col justify-start">
            {/* Background video */}
            <video
              autoPlay
              muted
              loop
              playsInline
              className="object-cover absolute inset-0 w-full h-full"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_183428_ab5e672a-f608-4dcb-b319-f3e040f02e2d.mp4"
            />

            {/* Overlay content */}
            <div className="relative z-10 p-10 md:p-12 flex flex-col justify-start h-full">
              <h3
                className="text-4xl md:text-5xl font-medium leading-tight mb-5 text-black"
                style={{ letterSpacing: "-0.03em" }}
              >
                Family Trusts & Estates
              </h3>
              <p className="text-black/70 text-base max-w-md mb-8 leading-relaxed">
                Protect generational wealth by configuring multi-tier nominee
                allocations, 30-day cooling-off delays, and zero-knowledge age
                verification with zero risk of premature asset exposure.
              </p>

              {/* Inline-flex link "Know more" with leading circular icon */}
              <div>
                <button
                  onClick={() => setModalOpen(true)}
                  className="inline-flex items-center gap-3 group text-black font-medium text-base hover:opacity-80 transition-opacity cursor-pointer active:scale-95"
                >
                  <span className="w-9 h-9 rounded-full bg-white/80 backdrop-blur flex items-center justify-center group-hover:bg-white transition-colors shadow-sm">
                    <ArrowRight className="w-4 h-4 text-black transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                  <span>Know more</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          INTERACTIVE INTEGRATION MODAL ("Know more")
          ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative border border-gray-100">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-black text-white rounded-xl">
                <LogoIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-medium tracking-tight text-black">
                  SecureVault Lifecycle Protocol
                </h4>
                <p className="text-xs text-gray-500">Autonomous Digital Inheritance</p>
              </div>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Protect your wealth in 4 simple autonomous steps. SecureVault guarantees
              that your sensitive digital items transition seamlessly to your heirs.
            </p>

            <div className="space-y-3 mb-6">
              <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-3 text-xs text-gray-800">
                <span className="font-mono font-bold bg-black text-white px-2 py-0.5 rounded text-[11px]">
                  01
                </span>
                <div>
                  <div className="font-semibold text-gray-900">Create Vault & Setup PIN</div>
                  <div className="text-gray-500 text-[11px]">Argon2id hashing & TOTP MFA protection.</div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-3 text-xs text-gray-800">
                <span className="font-mono font-bold bg-black text-white px-2 py-0.5 rounded text-[11px]">
                  02
                </span>
                <div>
                  <div className="font-semibold text-gray-900">Upload & Envelope Encrypt</div>
                  <div className="text-gray-500 text-[11px]">Unique per-asset AES-256-GCM DEK cipher keys.</div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-3 text-xs text-gray-800">
                <span className="font-mono font-bold bg-black text-white px-2 py-0.5 rounded text-[11px]">
                  03
                </span>
                <div>
                  <div className="font-semibold text-gray-900">Assign Nominees & Splits</div>
                  <div className="text-gray-500 text-[11px]">Percentage allocations and signed invitations.</div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-3 text-xs text-gray-800">
                <span className="font-mono font-bold bg-black text-white px-2 py-0.5 rounded text-[11px]">
                  04
                </span>
                <div>
                  <div className="font-semibold text-gray-900">Autonomous Succession Transfer</div>
                  <div className="text-gray-500 text-[11px]">Dead Man's Switch, cooling period & ZK release.</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setModalOpen(false);
                  router.push("/signup");
                }}
                className="flex-1 bg-black text-white font-medium py-3 rounded-full hover:bg-gray-800 transition-colors text-sm text-center shadow-sm"
              >
                Create Free Vault
              </button>
              <button
                onClick={() => {
                  setModalOpen(false);
                  router.push("/login");
                }}
                className="flex-1 bg-gray-100 text-black font-medium py-3 rounded-full hover:bg-gray-200 transition-colors text-sm text-center"
              >
                Sign In to Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
