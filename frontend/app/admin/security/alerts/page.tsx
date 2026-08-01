"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, RefreshCw, ChevronLeft, ChevronRight, ShieldAlert, AlertTriangle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { fetchSecurityAlerts, SecurityLog } from "@/lib/security-api"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"

export default function SecurityAlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<SecurityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 15

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const skip = (currentPage - 1) * limit
      const data = await fetchSecurityAlerts({ skip, limit })
      setAlerts(data.alerts)
      setTotal(data.total)
    } catch (error: any) {
      toast.error("Failed to load security alerts feed")
    } finally {
      setLoading(false)
    }
  }, [currentPage])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString.replace("Z", "+00:00")), "MMM d, yyyy HH:mm:ss")
    } catch (e) {
      return dateString
    }
  }

  const getAlertSeverity = (action: string) => {
    if (action.includes("LOCKOUT") || action.includes("LOCKED_BY_ADMIN")) {
      return { label: "CRITICAL", color: "bg-red-500/10 text-red-500 border-red-500/20" }
    }
    return { label: "WARNING", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/security")} className="border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Security Alerts</h2>
          <p className="text-sm text-muted-foreground">Real-time alerts for system lockouts, suspicious logs, and brute-force detections.</p>
        </div>
      </div>

      <Card className="border-border bg-card border-red-500/10 hover:border-red-500/20 transition-colors">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-red-500">
            <ShieldAlert className="w-5 h-5 animate-bounce" />
            Active Incident Alerts Feed
            {total > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                {total} Incidents
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Audit logging engine indicators for system lockdowns, rate limit blocks, and forced terminations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-rose-500" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No active security alerts registered. System is healthy.</div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => {
                const severity = getAlertSeverity(alert.action)
                return (
                  <div key={alert._id} className="p-4 rounded-xl border border-border/80 bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${severity.color}`}>
                            {severity.label}
                          </span>
                          <span className="font-semibold text-foreground text-sm">{alert.action}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Actor: <span className="font-medium text-foreground">{alert.actorEmail || "SYSTEM"}</span> ({alert.actorId || "N/A"})
                        </p>
                        <p className="text-xs text-rose-400 font-medium">
                          Reason: {alert.reason || "Automatic threshold limit exceeded"}
                        </p>
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/80 mt-2">
                          <span>IP: {alert.ipAddress}</span>
                          <span>Time: {formatDate(alert.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="border-border"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className="border-border"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
