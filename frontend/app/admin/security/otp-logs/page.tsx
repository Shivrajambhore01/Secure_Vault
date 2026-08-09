"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, RefreshCw, ChevronLeft, ChevronRight, Key } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchOtpLogs, SecurityLog } from "@/lib/security-api"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"

export default function OtpLogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<SecurityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 15

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const skip = (currentPage - 1) * limit
      const data = await fetchOtpLogs({ search: searchQuery || undefined, skip, limit })
      setLogs(data.logs)
      setTotal(data.total)
    } catch (error: any) {
      toast.error("Failed to load OTP diagnostic logs")
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchQuery])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 300)
    return () => clearTimeout(timer)
  }, [loadData])

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString.replace("Z", "+00:00")), "MMM d, yyyy HH:mm:ss")
    } catch (e) {
      return dateString
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/security")} className="border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">OTP Diagnostic Logs</h2>
          <p className="text-sm text-muted-foreground">Track one-time password issues, deliveries, and code verifications.</p>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-violet-500" />
              OTP Transmission Logs
              {total > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20">
                  {total} Events
                </span>
              )}
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search email or IP address..."
                className="pl-9 bg-background border-border text-sm"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-rose-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No OTP activities recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">User Email</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Result</th>
                    <th className="py-3 px-4">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs">{formatDate(log.timestamp)}</td>
                      <td className="py-3.5 px-4 font-semibold text-foreground">{log.actorEmail || "SYSTEM"}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-500 border border-violet-500/20">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{log.ipAddress}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          log.result === "SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        }`}>
                          {log.result}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground font-mono truncate max-w-xs">
                        {log.metadata ? JSON.stringify(log.metadata) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
