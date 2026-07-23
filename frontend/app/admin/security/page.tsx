"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Shield,
  History,
  AlertTriangle,
  Key,
  Users,
  Eye,
  UserX,
  UserCheck,
  ShieldAlert,
  Terminal,
  Activity,
  ArrowRight,
  RefreshCw,
  LogOut,
  UserCheck2
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SecurityStatCard } from "@/components/admin/security-stat-card"
import { fetchSecurityStats, fetchRecentActivity, SecurityLog } from "@/lib/security-api"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"

export default function SecurityDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [recentLogs, setRecentLogs] = useState<SecurityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [statsData, logsData] = await Promise.all([
        fetchSecurityStats(),
        fetchRecentActivity()
      ])
      setStats(statsData)
      setRecentLogs(logsData)
    } catch (error: any) {
      console.error(error)
      toast.error("Failed to load security dashboard data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString.replace("Z", "+00:00")), "MMM d, yyyy HH:mm:ss")
    } catch (e) {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-500 border-t-transparent" />
          <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading security vault metrics...</p>
        </div>
      </div>
    )
  }

  const quickLinks = [
    { title: "Login History", href: "/admin/security/login-history", desc: "View all user and admin logins", icon: History },
    { title: "Failed Logins", href: "/admin/security/failed-logins", desc: "Monitor brute-force attempts", icon: AlertTriangle },
    { title: "OTP Diagnostic Logs", href: "/admin/security/otp-logs", desc: "Verify OTP delivery & validation", icon: Key },
    { title: "User Activity Logs", href: "/admin/security/user-activity", desc: "Audit platform actions by users", icon: Users },
    { title: "Admin Activity Logs", href: "/admin/security/admin-activity", desc: "Track administrative commands", icon: Terminal },
    { title: "Asset Access Logs", href: "/admin/security/asset-logs", desc: "Metadata-only logs of vault files", icon: Eye },
    { title: "Active Sessions", href: "/admin/security/sessions", desc: "Force logout active connections", icon: LogOut },
    { title: "Lock/Unlock Accounts", href: "/admin/security/accounts", desc: "Lock or restore user accounts", icon: UserX },
    { title: "Security Alerts", href: "/admin/security/alerts", desc: "Suspicious lockout and login alerts", icon: ShieldAlert }
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="w-8 h-8 text-rose-500" />
            Security & Audit Admin
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Enterprise system logs, active session termination, security alerts, and client lock control.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadDashboardData(true)}
          disabled={refreshing}
          className="self-start sm:self-auto gap-2 border-border"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh Dashboard"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SecurityStatCard
          title="Successful Logins (Today)"
          value={stats?.loginsToday ?? 0}
          icon={UserCheck}
          color="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
        />
        <SecurityStatCard
          title="Failed Login Attempts (Today)"
          value={stats?.failedLoginsToday ?? 0}
          icon={AlertTriangle}
          color="text-amber-500 bg-amber-500/10 border-amber-500/20"
        />
        <SecurityStatCard
          title="Active Sessions"
          value={stats?.activeSessions ?? 0}
          icon={RefreshCw}
          color="text-sky-500 bg-sky-500/10 border-sky-500/20"
        />
        <SecurityStatCard
          title="Locked User Accounts"
          value={stats?.lockedAccounts ?? 0}
          icon={UserX}
          color="text-rose-500 bg-rose-500/10 border-rose-500/20"
        />
        <SecurityStatCard
          title="OTP Requests (Today)"
          value={stats?.otpRequestsToday ?? 0}
          icon={Key}
          color="text-violet-500 bg-violet-500/10 border-violet-500/20"
        />
        <SecurityStatCard
          title="Critical Security Alerts"
          value={stats?.alertsCount ?? 0}
          icon={ShieldAlert}
          color="text-red-500 bg-red-500/10 border-red-500/20"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Audits List */}
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-500" />
              Security Quick Actions
            </CardTitle>
            <CardDescription>
              Direct links to audit logs, session revokes, and account lock controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {quickLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link key={link.href} href={link.href}>
                  <div className="p-4 rounded-xl border border-border bg-background hover:bg-rose-500/5 hover:border-rose-500/30 transition-all duration-200 cursor-pointer h-full flex flex-col justify-between group">
                    <div className="space-y-1.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 group-hover:scale-105 transition-all">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">{link.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{link.desc}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-500 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      Open Audit
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>

        {/* Recent Activity Log */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-rose-500" />
              System Audit Stream
            </CardTitle>
            <CardDescription>
              Real-time audit log stream.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent security logs found.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log._id} className="flex gap-3 text-xs border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
                  <div className="mt-0.5">
                    <span className={`inline-flex h-2 w-2 rounded-full ${
                      log.result === "SUCCESS" ? "bg-emerald-500" : "bg-rose-500"
                    }`} />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{log.action}</p>
                    <p className="text-muted-foreground truncate">{log.actorEmail || "SYSTEM"}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 mt-1">
                      <span>{log.ipAddress}</span>
                      <span>{formatDate(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
