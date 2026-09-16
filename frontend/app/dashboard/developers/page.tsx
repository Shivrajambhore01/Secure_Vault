"use client";

import * as React from "react";
import {
  Code,
  Download,
  ExternalLink,
  Key,
  Shield,
  Copy,
  Check,
  Terminal,
  Zap,
  BookOpen,
  FileJson,
  Cpu,
  RefreshCw,
  Lock,
} from "lucide-react";
import {
  Button,
  DataTable,
  ColumnDef,
  StatusBadge,
  MetricCard,
} from "@/components/design-system";

interface EndpointDoc {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  tag: string;
  summary: string;
  authRequired: boolean;
  rateLimit: string;
}

const ENDPOINTS_CATALOG: EndpointDoc[] = [
  {
    id: "ep-1",
    method: "GET",
    path: "/api/v1/health",
    tag: "Health",
    summary: "System availability, uptime telemetry, and health probe",
    authRequired: false,
    rateLimit: "120/min",
  },
  {
    id: "ep-2",
    method: "GET",
    path: "/api/v1/system/health/deep",
    tag: "System Operations",
    summary: "Deep multi-subsystem probe across MongoDB, Task Queue, and Workers",
    authRequired: false,
    rateLimit: "30/min",
  },
  {
    id: "ep-3",
    method: "GET",
    path: "/api/v1/docs/export",
    tag: "Documentation",
    summary: "Export raw OpenAPI 3.1 JSON contract specification",
    authRequired: false,
    rateLimit: "60/min",
  },
  {
    id: "ep-4",
    method: "POST",
    path: "/api/v1/auth/login",
    tag: "Auth",
    summary: "Argon2id password verification, JWT issuance, and MFA challenge",
    authRequired: false,
    rateLimit: "10/min",
  },
  {
    id: "ep-5",
    method: "POST",
    path: "/api/v1/users/heartbeat",
    tag: "Heartbeat",
    summary: "Send 'I Am Alive' signal to reset Dead Man's Switch timer",
    authRequired: true,
    rateLimit: "60/min",
  },
  {
    id: "ep-6",
    method: "POST",
    path: "/api/v1/assets",
    tag: "Assets",
    summary: "Store AES-256-GCM zero-knowledge encrypted digital inheritance asset",
    authRequired: true,
    rateLimit: "30/min",
  },
  {
    id: "ep-7",
    method: "GET",
    path: "/api/v1/nominees",
    tag: "Nominees",
    summary: "List enrolled primary, contingent, and secondary beneficiaries",
    authRequired: true,
    rateLimit: "60/min",
  },
  {
    id: "ep-8",
    method: "POST",
    path: "/api/v1/claims",
    tag: "Claims",
    summary: "Submit death certificate claim with automated fraud risk scoring",
    authRequired: false,
    rateLimit: "10/min",
  },
  {
    id: "ep-9",
    method: "POST",
    path: "/api/v1/claims/{id}/dispute",
    tag: "Claims",
    summary: "Vault owner 1-click emergency dispute and instant claim nullification",
    authRequired: true,
    rateLimit: "20/min",
  },
  {
    id: "ep-10",
    method: "GET",
    path: "/api/v1/siem/audit/verify",
    tag: "SIEM",
    summary: "Verify SHA-256 cryptographic hash-chain integrity of audit ledger",
    authRequired: true,
    rateLimit: "20/min",
  },
  {
    id: "ep-11",
    method: "POST",
    path: "/api/v1/compliance/export/gdpr",
    tag: "Compliance",
    summary: "Generate GDPR/CCPA Article 20 cryptographically signed data export",
    authRequired: true,
    rateLimit: "5/min",
  },
  {
    id: "ep-12",
    method: "POST",
    path: "/api/v1/system/trigger/{job_type}",
    tag: "System Operations",
    summary: "Enqueue prioritized system maintenance sweep job to worker pool",
    authRequired: true,
    rateLimit: "15/min",
  },
];

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = React.useState<"endpoints" | "quickstart" | "webhooks" | "specs">("endpoints");
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = React.useState<EndpointDoc>(ENDPOINTS_CATALOG[0]);
  const [apiKey, setApiKey] = React.useState("sk_live_sv_sec_99482718471928471928");
  const [jwtToken, setJwtToken] = React.useState("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfdmF1bHQiLCJleHAiOjE3ODk1NzA0MDB9...");
  const [webhookSecret, setWebhookSecret] = React.useState("whsec_547f893a2b1c4e9081237a6b");
  const [webhookPayload, setWebhookPayload] = React.useState(
    JSON.stringify(
      {
        event: "idv.session.verified",
        sessionId: "idv_session_9921",
        claimId: "clm_849201",
        status: "APPROVED",
        confidence: 0.985,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-sky-500/10 text-sky-400 border border-sky-500/30";
      case "POST":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
      case "PUT":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/30";
      case "DELETE":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/30";
      default:
        return "bg-zinc-800 text-zinc-300";
    }
  };

  const endpointColumns: ColumnDef<EndpointDoc>[] = [
    {
      header: "Method",
      accessorKey: "method",
      cell: (ep) => (
        <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold tracking-wider ${getMethodBadgeClass(ep.method)}`}>
          {ep.method}
        </span>
      ),
    },
    {
      header: "Endpoint Route",
      accessorKey: "path",
      cell: (ep) => (
        <div className="font-mono text-sm text-zinc-200 hover:text-cyan-400 cursor-pointer transition-colors" onClick={() => setSelectedEndpoint(ep)}>
          {ep.path}
        </div>
      ),
    },
    {
      header: "Category",
      accessorKey: "tag",
      cell: (ep) => <span className="text-xs text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">{ep.tag}</span>,
    },
    {
      header: "Summary",
      accessorKey: "summary",
      cell: (ep) => <span className="text-xs text-zinc-400 line-clamp-1">{ep.summary}</span>,
    },
    {
      header: "Auth",
      accessorKey: "authRequired",
      cell: (ep) => (
        <StatusBadge
          status={ep.authRequired ? "Bearer JWT" : "Public"}
          variant={ep.authRequired ? "warning" : "active"}
        />
      ),
    },
    {
      header: "Rate Limit",
      accessorKey: "rateLimit",
      cell: (ep) => <span className="text-xs font-mono text-zinc-500">{ep.rateLimit}</span>,
    },
  ];

  // Generated cURL snippet
  const generatedCurl = `curl -X ${selectedEndpoint.method} "http://localhost:8000${selectedEndpoint.path}" \\
  -H "Accept: application/json"${selectedEndpoint.authRequired ? ` \\\n  -H "Authorization: Bearer ${jwtToken}"` : ""}${
    selectedEndpoint.method === "POST" ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '{"example": true}'` : ""
  }`;

  // Generated Python snippet
  const generatedPython = `import httpx

client = httpx.Client(base_url="http://localhost:8000")
headers = {
    "Accept": "application/json",${selectedEndpoint.authRequired ? `\n    "Authorization": "Bearer ${jwtToken}",` : ""}
}

response = client.${selectedEndpoint.method.toLowerCase()}(
    "${selectedEndpoint.path}",
    headers=headers,${selectedEndpoint.method === "POST" ? '\n    json={"example": True},' : ""}
)

print(response.status_code, response.json())`;

  // Generated TypeScript snippet
  const generatedTs = `import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Accept': 'application/json',${selectedEndpoint.authRequired ? `\n    'Authorization': 'Bearer \${jwtToken}',` : ""}
  },
});

async function execute() {
  const res = await api.${selectedEndpoint.method.toLowerCase()}('${selectedEndpoint.path}'${
    selectedEndpoint.method === "POST" ? ', { example: true }' : ''
  });
  console.log(res.data);
}`;

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto text-zinc-100">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Developer Hub & OpenAPI Ecosystem
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Machine-readable contracts, interactive API explorer, Postman test collections & webhook signatures
              </p>
            </div>
          </div>
        </div>

        {/* Global Export CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/v1/docs/export"
            target="_blank"
            rel="noopener noreferrer"
            download="securevault_openapi_v2.json"
          >
            <Button variant="secondary" className="border-zinc-700 hover:border-zinc-500 text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              OpenAPI JSON
            </Button>
          </a>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" className="border-zinc-700 hover:border-zinc-500 text-xs">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Interactive Swagger
            </Button>
          </a>
          <a
            href="/redoc"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" className="border-zinc-700 hover:border-zinc-500 text-xs">
              <BookOpen className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Redoc Specs
            </Button>
          </a>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="OpenAPI Spec Version"
          value="v3.1.0"
          subtitle="Enterprise Schema standard"
          icon={<FileJson className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="Documented Endpoints"
          value="48+"
          subtitle="16 Architecture Domains"
          icon={<Cpu className="w-5 h-5 text-cyan-400" />}
        />
        <MetricCard
          title="Authentication Schemes"
          value="Bearer + APIKey"
          subtitle="Argon2id + HMAC-SHA256"
          icon={<Lock className="w-5 h-5 text-emerald-400" />}
        />
        <MetricCard
          title="Distribution Format"
          value="Postman v2.1"
          subtitle="Automated test variables"
          icon={<Zap className="w-5 h-5 text-amber-400" />}
        />
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-800 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("endpoints")}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === "endpoints"
              ? "border-b-2 border-cyan-500 text-cyan-400 font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Code className="w-4 h-4" />
          Interactive API Explorer
        </button>
        <button
          onClick={() => setActiveTab("quickstart")}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === "quickstart"
              ? "border-b-2 border-cyan-500 text-cyan-400 font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Terminal className="w-4 h-4" />
          SDK Quickstart & Snippets
        </button>
        <button
          onClick={() => setActiveTab("webhooks")}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === "webhooks"
              ? "border-b-2 border-cyan-500 text-cyan-400 font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Shield className="w-4 h-4" />
          Webhooks & Signatures
        </button>
        <button
          onClick={() => setActiveTab("specs")}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            activeTab === "specs"
              ? "border-b-2 border-cyan-500 text-cyan-400 font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Download className="w-4 h-4" />
          Postman & CI/CD Export
        </button>
      </div>

      {/* Tab Content: Endpoints */}
      {activeTab === "endpoints" && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-md">
            <h2 className="text-lg font-semibold text-zinc-100 mb-1">
              Core Enterprise API Endpoints
            </h2>
            <p className="text-xs text-zinc-400 mb-4">
              Select any endpoint row below to dynamically inspect request schemas and generate code snippets.
            </p>
            <DataTable
              data={ENDPOINTS_CATALOG}
              columns={endpointColumns}
              searchPlaceholder="Search path, method, or domain..."
              pageSize={8}
            />
          </div>

          {/* Selected Endpoint Preview */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${getMethodBadgeClass(selectedEndpoint.method)}`}>
                  {selectedEndpoint.method}
                </span>
                <span className="font-mono text-zinc-100 text-base font-semibold">
                  {selectedEndpoint.path}
                </span>
              </div>
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => handleCopy(generatedCurl, "curl")}
              >
                {copiedKey === "curl" ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy cURL
                  </>
                )}
              </Button>
            </div>

            <p className="text-sm text-zinc-300 mb-4">{selectedEndpoint.summary}</p>

            <div className="relative rounded-lg bg-zinc-950 p-4 font-mono text-xs text-cyan-300 overflow-x-auto border border-zinc-800">
              <pre>{generatedCurl}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Quickstart */}
      {activeTab === "quickstart" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Credentials / Simulator */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-base font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                Integration Credentials Simulator
              </h2>
              <p className="text-xs text-zinc-400 mb-4">
                Configure your API key or Bearer token below. Code snippets will automatically update.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Bearer JWT Token
                  </label>
                  <input
                    type="text"
                    value={jwtToken}
                    onChange={(e) => setJwtToken(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Enterprise API Key (X-API-Key)
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg text-xs text-zinc-400">
                  <span className="text-cyan-400 font-medium">Tip:</span> Authenticate with <code className="text-zinc-200">/api/v1/auth/login</code> to obtain a session token, or generate a long-lived machine key from Security Admin console.
                </div>
              </div>
            </div>

            {/* Python SDK */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-400" />
                  Python (HTTPX / Requests)
                </h2>
                <button
                  onClick={() => handleCopy(generatedPython, "python")}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  {copiedKey === "python" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === "python" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="bg-zinc-950 p-4 rounded-lg font-mono text-xs text-emerald-300/90 overflow-x-auto border border-zinc-800 h-64">
                <pre>{generatedPython}</pre>
              </div>
            </div>
          </div>

          {/* TypeScript SDK */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <Code className="w-4 h-4 text-sky-400" />
                TypeScript / Node.js (Axios / Fetch)
              </h2>
              <button
                onClick={() => handleCopy(generatedTs, "ts")}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                {copiedKey === "ts" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === "ts" ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="bg-zinc-950 p-4 rounded-lg font-mono text-xs text-sky-300/90 overflow-x-auto border border-zinc-800">
              <pre>{generatedTs}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Webhooks */}
      {activeTab === "webhooks" && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              Cryptographic Webhook Verification (HMAC-SHA256)
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              SecureVault signs all asynchronous outbound notifications (RON Notary events, IDV biometric completions, and Emergency Escalations) with an HMAC-SHA256 signature in the <code className="text-zinc-200">X-Vault-Signature</code> header.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Webhook Secret Key
                </label>
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 mb-4 focus:outline-none focus:border-indigo-500"
                />

                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Simulated Inbound Event Payload
                </label>
                <textarea
                  rows={8}
                  value={webhookPayload}
                  onChange={(e) => setWebhookPayload(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-200">
                  Verification Implementation (Node.js & Python)
                </h3>
                <div className="bg-zinc-950 p-4 rounded-lg font-mono text-xs text-indigo-300 border border-zinc-800">
                  <pre>{`// Node.js Verification Guard
import crypto from 'crypto';

export function verifyVaultWebhook(rawBody, signature, secret) {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(signature)
  );
}`}</pre>
                </div>
                <div className="p-4 bg-zinc-950/80 border border-indigo-900/30 rounded-lg text-xs text-zinc-400">
                  <span className="text-indigo-400 font-semibold">Security Requirement:</span> Always verify signatures using <code className="text-zinc-200">timingSafeEqual</code> to prevent side-channel timing attacks on hash byte comparisons.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Specs & Export */}
      {activeTab === "specs" && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-2">
              Enterprise Postman Collection & Machine Artifacts
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Download complete, ready-to-run API test collections with automated token capture scripts and assertions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400">
                    <FileJson className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-200 text-sm">Postman Collection v2.1</h3>
                    <p className="text-xs text-zinc-400">Includes 9 structured modules & automated test scripts</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  Located in repository at <code className="text-zinc-200">docs/api/securevault_postman_collection.json</code>.
                </p>
                <div className="pt-2">
                  <a
                    href="/docs/api/securevault_postman_collection.json"
                    download="securevault_postman_collection.json"
                  >
                    <Button variant="primary" className="w-full text-xs">
                      <Download className="w-4 h-4 mr-2" />
                      Download Postman Collection
                    </Button>
                  </a>
                </div>
              </div>

              <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-200 text-sm">OpenAPI 3.1 Live JSON</h3>
                    <p className="text-xs text-zinc-400">CI/CD Schema URL for SDK generators & linters</p>
                  </div>
                </div>
                <div className="bg-zinc-900 px-3 py-2 rounded text-xs font-mono text-zinc-300 border border-zinc-800 flex justify-between items-center">
                  <span>/api/v1/docs/export</span>
                  <button
                    onClick={() => handleCopy("http://localhost:8000/api/v1/docs/export", "url")}
                    className="text-zinc-400 hover:text-white"
                  >
                    {copiedKey === "url" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="pt-2">
                  <a
                    href="/api/v1/docs/export"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="secondary" className="w-full text-xs">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Live JSON in Browser
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
