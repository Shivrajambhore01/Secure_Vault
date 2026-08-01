"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, RefreshCw, ChevronLeft, ChevronRight, LogOut, ShieldAlert } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchActiveSessions, terminateSession, ActiveSession } from "@/lib/security-api"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"

export default function SessionManagementPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [terminatingId, setTerminatingId] = useState<string | null>(null)
  const limit = 15

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const skip = (currentPage - 1) * limit
      const data = await fetchActiveSessions({ search: searchQuery || undefined, skip, limit })
      setSessions(data.sessions)
      setTotal(data.total)
    } catch (error: any) {
      toast.error("Failed to load active user sessions")
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

  const handleTerminate = async (refreshTokenId: string, email: string) => {
    if (!confirm(`Are you sure you want to force logout user session for: ${email}?`)) return
    
    setTerminatingId(refreshTokenId)
    try {
      await terminateSession(refreshTokenId)
      toast.success(`Successfully terminated session for ${email}`)
      loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to terminate session")
    } finally {
      setTerminatingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString.replace("Z", "+00:00")), "MMM d, yyyy HH:mm")
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
          <h2 className="text-2xl font-bold text-foreground">Session Management</h2>
          <p className="text-sm text-muted-foreground">Monitor real-time client sessions and revoke connections instantly.</p>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
              Active Connections
              {total > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  {total} Active
                </span>
              )}
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search user ID, email, IP..."
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
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No active sessions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">User Email</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4">User Agent</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session._id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-foreground">{session.email}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{session.ipAddress}</td>
                      <td className="py-3.5 px-4 text-xs">{formatDate(session.createdAt)}</td>
                      <td className="py-3.5 px-4 text-xs font-mono text-emerald-400">{formatDate(session.lastActive)}</td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground max-w-xs truncate" title={session.userAgent}>
                        {session.userAgent}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={terminatingId === session.refreshTokenId}
                          onClick={() => handleTerminate(session.refreshTokenId, session.email)}
                          className="h-8 text-xs font-semibold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"
                        >
                          <LogOut className="h-3.5 w-3.5 mr-1" />
                          {terminatingId === session.refreshTokenId ? "Revoking..." : "Force Logout"}
                        </Button>
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
