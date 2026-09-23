"use client";

import * as React from "react";
import {
  Bell,
  BellRing,
  Mail,
  MessageSquare,
  PhoneCall,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Send,
  RefreshCw,
  Sliders,
  Settings,
  Flame,
  Search,
  Filter,
  ArrowUpRight,
  UserCheck,
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

interface NotificationLog {
  id: string;
  channel: "EMAIL" | "SMS" | "VOICE_CALL" | "IN_APP";
  priority: "LOW" | "STANDARD" | "HIGH" | "EMERGENCY";
  recipient: string;
  templateId: string;
  subject?: string;
  providerRef: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "RATE_LIMITED";
  createdAt: string;
}

interface ChannelPreference {
  id: string;
  title: string;
  description: string;
  email: boolean;
  sms: boolean;
  voice: boolean;
}

export default function NotificationsHubPage() {
  const [logs, setLogs] = React.useState<NotificationLog[]>([
    {
      id: "notif-01",
      channel: "EMAIL",
      priority: "HIGH",
      recipient: "alexander.vance@securevault.io",
      templateId: "HEARTBEAT_WARNING",
      subject: "⚠️ SecureVault Heartbeat Warning: Check-In Required",
      providerRef: "smtp_98a72b01c",
      status: "DELIVERED",
      createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    {
      id: "notif-02",
      channel: "SMS",
      priority: "EMERGENCY",
      recipient: "+1 (555) 987-6543",
      templateId: "TIMELOCK_ALERT",
      subject: "SecureVault: Emergency Recovery Timelock Active",
      providerRef: "tw_sms_fa7102e3b",
      status: "DELIVERED",
      createdAt: new Date(Date.now() - 34 * 60 * 1000).toISOString(),
    },
    {
      id: "notif-03",
      channel: "VOICE_CALL",
      priority: "EMERGENCY",
      recipient: "+1 (555) 987-6543",
      templateId: "HEARTBEAT_WARNING",
      subject: "TwiML Emergency Escalation Voice Call",
      providerRef: "tw_voice_39c1081a",
      status: "DELIVERED",
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: "notif-04",
      channel: "EMAIL",
      priority: "STANDARD",
      recipient: "dr.marcus.vance@clinic.org",
      templateId: "NOMINEE_INVITE",
      subject: "🔐 SecureVault: You have been designated as a Digital Heir",
      providerRef: "smtp_44f128c77",
      status: "DELIVERED",
      createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    },
    {
      id: "notif-05",
      channel: "SMS",
      priority: "HIGH",
      recipient: "+1 (555) 345-6789",
      templateId: "SECURITY_ANOMALY",
      subject: "SecureVault SOC: IMPOSSIBLE_TRAVEL detected",
      providerRef: "tw_sms_aa019488",
      status: "SENT",
      createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    },
  ]);

  const [preferences, setPreferences] = React.useState<ChannelPreference[]>([
    {
      id: "heartbeat",
      title: "Dead Man's Switch Heartbeat Warnings",
      description: "Progressive check-in alerts when you approach your inactivity timeout.",
      email: true,
      sms: true,
      voice: true,
    },
    {
      id: "escrow",
      title: "Emergency Escrow & Social Recovery Timelocks",
      description: "Instant high-priority broadcasts when guardians trigger a key recovery claim.",
      email: true,
      sms: true,
      voice: true,
    },
    {
      id: "claims",
      title: "Beneficiary Inquiries & Claim Filing Alerts",
      description: "Notifications regarding nominee identity verification and cooling phase updates.",
      email: true,
      sms: false,
      voice: false,
    },
    {
      id: "security",
      title: "SOC Anomaly & Security Incidents",
      description: "Alerts when impossible travel or bulk secret decryption events are flagged.",
      email: true,
      sms: true,
      voice: false,
    },
  ]);

  const [phoneNumber, setPhoneNumber] = React.useState("+1 (555) 987-6543");
  const [selectedChannel, setSelectedChannel] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Test Dispatch Modal State
  const [isTestModalOpen, setIsTestModalOpen] = React.useState(false);
  const [testChannel, setTestChannel] = React.useState<"EMAIL" | "SMS" | "VOICE_CALL">("SMS");
  const [testRecipient, setTestRecipient] = React.useState("+1 (555) 987-6543");
  const [testTemplate, setTestTemplate] = React.useState("HEARTBEAT_WARNING");
  const [dispatchSuccess, setDispatchSuccess] = React.useState(false);

  const togglePreference = (id: string, channel: "email" | "sms" | "voice") => {
    setPreferences((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [channel]: !item[channel] } : item
      )
    );
  };

  const handleTestDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: NotificationLog = {
      id: `notif-${Date.now()}`,
      channel: testChannel,
      priority: testTemplate === "TIMELOCK_ALERT" ? "EMERGENCY" : "HIGH",
      recipient: testRecipient,
      templateId: testTemplate,
      subject: `Test ${testTemplate} Dispatch`,
      providerRef: testChannel === "EMAIL" ? `smtp_${Date.now().toString(16)}` : `tw_${Date.now().toString(16)}`,
      status: "DELIVERED",
      createdAt: new Date().toISOString(),
    };
    setLogs([newEntry, ...logs]);
    setDispatchSuccess(true);
    setTimeout(() => {
      setDispatchSuccess(false);
      setIsTestModalOpen(false);
    }, 1500);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesChannel = selectedChannel === "ALL" || log.channel === selectedChannel;
    const matchesQuery =
      log.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.templateId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.subject && log.subject.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesChannel && matchesQuery;
  });

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <BellRing className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Communications &amp; Multi-Channel Dispatch Hub
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">
                Phase 12
              </span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Unified communication dispatcher connecting Twilio SMS, Programmable Voice (TwiML), and SMTP Email.
            Enforces progressive alert escalation and anti-spam rate limiting for all critical life events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setLogs([...logs])}
          >
            <RefreshCw className="h-4 w-4" />
            Sync Ledger
          </Button>
          <Button
            variant="primary"
            className="flex items-center gap-2 shadow-lg shadow-primary/20"
            onClick={() => setIsTestModalOpen(true)}
          >
            <Send className="h-4 w-4" />
            Test Channel Dispatch
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Delivery Success Rate"
          value="99.8%"
          subtitle="Across Twilio SMS, Voice & SMTP"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
        />
        <MetricCard
          title="Dispatched Volume (24h)"
          value={logs.length.toString()}
          subtitle="Zero failed deliveries or bounces"
          icon={<Radio className="h-5 w-5 text-primary" />}
        />
        <MetricCard
          title="Active Channels"
          value="3 / 3 Active"
          subtitle="Email, SMS & Voice Ready"
          icon={<Sliders className="h-5 w-5 text-indigo-400" />}
        />
        <MetricCard
          title="Rate Limit Quota"
          value="5 / min"
          subtitle="Token bucket anti-spam window"
          icon={<Clock className="h-5 w-5 text-amber-400" />}
        />
      </div>

      {/* Communication Preferences Matrix */}
      <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Alert Channel Routing Matrix</h3>
            <p className="text-xs text-muted-foreground">
              Define which communication channels activate for each security and lifecycle event.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Emergency Contact:</span>
            <span className="text-xs font-mono text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
              {phoneNumber}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {preferences.map((pref) => (
            <div
              key={pref.id}
              className="p-4 rounded-xl border border-border/30 bg-muted/10 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
            >
              <div className="space-y-1 max-w-lg">
                <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                  {pref.title}
                </span>
                <p className="text-xs text-muted-foreground">{pref.description}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Email Toggle */}
                <button
                  type="button"
                  onClick={() => togglePreference(pref.id, "email")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    pref.email
                      ? "bg-primary/20 text-primary border-primary/40 shadow-sm"
                      : "bg-muted/40 text-muted-foreground border-border/40 opacity-50"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </button>

                {/* SMS Toggle */}
                <button
                  type="button"
                  onClick={() => togglePreference(pref.id, "sms")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    pref.sms
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm"
                      : "bg-muted/40 text-muted-foreground border-border/40 opacity-50"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  SMS
                </button>

                {/* Voice Call Toggle */}
                <button
                  type="button"
                  onClick={() => togglePreference(pref.id, "voice")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    pref.voice
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm"
                      : "bg-muted/40 text-muted-foreground border-border/40 opacity-50"
                  }`}
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  Voice (TwiML)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outbound Notification Ledger Stream */}
      <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Outbound Dispatch Ledger</h3>
            <p className="text-xs text-muted-foreground">
              Cryptographically audited log of all sent emails, SMS texts, and automated emergency voice calls.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter by recipient or template..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/20 border border-border/40 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-lg border border-border/40">
              {["ALL", "EMAIL", "SMS", "VOICE_CALL"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                    selectedChannel === ch
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ch === "ALL" ? "All" : ch === "VOICE_CALL" ? "Voice" : ch}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-6">Channel</th>
                <th className="py-3 px-6">Priority</th>
                <th className="py-3 px-6">Recipient</th>
                <th className="py-3 px-6">Template &amp; Subject</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Provider Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 font-medium text-xs">
                      {log.channel === "EMAIL" && <Mail className="h-4 w-4 text-primary" />}
                      {log.channel === "SMS" && <MessageSquare className="h-4 w-4 text-emerald-400" />}
                      {log.channel === "VOICE_CALL" && <PhoneCall className="h-4 w-4 text-amber-400" />}
                      {log.channel}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        log.priority === "EMERGENCY"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : log.priority === "HIGH"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {log.priority}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-xs text-foreground">{log.recipient}</td>
                  <td className="py-4 px-6">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-foreground block">{log.templateId}</span>
                      <span className="text-xs text-muted-foreground block truncate max-w-xs">{log.subject}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {log.status === "DELIVERED" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Delivered
                      </span>
                    )}
                    {log.status === "SENT" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Radio className="h-3 w-3 animate-pulse" />
                        Sent
                      </span>
                    )}
                    {log.status === "RATE_LIMITED" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Clock className="h-3 w-3" />
                        Rate Limited
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-xs text-muted-foreground">
                    {log.providerRef}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Dispatch Modal */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        title="Simulate Channel Notification Dispatch"
      >
        <form onSubmit={handleTestDispatch} className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Trigger a test transactional notification across Twilio SMS, Programmable Voice, or SMTP Email.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">Communication Channel</label>
            <div className="grid grid-cols-3 gap-2">
              {(["SMS", "VOICE_CALL", "EMAIL"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    setTestChannel(ch);
                    if (ch === "EMAIL") setTestRecipient("alexander.vance@securevault.io");
                    else setTestRecipient("+1 (555) 987-6543");
                  }}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                    testChannel === ch
                      ? "bg-primary/20 text-primary border-primary/40 shadow-sm"
                      : "bg-muted/20 text-muted-foreground border-border/40 hover:bg-muted/30"
                  }`}
                >
                  {ch === "EMAIL" && <Mail className="h-4 w-4" />}
                  {ch === "SMS" && <MessageSquare className="h-4 w-4" />}
                  {ch === "VOICE_CALL" && <PhoneCall className="h-4 w-4" />}
                  <span>{ch === "VOICE_CALL" ? "Voice" : ch}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">Notification Template</label>
            <select
              value={testTemplate}
              onChange={(e) => setTestTemplate(e.target.value)}
              className="w-full bg-background border border-border/40 rounded-lg p-2.5 text-xs text-foreground"
            >
              <option value="HEARTBEAT_WARNING">Dead Man&apos;s Switch Heartbeat Warning</option>
              <option value="TIMELOCK_ALERT">Emergency Escrow Timelock Alert</option>
              <option value="NOMINEE_INVITE">Nominee Designation Invitation</option>
              <option value="SECURITY_ANOMALY">SOC Threat Anomaly Warning</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">Destination Recipient</label>
            <Input
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder={testChannel === "EMAIL" ? "user@example.com" : "+1 (555) 000-0000"}
            />
          </div>

          {dispatchSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Dispatched successfully! Recorded in delivery ledger.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button variant="outline" type="button" onClick={() => setIsTestModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Dispatch Test Alert
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
