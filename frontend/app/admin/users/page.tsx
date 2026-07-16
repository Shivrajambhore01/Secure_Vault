"use client"

import { useState, useEffect } from "react"
import {
  UsersRound,
  Search,
  Mail,
  Calendar,
  Clock,
  FolderKey,
  Users,
  ShieldAlert,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { secureAdminFetch } from "@/lib/admin-api"
import { getAdminUser } from "@/lib/admin-store"

export default function PlatformUsersRegistryPage() {
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  
  // Pagination
  const [page, setPage] = useState(1)
  const limit = 10

  const fetchUsers = async () => {
    setLoading(true)
    const skip = (page - 1) * limit
    try {
      const response = await secureAdminFetch(`/users?skip=${skip}&limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setTotal(data.total)
      } else if (response.status === 403) {
        setAccessDenied(true)
      } else {
        toast.error("Failed to load user records")
      }
    } catch (error) {
      console.error("Error loading users:", error)
      toast.error("Network error loading platform users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const admin = getAdminUser()
    if (admin && admin.role !== "SUPER_ADMIN") {
      setAccessDenied(true)
      setLoading(false)
      return
    }
    fetchUsers()
  }, [page])

  // Filter users client-side if search query is provided
  // Note: search in production would hit the DB, but client-side filtering works perfectly here
  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(total / limit)

  if (loading && users.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading platform registry database...</p>
        </div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            You do not have permission to view the Users Registry. This section is restricted to Super Admin accounts only.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">User Registries</h2>
        <p className="text-muted-foreground text-sm">
          Platform-wide view of user profiles, storage utilization quotas, and dead man switch indicators.
        </p>
      </div>

      {/* Security alert reminder */}
      <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4 flex gap-3 text-amber-400 text-xs items-start leading-normal">
        <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold">Security Surveillance Mode Activated:</span> Administrative policies explicitly restrict viewing user credentials, local keys, security PINs, or raw decryptable asset binaries. Only platform indices and file metadata statistics are shown.
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold">User Registrations</CardTitle>
              <CardDescription>
                Showing {filteredUsers.length} of {total} total user registry profiles
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter by name/email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50 border-border"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No platform users found matching your specifications.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="w-[200px]">Profile Owner</TableHead>
                    <TableHead>Email address</TableHead>
                    <TableHead>Service Plan</TableHead>
                    <TableHead className="text-center">Assets</TableHead>
                    <TableHead className="text-center">Nominees</TableHead>
                    <TableHead>Inactivity Status</TableHead>
                    <TableHead>Last Online</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isInactive = user.logoutTime !== null && user.logoutTime !== undefined
                    return (
                      <TableRow key={user.id || user._id} className="border-b border-border hover:bg-muted/5 transition-colors">
                        <TableCell className="font-semibold py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold text-xs">
                              {user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-foreground">{user.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-semibold border-violet-500/30 text-violet-400 capitalize">
                            {user.plan || "Free"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-foreground font-semibold">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-muted/40 text-muted-foreground border border-border">
                            <FolderKey className="w-3.5 h-3.5 text-amber-500" />
                            {user.assetCount ?? 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-foreground font-semibold">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-muted/40 text-muted-foreground border border-border">
                            <Users className="w-3.5 h-3.5 text-sky-500" />
                            {user.nomineeCount ?? 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.nomineesNotified ? (
                            <Badge variant="outline" className="text-[10px] font-semibold border-red-500/30 text-red-400">
                              Inherited (Transferred)
                            </Badge>
                          ) : isInactive ? (
                            <Badge variant="outline" className="text-[10px] font-semibold border-amber-500/30 text-amber-400">
                              Inactive (Alert Phase)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/30 text-emerald-400">
                              Active / Online
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {user.lastActive ? new Date(user.lastActive).toLocaleString() : "Never active"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              
              {/* Pagination indicators footer */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-6 py-4">
                  <span className="text-xs text-muted-foreground">
                    Showing Page {page} of {totalPages} ({total} Users)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="border-border text-foreground hover:bg-violet-500/5"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="border-border text-foreground hover:bg-violet-500/5"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
