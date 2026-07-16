"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
  FolderKey,
  Database,
  ShieldAlert,
  UsersRound,
  Activity,
  ArrowRight,
  TrendingUp,
  FileCheck,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AdminStatCard } from "@/components/admin/admin-stat-card"
import { secureAdminFetch } from "@/lib/admin-api"
import { formatAdminBytes } from "@/lib/admin-store"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

export default function AdminDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await secureAdminFetch("/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        toast.error("Failed to fetch admin statistics")
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
      toast.error("Network error fetching admin statistics")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading system statistics...</p>
        </div>
      </div>
    )
  }

  // Fallback if stats didn't load
  const data = stats || {
    totalUsers: 0,
    totalNominees: 0,
    totalAssets: 0,
    totalAdmins: 0,
    activeUsers: 0,
    pendingVerifications: 0,
    totalStorageBytes: 0,
    recentUsers: [],
    planDistribution: {},
  }

  return (
    <div className="space-y-8">
      {/* Header section with refresh button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Console Control Center</h2>
          <p className="text-muted-foreground text-sm">
            Real-time infrastructure statistics and account metadata surveillance.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => fetchStats(true)}
          className="border-border text-foreground hover:bg-violet-500/5 hover:text-violet-400 self-start"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing stats..." : "Refresh Console Stats"}
        </Button>
      </div>

      {/* Grid of 4 main stats cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          title="Total Platform Users"
          value={data.totalUsers}
          description="Registered accounts on vault"
          icon={UsersRound}
          color="text-violet-500 bg-violet-500/10 border-violet-500/20"
        />
        <AdminStatCard
          title="Total Assigned Nominees"
          value={data.totalNominees}
          description="Designated asset beneficiaries"
          icon={Users}
          color="text-sky-500 bg-sky-500/10 border-sky-500/20"
        />
        <AdminStatCard
          title="Total Encrypted Assets"
          value={data.totalAssets}
          description="Encrypted files and credentials"
          icon={FolderKey}
          color="text-amber-500 bg-amber-500/10 border-amber-500/20"
        />
        <AdminStatCard
          title="Control Administrators"
          value={data.totalAdmins}
          description="System controllers on RBAC"
          icon={FileCheck}
          color="text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
        />
      </div>

      {/* Secondary Stats Row */}
      <div className="grid gap-6 sm:grid-cols-3">
        <AdminStatCard
          title="Active Monthly Users"
          value={data.activeUsers}
          description="Logged in during past 30 days"
          icon={Activity}
          color="text-rose-500 bg-rose-500/10 border-rose-500/20"
        />
        <AdminStatCard
          title="Pending Inheritances"
          value={data.pendingVerifications}
          description="Inactive users in verification window"
          icon={ShieldAlert}
          color="text-red-500 bg-red-500/10 border-red-500/20"
        />
        <AdminStatCard
          title="Total Storage Occupied"
          value={formatAdminBytes(data.totalStorageBytes)}
          description="GridFS encrypted database binary size"
          icon={Database}
          color="text-indigo-500 bg-indigo-500/10 border-indigo-500/20"
        />
      </div>

      {/* Bottom section: Split Registry and Settings/Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Side: Recent User Registrations */}
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Recent Signups</CardTitle>
              <CardDescription>Latest users registered on the platform</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
              onClick={() => router.push("/admin/users")}
            >
              Manage Users
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentUsers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No users registered on the platform yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.recentUsers.map((user: any) => (
                  <div key={user.id || user._id} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-semibold border-violet-500/30 text-violet-400 capitalize">
                          {user.plan || "Free"} Plan
                        </Badge>
                        {user.isVerified ? (
                          <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/30 text-emerald-400">
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-semibold border-amber-500/30 text-amber-400">
                            Pending Email
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Side: Storage Limit Metrics & Quick Action Panel */}
        <div className="space-y-6">
          {/* Storage Capacity overview card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Storage Analytics</CardTitle>
              <CardDescription>Overview of total physical storage used</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">GridFS Database Size</span>
                  <span className="text-foreground">{formatAdminBytes(data.totalStorageBytes)}</span>
                </div>
                {/* Visual storage indicator */}
                <Progress value={Math.min(100, (data.totalStorageBytes / (1024 * 1024 * 1024 * 50)) * 100)} className="h-2 bg-muted-foreground/10" />
                <p className="text-[10px] text-muted-foreground">
                  Estimated based on aggregate user uploads relative to 50 GB cloud allocation.
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-semibold text-foreground mb-3">Subscription Distribution</h4>
                <div className="space-y-2.5">
                  {Object.entries(data.planDistribution).map(([plan, count]: [string, any]) => (
                    <div key={plan} className="flex justify-between items-center text-xs">
                      <span className="capitalize text-muted-foreground">{plan} plan</span>
                      <span className="font-semibold text-foreground font-mono">{count} users</span>
                    </div>
                  ))}
                  {Object.keys(data.planDistribution).length === 0 && (
                    <p className="text-xs text-muted-foreground">No subscriber records found.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick placeholder for recent activities log */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Recent Activity Logs</CardTitle>
              <CardDescription>Platform audit trails stream</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 text-xs leading-normal">
                <div className="h-2 w-2 rounded-full bg-violet-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Console Access Authorized</p>
                  <p className="text-[10px] text-muted-foreground">Just now • Login from console dashboard</p>
                </div>
              </div>
              <div className="flex gap-3 text-xs leading-normal">
                <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Database Backup Generated</p>
                  <p className="text-[10px] text-muted-foreground">2 hours ago • Automated scheduler</p>
                </div>
              </div>
              <div className="flex gap-3 text-xs leading-normal">
                <div className="h-2 w-2 rounded-full bg-sky-500 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Twilio Flow Pulse OK</p>
                  <p className="text-[10px] text-muted-foreground">4 hours ago • Twilio verification ping</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
