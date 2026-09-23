"use client";

import * as React from "react";
import {
  Shield,
  Key,
  Smartphone,
  Laptop,
  Lock,
  RefreshCw,
  Trash2,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  LogOut,
} from "lucide-react";
import {
  Button,
  Input,
  Modal,
  DataTable,
  StatusBadge,
  MetricCard,
  EmptyState,
  ConfirmDialog,
  ColumnDef,
} from "@/components/design-system";

interface SecurityOverviewData {
  mfa_enabled: boolean;
  mfa_type: string;
  secondary_pin_set: boolean;
  trusted_devices_count: number;
  active_sessions_count: number;
  recovery_codes_count: number;
  last_login?: string;
}

interface SessionItem {
  session_id: string;
  browser: string;
  os: string;
  ip_address: string;
  created_at: string;
  last_seen: string;
  is_current: boolean;
}

interface DeviceItem {
  id: string;
  browser: string;
  os: string;
  ipAddress: string;
  isTrusted: boolean;
  lastSeen: string;
}

export default function SecurityCenterPage() {
  const [activeTab, setActiveTab] = React.useState<"sessions" | "mfa" | "credentials">("sessions");

  // Overview Stats
  const [overview, setOverview] = React.useState<SecurityOverviewData>({
    mfa_enabled: false,
    mfa_type: "NONE",
    secondary_pin_set: true,
    trusted_devices_count: 1,
    active_sessions_count: 1,
    recovery_codes_count: 10,
    last_login: "Today, 10:20 AM",
  });

  // Sessions & Devices state
  const [sessions, setSessions] = React.useState<SessionItem[]>([
    {
      session_id: "sess_curr_123",
      browser: "Chrome",
      os: "Windows 11",
      ip_address: "127.0.0.1",
      created_at: "Today, 09:30 AM",
      last_seen: "Just now",
      is_current: true,
    },
    {
      session_id: "sess_mobile_456",
      browser: "Chrome Mobile",
      os: "Android 14",
      ip_address: "103.21.12.84",
      created_at: "Yesterday, 18:40 PM",
      last_seen: "Yesterday, 21:15 PM",
      is_current: false,
    },
  ]);

  const [devices, setDevices] = React.useState<DeviceItem[]>([
    {
      id: "dev_win_1",
      browser: "Chrome",
      os: "Windows 11",
      ipAddress: "127.0.0.1",
      isTrusted: true,
      lastSeen: "Just now",
    },
    {
      id: "dev_and_2",
      browser: "Chrome Mobile",
      os: "Android 14",
      ipAddress: "103.21.12.84",
      isTrusted: true,
      lastSeen: "Yesterday",
    },
  ]);

  // Dialogs & Modals
  const [isTerminateOthersOpen, setIsTerminateOthersOpen] = React.useState(false);
  const [sessionToRevoke, setSessionToRevoke] = React.useState<string | null>(null);
  const [isTotpModalOpen, setIsTotpModalOpen] = React.useState(false);
  const [totpSecret, setTotpSecret] = React.useState("JBSWY3DPEHPK3PXP");
  const [totpCode, setTotpCode] = React.useState("");
  const [isTotpSuccess, setIsTotpSuccess] = React.useState(false);
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([]);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = React.useState(false);

  // Credentials State
  const [currentPwd, setCurrentPwd] = React.useState("");
  const [newPwd, setNewPwd] = React.useState("");
  const [currentPin, setCurrentPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [feedbackMsg, setFeedbackMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Terminate a single session
  const handleTerminateSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    setSessionToRevoke(null);
  };

  // Terminate all other sessions
  const handleTerminateOtherSessions = () => {
    setSessions((prev) => prev.filter((s) => s.is_current));
    setIsTerminateOthersOpen(false);
  };

  // Toggle device trust
  const handleToggleDeviceTrust = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, isTrusted: !d.isTrusted } : d))
    );
  };

  // Setup TOTP
  const handleVerifyTotp = () => {
    if (totpCode.trim().length === 6) {
      setIsTotpSuccess(true);
      setOverview((prev) => ({ ...prev, mfa_enabled: true, mfa_type: "TOTP" }));
      setTimeout(() => {
        setIsTotpModalOpen(false);
        setIsTotpSuccess(false);
        setTotpCode("");
      }, 1500);
    }
  };

  // Session table columns
  const sessionColumns: ColumnDef<SessionItem>[] = [
    {
      header: "Device & Browser",
      accessorKey: "browser",
      cell: (item) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700/60 text-purple-400">
            {item.os.toLowerCase().includes("android") || item.os.toLowerCase().includes("ios") ? (
              <Smartphone className="w-4 h-4" />
            ) : (
              <Laptop className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-zinc-100">{item.browser}</span>
              {item.is_current && (
                <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  THIS DEVICE
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-400">{item.os}</span>
          </div>
        </div>
      ),
    },
    {
      header: "IP Address",
      accessorKey: "ip_address",
      cell: (item) => <span className="font-mono text-xs text-zinc-400">{item.ip_address}</span>,
    },
    {
      header: "Last Active",
      accessorKey: "last_seen",
      cell: (item) => <span className="text-xs text-zinc-300">{item.last_seen}</span>,
    },
    {
      header: "Action",
      cell: (item) =>
        item.is_current ? (
          <span className="text-xs text-zinc-500 italic">Current Session</span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
            onClick={() => setSessionToRevoke(item.session_id)}
          >
            <LogOut className="w-3.5 h-3.5 mr-1" />
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 text-left">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
          <Shield className="w-6 h-6 text-purple-400" />
          Security Command Center
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Manage your multi-factor authentication, active sessions, trusted devices, and secondary PIN security.
        </p>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Two-Factor Auth"
          value={overview.mfa_enabled ? "Enabled" : "Disabled"}
          subtitle={overview.mfa_enabled ? "Protected via Authenticator App" : "Action recommended"}
          icon={<Shield className="w-5 h-5" />}
          trend={{
            value: overview.mfa_enabled ? "Active" : "Disabled",
            isPositive: overview.mfa_enabled,
          }}
        />
        <MetricCard
          title="Active Sessions"
          value={sessions.length}
          subtitle="Concurrent sign-in devices"
          icon={<Laptop className="w-5 h-5" />}
        />
        <MetricCard
          title="Trusted Devices"
          value={devices.filter((d) => d.isTrusted).length}
          subtitle="Recognized login fingerprints"
          icon={<Smartphone className="w-5 h-5" />}
        />
        <MetricCard
          title="Secondary PIN"
          value={overview.secondary_pin_set ? "Protected" : "Unset"}
          subtitle="Zero-knowledge asset gating"
          icon={<Key className="w-5 h-5" />}
          trend={{
            value: overview.secondary_pin_set ? "Active" : "Unset",
            isPositive: overview.secondary_pin_set,
          }}
        />
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab("sessions")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
            activeTab === "sessions"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Laptop className="w-4 h-4" />
          Sessions & Devices
        </button>
        <button
          onClick={() => setActiveTab("mfa")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
            activeTab === "mfa"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Shield className="w-4 h-4" />
          Two-Factor Authentication
        </button>
        <button
          onClick={() => setActiveTab("credentials")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
            activeTab === "credentials"
              ? "border-purple-500 text-purple-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Lock className="w-4 h-4" />
          Password & Secondary PIN
        </button>
      </div>

      {/* Tab 1: Sessions & Devices */}
      {activeTab === "sessions" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Active Login Sessions</h3>
              <p className="text-xs text-zinc-500">Devices currently signed into your SecureVault account.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTerminateOthersOpen(true)}
              className="text-red-400 border-red-500/30 hover:bg-red-950/20"
            >
              Log Out All Other Devices
            </Button>
          </div>

          <DataTable
            data={sessions}
            columns={sessionColumns}
            searchPlaceholder="Search sessions by browser or IP..."
          />

          {/* Trusted Devices Section */}
          <div className="pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">Known Devices</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {devices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-100">
                        {dev.browser} on {dev.os}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        IP: {dev.ipAddress} • Last active: {dev.lastSeen}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={dev.isTrusted ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => handleToggleDeviceTrust(dev.id)}
                  >
                    {dev.isTrusted ? "Trusted ✓" : "Trust Device"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Two-Factor Authentication */}
      {activeTab === "mfa" && (
        <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl">
          {/* Authenticator App Card */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-purple-400 mt-0.5">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-100">Authenticator App (TOTP)</h4>
                  <StatusBadge status={overview.mfa_enabled ? "Active" : "Inactive"} />
                </div>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Use Google Authenticator, Authy, or 1Password to generate time-based verification codes.
                </p>
              </div>
            </div>
            <Button
              variant={overview.mfa_enabled ? "danger" : "primary"}
              size="sm"
              onClick={() => {
                if (overview.mfa_enabled) {
                  setOverview((prev) => ({ ...prev, mfa_enabled: false }));
                } else {
                  setIsTotpModalOpen(true);
                }
              }}
            >
              {overview.mfa_enabled ? "Disable" : "Set Up"}
            </Button>
          </div>

          {/* Recovery Codes Card */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700/60 text-zinc-300 mt-0.5">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-zinc-100">Emergency Recovery Codes</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Generate 10 single-use backup codes to sign in if you lose access to your authenticator phone.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRecoveryCodes([
                  "7A4B-9C2D",
                  "8E1F-3A5B",
                  "2C4D-6E8F",
                  "1B3D-5E7F",
                  "9A0B-2C4D",
                  "4E6F-8A0B",
                  "3C5D-7E9F",
                  "2A4B-6C8E",
                  "1F3A-5B7C",
                  "8D0E-2F4A",
                ]);
                setIsRecoveryModalOpen(true);
              }}
            >
              View Codes
            </Button>
          </div>
        </div>
      )}

      {/* Tab 3: Password & Secondary PIN */}
      {activeTab === "credentials" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
          {/* Change Password Card */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-zinc-100">Change Account Password</h3>
            </div>
            <p className="text-xs text-zinc-400">Ensure your password is at least 8 characters long.</p>
            <div className="space-y-3">
              <Input
                label="Current Password"
                type="password"
                placeholder="Enter current password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
              />
              <Input
                label="New Password"
                type="password"
                placeholder="Enter new password (min 8 chars)"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  setFeedbackMsg({ type: "success", text: "Password updated successfully!" });
                  setCurrentPwd("");
                  setNewPwd("");
                }}
              >
                Update Password
              </Button>
            </div>
          </div>

          {/* Secondary PIN Card */}
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-zinc-100">Secondary Vault PIN</h3>
            </div>
            <p className="text-xs text-zinc-400">
              A 6-digit zero-knowledge PIN required to reveal critical credentials and passwords.
            </p>
            <div className="space-y-3">
              <Input
                label="Current 6-Digit PIN"
                type="password"
                maxLength={6}
                placeholder="••••••"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
              />
              <Input
                label="New 6-Digit PIN"
                type="password"
                maxLength={6}
                placeholder="••••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  setFeedbackMsg({ type: "success", text: "Secondary PIN updated successfully!" });
                  setCurrentPin("");
                  setNewPin("");
                }}
              >
                Save New PIN
              </Button>
            </div>
          </div>
        </div>
      )}

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Confirmation Modal for Terminating Other Sessions */}
      <ConfirmDialog
        isOpen={isTerminateOthersOpen}
        onClose={() => setIsTerminateOthersOpen(false)}
        onConfirm={handleTerminateOtherSessions}
        title="Log out all other devices?"
        description="This will instantly invalidate all active sessions except your current device. Anyone currently signed in elsewhere will be disconnected."
        confirmLabel="Log Out Others"
        variant="danger"
      />

      {/* Confirmation Modal for Single Session Revocation */}
      <ConfirmDialog
        isOpen={Boolean(sessionToRevoke)}
        onClose={() => setSessionToRevoke(null)}
        onConfirm={() => sessionToRevoke && handleTerminateSession(sessionToRevoke)}
        title="Revoke session?"
        description="This device will immediately be signed out and will need to log back in."
        confirmLabel="Revoke Session"
        variant="danger"
      />

      {/* TOTP Setup Modal */}
      <Modal
        isOpen={isTotpModalOpen}
        onClose={() => setIsTotpModalOpen(false)}
        title="Set Up Authenticator App"
        description="Scan the key with Google Authenticator, Authy, or your password manager."
      >
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-center space-y-2">
            <p className="text-xs text-zinc-400">Secret Key (Manual Entry):</p>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-sm font-bold tracking-widest text-purple-300">
                {totpSecret}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(totpSecret)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              label="6-Digit Verification Code"
              placeholder="000000"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
            />
            <Button
              size="sm"
              className="w-full mt-2"
              onClick={handleVerifyTotp}
              disabled={totpCode.trim().length !== 6}
            >
              {isTotpSuccess ? "Verified ✓" : "Verify & Enable MFA"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Recovery Codes Modal */}
      <Modal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        title="Emergency Recovery Codes"
        description="Save these codes in a safe place. Each code can only be used once."
      >
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2 p-4 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-center text-zinc-300">
            {recoveryCodes.map((code, idx) => (
              <div key={idx} className="p-1.5 rounded bg-zinc-900/60 border border-zinc-800">
                {code}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              leftIcon={<Copy className="w-4 h-4" />}
              onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))}
            >
              Copy Codes
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => {
                const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "securevault_recovery_codes.txt";
                a.click();
              }}
            >
              Download .txt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
