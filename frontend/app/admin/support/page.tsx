"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Users,
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  UserCheck2,
  Clock,
  Key,
  ShieldAlert,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LifeBuoy
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchSupportStats, searchSupportUsers, SupportUserMetadata, SupportStats } from "@/lib/support-api"
import { SecurityStatCard } from "@/components/admin/security-stat-card"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"

export default function SupportDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<SupportStats | null>(null)
  const [users, setUsers] = useState<SupportUserMetadata[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const limit = 10

  const loadStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoadingStats(true)
    try {
      const data = await fetchSupportStats()
      setStats(data)
    } catch (error: any) {
      toast.error("Failed to load support statistics")
    } finally {
      setLoadingStats(false)
      setRefreshing(false)
    }
  }

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const skip = (currentPage - 1) * limit
      const data = await searchSupportUsers({ search: searchQuery || undefined, skip, limit })
      setUsers(data.users)
      setTotalUsers(data.total)
    } catch (error: any) {
      toast.error("Failed to fetch user list")
    } finally {
      setLoadingUsers(false)
    }
  }, [currentPage, searchQuery])

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers()
    }, 300)
    return () => clearTimeout(timer)
  }, [loadUsers])

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-"
    try {
      return format(parseISO(dateString.replace("Z", "+00:00")), "MMM d, yyyy HH:mm")
    } catch (e) {
      return dateString
    }
  }

  const isUserLocked = (user: SupportUserMetadata) => {
    if (user.accountLocked) return true
    if (user.lockedUntil) {
      const lockedDate = parseISO(user.lockedUntil)
      return lockedDate > new Date()
    }
    return false
  }

  const totalPages = Math.ceil(totalUsers / limit)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="w-8 h-8 text-emerald-500" />
            Customer Support Console
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Search client records, manage account lockdowns, handle password/PIN recovery, and verify identities.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadStats(true)
            loadUsers()
          }}
          disabled={refreshing}
          className="self-start sm:self-auto gap-2 border-border"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh Console"}
        </Button>
      </div>

      {/* Stats row */}
      {loadingStats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SecurityStatCard
            title="Total Accounts"
            value={stats?.totalUsers ?? 0}
            icon={Users}
            color="text-blue-500 bg-blue-500/10 border-blue-500/20"
          />
          <SecurityStatCard
            title="Active / Verified"
            value={stats?.verifiedUsers ?? 0}
            icon={UserCheck}
            color="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
          />
          <SecurityStatCard
            title="Locked Accounts"
            value={stats?.lockedAccounts ?? 0}
            icon={UserX}
            color="text-rose-500 bg-rose-500/10 border-rose-500/20"
          />
          <SecurityStatCard
            title="Inactive (> 30 days)"
            value={stats?.inactiveUsers ?? 0}
            icon={Clock}
            color="text-amber-500 bg-amber-500/10 border-amber-500/20"
          />
        </div>
      )}

      {/* User Search Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                User Directory & Account Actions
                {totalUsers > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {totalUsers} Matches
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Search user records to view details, reset credentials, disable 2FA, or change locking state.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search name, email, or user ID..."
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
          {loadingUsers ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No matching client accounts found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Client Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 font-mono text-xs">User ID</th>
                    <th className="py-3 px-4">Email Verified</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const locked = isUserLocked(user)
                    return (
                      <tr key={user._id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">{user.fullName}</td>
                        <td className="py-3.5 px-4 text-muted-foreground">{user.email}</td>
                        <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground/80">{user._id}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${
                            user.isVerified
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {user.isVerified ? "Verified" : "Pending"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${
                            locked
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          }`}>
                            {locked ? "Locked" : "Active"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted-foreground">{formatDate(user.createdAt)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <Link href={`/admin/support/users/${user._id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs font-semibold text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl"
                            >
                              Open Support Profile
                              <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </Link>
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
    </div>
  )
}
