"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, RefreshCw, ChevronLeft, ChevronRight, UserX, UserCheck, ShieldAlert, Lock, Unlock } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { lockUser, unlockUser } from "@/lib/security-api"
import { secureAdminFetch } from "@/lib/admin-api"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"

export default function AccountsManagementPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  
  // Lock dialog state
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [lockReason, setLockReason] = useState("")
  const [submittingLock, setSubmittingLock] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  const limit = 10

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const skip = (currentPage - 1) * limit
      const query = new URLSearchParams()
      if (searchQuery) query.append("search", searchQuery)
      query.append("skip", skip.toString())
      query.append("limit", limit.toString())

      const res = await secureAdminFetch(`/users?${query.toString()}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setUsers(data.users)
      setTotal(data.total)
    } catch (error: any) {
      toast.error("Failed to load user accounts registry")
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

  const handleUnlock = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to unlock user account: ${email}?`)) return
    
    setActionInProgress(userId)
    try {
      await unlockUser(userId)
      toast.success(`Successfully unlocked account for ${email}`)
      loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to unlock account")
    } finally {
      setActionInProgress(null)
    }
  }

  const handleLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !lockReason.trim()) return

    setSubmittingLock(true)
    try {
      await lockUser(selectedUser._id, lockReason)
      toast.success(`Account for ${selectedUser.email} has been locked.`)
      setSelectedUser(null)
      setLockReason("")
      loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to lock account")
    } finally {
      setSubmittingLock(false)
    }
  }

  const isLocked = (user: any) => {
    if (user.accountLocked) return true
    if (user.lockedUntil) {
      const lockedDate = parseISO(user.lockedUntil)
      return lockedDate > new Date()
    }
    return false
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-"
    try {
      return format(parseISO(dateString.replace("Z", "+00:00")), "MMM d, yyyy HH:mm")
    } catch (e) {
      return dateString
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6 relative animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/security")} className="border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Account Lock / Unlock</h2>
          <p className="text-sm text-muted-foreground">Emergency lock user files, revoke sessions, and reset lock status.</p>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              User Directory Lock Management
              {total > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  {total} Accounts
                </span>
              )}
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search fullName or email..."
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
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No accounts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">User Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 font-mono">ID</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const locked = isLocked(u)
                    return (
                      <tr key={u._id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">{u.fullName}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">{u.email}</td>
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground/80">{u._id}</td>
                        <td className="py-3.5 px-4 text-xs">{formatDate(u.lastActive)}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                            locked
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          }`}>
                            {locked ? "Locked" : "Active"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {locked ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionInProgress === u._id}
                              onClick={() => handleUnlock(u._id, u.email)}
                              className="h-8 text-xs font-semibold text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl"
                            >
                              <Unlock className="h-3.5 w-3.5 mr-1" />
                              {actionInProgress === u._id ? "Unlocking..." : "Unlock"}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionInProgress === u._id}
                              onClick={() => setSelectedUser(u)}
                              className="h-8 text-xs font-semibold text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"
                            >
                              <Lock className="h-3.5 w-3.5 mr-1" />
                              Lock Account
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
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

      {/* Lock Dialog Backdrop */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-rose-500">
                <UserX className="w-5 h-5" />
                Lock User Account
              </CardTitle>
              <CardDescription>
                Emergency lock for {selectedUser.fullName} ({selectedUser.email}). This will terminate all active sessions instantly.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleLockSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="reason" className="text-xs font-semibold text-muted-foreground">Reason for Lockout</label>
                  <Input
                    id="reason"
                    required
                    placeholder="e.g. Suspicious logins or user requested lockout"
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    className="bg-background border-border text-sm"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedUser(null)
                      setLockReason("")
                    }}
                    className="border-border"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingLock}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl"
                  >
                    {submittingLock ? "Locking..." : "Confirm Lockout"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
