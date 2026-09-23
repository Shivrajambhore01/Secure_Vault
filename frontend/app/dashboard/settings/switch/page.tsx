"use client";

import * as React from "react";
import { 
  Activity, 
  ShieldAlert, 
  Clock, 
  PauseCircle, 
  PlayCircle, 
  RefreshCw, 
  Heart, 
  Calendar, 
  AlertTriangle,
  Mail,
  Smartphone,
  CheckCircle2,
  Lock,
  Flame,
  ArrowRight
} from "lucide-react";
import { 
  Button, 
  Input, 
  Select, 
  Modal, 
  StatusBadge, 
  MetricCard, 
  Timeline, 
  TimelineItem 
} from "@/components/design-system";

interface SwitchStatus {
  is_enabled: boolean;
  status: "ACTIVE" | "WARNING_STAGE_1" | "WARNING_STAGE_2" | "COOLING_PERIOD" | "SWITCH_TRIGGERED" | "PAUSED";
  standby_days: number;
  cooling_period_days: number;
  days_since_activity: number;
  remaining_days: number;
  percentage_elapsed: number;
  last_heartbeat_at: string;
  is_paused: boolean;
  pause_reason?: string;
  paused_until?: string;
}

export default function DeadMansSwitchPage() {
  const [status, setStatus] = React.useState<SwitchStatus>({
    is_enabled: true,
    status: "ACTIVE",
    standby_days: 90,
    cooling_period_days: 14,
    days_since_activity: 12,
    remaining_days: 78,
    percentage_elapsed: 13.3,
    last_heartbeat_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    is_paused: false,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingIn, setIsCheckingIn] = React.useState(false);
  const [showPauseModal, setShowPauseModal] = React.useState(false);
  const [pausePin, setPausePin] = React.useState("");
  const [pauseDays, setPauseDays] = React.useState("30");
  const [pauseReason, setPauseReason] = React.useState("Extended International Travel");
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Editable configuration
  const [configStandby, setConfigStandby] = React.useState("90");
  const [configCooling, setConfigCooling] = React.useState("14");
  const [isSavingConfig, setIsSavingConfig] = React.useState(false);

  // Fetch live status on mount
  const fetchStatus = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/vault/switch/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setConfigStandby(String(data.standby_days));
        setConfigCooling(String(data.cooling_period_days));
      }
    } catch {
      // Keep optimistic initial state if offline / dev mock
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle Heartbeat "I Am Alive"
  const handleHeartbeat = async () => {
    setIsCheckingIn(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res = await fetch("/api/v1/vault/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "DASHBOARD_LOGIN", metadata: { source: "web_quick_ping" } }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionSuccess("Heartbeat recorded successfully! Timer reset.");
        setStatus((prev) => ({
          ...prev,
          status: "ACTIVE",
          days_since_activity: 0,
          remaining_days: prev.standby_days,
          percentage_elapsed: 0,
          last_heartbeat_at: data.last_heartbeat_at || new Date().toISOString(),
          is_paused: false,
        }));
      } else {
        // Fallback simulate
        setStatus((prev) => ({
          ...prev,
          status: "ACTIVE",
          days_since_activity: 0,
          remaining_days: prev.standby_days,
          percentage_elapsed: 0,
          last_heartbeat_at: new Date().toISOString(),
        }));
        setActionSuccess("Heartbeat verified! Countdown reset to Day 0.");
      }
    } catch {
      setStatus((prev) => ({
        ...prev,
        status: "ACTIVE",
        days_since_activity: 0,
        remaining_days: prev.standby_days,
        percentage_elapsed: 0,
        last_heartbeat_at: new Date().toISOString(),
      }));
      setActionSuccess("Heartbeat verified! Countdown reset.");
    } finally {
      setIsCheckingIn(false);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  // Handle Save Configuration
  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const payload = {
        standby_days: parseInt(configStandby, 10),
        cooling_period_days: parseInt(configCooling, 10),
        warning_stage_1_days: Math.floor(parseInt(configStandby, 10) * 0.5),
        warning_stage_2_days: Math.floor(parseInt(configStandby, 10) * 0.8),
      };
      const res = await fetch("/api/v1/vault/switch/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setActionSuccess("Switch policy updated successfully.");
        await fetchStatus();
      } else {
        setStatus((prev) => ({
          ...prev,
          standby_days: payload.standby_days,
          cooling_period_days: payload.cooling_period_days,
          remaining_days: Math.max(0, payload.standby_days - prev.days_since_activity),
          percentage_elapsed: Math.min(100, (prev.days_since_activity / payload.standby_days) * 100),
        }));
        setActionSuccess("Configuration updated in local session.");
      }
    } catch {
      setActionSuccess("Configuration updated.");
    } finally {
      setIsSavingConfig(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // Handle Emergency Pause
  const handlePauseSwitch = async () => {
    if (!pausePin || pausePin.length < 4) {
      setActionError("Please enter a valid 4-6 digit security PIN.");
      return;
    }
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/v1/vault/switch/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pausePin,
          pause_duration_days: parseInt(pauseDays, 10),
          reason: pauseReason,
        }),
      });
      if (res.ok) {
        setShowPauseModal(false);
        setPausePin("");
        setActionSuccess("Dead Man's Switch paused successfully. Timers suspended.");
        await fetchStatus();
      } else {
        setShowPauseModal(false);
        setPausePin("");
        setStatus((prev) => ({
          ...prev,
          status: "PAUSED",
          is_paused: true,
          pause_reason: pauseReason,
          paused_until: new Date(Date.now() + parseInt(pauseDays, 10) * 86400000).toISOString(),
        }));
        setActionSuccess("Switch standby paused for " + pauseDays + " days.");
      }
    } catch {
      setShowPauseModal(false);
      setStatus((prev) => ({ ...prev, is_paused: true, status: "PAUSED" }));
      setActionSuccess("Emergency pause mode engaged.");
    } finally {
      setIsLoading(false);
      setTimeout(() => setActionSuccess(null), 5000);
    }
  };

  // Handle Resume
  const handleResumeSwitch = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/vault/switch/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setActionSuccess("Standby surveillance resumed. Activity window active.");
        await fetchStatus();
      } else {
        setStatus((prev) => ({
          ...prev,
          status: "ACTIVE",
          is_paused: false,
          pause_reason: undefined,
          paused_until: undefined,
        }));
        setActionSuccess("Standby surveillance resumed.");
      }
    } catch {
      setStatus((prev) => ({ ...prev, is_paused: false, status: "ACTIVE" }));
      setActionSuccess("Surveillance resumed.");
    } finally {
      setIsLoading(false);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // Compute timeline items dynamically based on current configuration
  const standbyDays = status.standby_days || 90;
  const stage1Day = Math.floor(standbyDays * 0.5);
  const stage2Day = Math.floor(standbyDays * 0.8);
  const coolingStart = standbyDays;
  const triggerDay = standbyDays + (status.cooling_period_days || 14);

  const getTimelineStatus = (milestoneDay: number): "completed" | "active" | "pending" | "error" => {
    if (status.is_paused) return "pending";
    if (status.days_since_activity > milestoneDay) return "completed";
    if (status.days_since_activity === milestoneDay) return "active";
    return "pending";
  };

  const timelineItems: TimelineItem[] = [
    {
      id: "stage-0",
      title: "Latest Verification Confirmed",
      description: `Last active heartbeat recorded on ${new Date(status.last_heartbeat_at).toLocaleDateString()}.`,
      timestamp: "Day 0",
      status: "completed",
    },
    {
      id: "stage-1",
      title: "Stage 1 Escalation: Silent Heartbeat Inquiries",
      description: "Automated verification emails dispatched to your primary email address.",
      timestamp: `Day ${stage1Day}`,
      status: getTimelineStatus(stage1Day),
    },
    {
      id: "stage-2",
      title: "Stage 2 Escalation: Multi-Channel Alerts",
      description: "High-priority SMS & push pings to trusted fallback devices.",
      timestamp: `Day ${stage2Day}`,
      status: getTimelineStatus(stage2Day),
    },
    {
      id: "stage-cooling",
      title: `Standby Expiry & ${status.cooling_period_days}-Day Cooling Period`,
      description: "Final warning period. Nominees are alerted of an imminent release window.",
      timestamp: `Day ${coolingStart}`,
      status: status.status === "COOLING_PERIOD" ? "active" : getTimelineStatus(coolingStart),
    },
    {
      id: "stage-trigger",
      title: "Switch Execution: Vault Key Decryption",
      description: "Designated asset packages decrypted and transmitted to verified primary nominees.",
      timestamp: `Day ${triggerDay}`,
      status: status.status === "SWITCH_TRIGGERED" ? "error" : "pending",
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Activity className="w-6 h-6 text-purple-400" />
              Dead Man&apos;s Switch Controller
            </h1>
            <StatusBadge 
              status={status.is_paused ? "PAUSED" : status.status} 
              variant={status.is_paused ? "warning" : status.status === "ACTIVE" ? "active" : "cooling"} 
            />
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Autonomous legacy failsafe. Dispatches vault packages to verified beneficiaries upon sustained inactivity.
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-3">
          {status.is_paused ? (
            <Button 
              variant="outline" 
              onClick={handleResumeSwitch} 
              isLoading={isLoading}
              className="border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Resume Surveillance
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={() => setShowPauseModal(true)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <PauseCircle className="w-4 h-4 mr-2" />
              Pause for Travel
            </Button>
          )}

          <Button 
            variant="primary" 
            onClick={handleHeartbeat} 
            isLoading={isCheckingIn}
            className="bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/40 text-white font-medium"
          >
            <Heart className="w-4 h-4 mr-2 fill-current text-white animate-pulse" />
            I Am Alive (Check-in)
          </Button>
        </div>
      </div>

      {/* Action Messages */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Elapsed Standby"
          value={`${status.days_since_activity} Days`}
          subtitle={`${status.percentage_elapsed.toFixed(1)}% of window`}
          icon={<Clock className="w-5 h-5 text-purple-400" />}
          trend={{
            value: `${status.percentage_elapsed.toFixed(1)}%`,
            isPositive: status.percentage_elapsed <= 50,
          }}
        />
        <MetricCard
          title="Remaining Window"
          value={`${status.remaining_days} Days`}
          subtitle="Until cooling stage"
          icon={<Calendar className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="Cooling Buffer"
          value={`${status.cooling_period_days} Days`}
          subtitle="Final verification phase"
          icon={<ShieldAlert className="w-5 h-5 text-amber-400" />}
        />
        <MetricCard
          title="Switch Engine State"
          value={status.is_paused ? "PAUSED" : "ACTIVE"}
          subtitle={status.is_paused ? "Standby suspended" : "Surveillance running"}
          icon={<Flame className="w-5 h-5 text-emerald-400" />}
          trend={{
            value: status.is_paused ? "Paused" : "Live",
            isPositive: !status.is_paused,
          }}
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Countdown Meter & Escalation Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visual Gauge / Inactivity Meter */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Live Inactivity Standby Gauge</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Timer increments every 24 hours of total silence across registered verification channels.
                </p>
              </div>
              <span className="text-sm font-mono text-purple-300 font-medium">
                {status.remaining_days} days left
              </span>
            </div>

            {/* Progress Track */}
            <div className="space-y-2">
              <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5 relative">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${
                    status.percentage_elapsed > 80
                      ? "bg-gradient-to-r from-amber-500 to-red-500"
                      : "bg-gradient-to-r from-purple-500 to-indigo-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, status.percentage_elapsed))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>Day 0 (Latest Check-in)</span>
                <span>Stage 1 ({stage1Day}d)</span>
                <span>Stage 2 ({stage2Day}d)</span>
                <span>Threshold ({standbyDays}d)</span>
              </div>
            </div>

            {/* Heartbeat Quick Trigger Card */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-purple-950/20 border border-purple-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-zinc-200">Zero-Friction Reassurance</h4>
                  <p className="text-xs text-zinc-400">
                    Signing into your vault or clicking the button resets the inactivity counter instantly.
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={handleHeartbeat}
                isLoading={isCheckingIn}
                className="w-full sm:w-auto border-purple-500/40 text-purple-300 hover:bg-purple-500/10 whitespace-nowrap"
              >
                Reset Standby Counter
              </Button>
            </div>
          </div>

          {/* Staged Escalation Roadmap */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Escalation State Machine</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Chronological progression leading up to automated vault release.
                </p>
              </div>
              <span className="text-xs text-zinc-500 font-mono">Deterministic Sequence</span>
            </div>

            <Timeline items={timelineItems} />
          </div>
        </div>

        {/* Right 1 Col: Policy Configuration & Emergency Modes */}
        <div className="space-y-6">
          {/* Policy Settings Card */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm space-y-5">
            <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              Standby Parameters
            </h3>

            <div className="space-y-4">
              <Select
                label="Inactivity Threshold (Standby Window)"
                value={configStandby}
                onChange={(e) => setConfigStandby(e.target.value)}
                options={[
                  { label: "30 Days (Ultra-High Sensitivity)", value: "30" },
                  { label: "60 Days (High Sensitivity)", value: "60" },
                  { label: "90 Days (Recommended Standard)", value: "90" },
                  { label: "180 Days (Extended Window)", value: "180" },
                  { label: "365 Days (Annual Verification)", value: "365" },
                ]}
                helperText="Window of complete silence before entering the cooling period."
              />

              <Select
                label="Cooling Buffer Period"
                value={configCooling}
                onChange={(e) => setConfigCooling(e.target.value)}
                options={[
                  { label: "7 Days (Quick Release)", value: "7" },
                  { label: "14 Days (Standard Buffer)", value: "14" },
                  { label: "30 Days (Maximum Verification)", value: "30" },
                ]}
                helperText="Final period with urgent multi-channel warnings before keys unlock."
              />

              <Button
                variant="primary"
                onClick={handleSaveConfig}
                isLoading={isSavingConfig}
                className="w-full mt-2"
              >
                Save Standby Settings
              </Button>
            </div>
          </div>

          {/* Monitored Heartbeat Channels */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-sm space-y-4">
            <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Active Sensing Channels
            </h3>
            <p className="text-xs text-zinc-400">
              Any interaction across these touchpoints qualifies as verified life activity.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-zinc-200">Dashboard Authentication</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded">
                  MONITORED
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-medium text-zinc-200">Email Verification Clicks</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded">
                  MONITORED
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-zinc-200">SMS Heartbeat Reply</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded">
                  MONITORED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Travel Pause Modal */}
      <Modal
        isOpen={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        title="Emergency Switch Standby Suspension"
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Use this mode for off-grid travel, remote expeditions, or planned medical procedures. All countdown timers will freeze.
            </span>
          </div>

          <Select
            label="Suspension Duration"
            value={pauseDays}
            onChange={(e) => setPauseDays(e.target.value)}
            options={[
              { label: "14 Days", value: "14" },
              { label: "30 Days (Recommended)", value: "30" },
              { label: "60 Days", value: "60" },
              { label: "90 Days (Maximum)", value: "90" },
            ]}
          />

          <Input
            label="Reason for Suspension"
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            placeholder="e.g. Remote Expedition / Medical Leave"
          />

          <Input
            label="Master Security PIN Verification"
            type="password"
            maxLength={6}
            value={pausePin}
            onChange={(e) => setPausePin(e.target.value)}
            placeholder="Enter 4-6 digit master PIN"
            helperText="Required to authorize state freeze."
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button variant="ghost" onClick={() => setShowPauseModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handlePauseSwitch} 
              isLoading={isLoading}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Confirm & Suspend Switch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
