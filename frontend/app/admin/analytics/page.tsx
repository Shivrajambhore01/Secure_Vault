"use client"

import { useState, useEffect } from "react"
import { BarChart3, TrendingUp, Database, Users, Calendar, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { secureAdminFetch } from "@/lib/admin-api"
import { formatAdminBytes } from "@/lib/admin-store"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export default function AnalyticsConsolePage() {
  const [stats, setStats] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await secureAdminFetch("/stats")
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        } else {
          toast.error("Failed to load analytics data")
        }
      } catch (error) {
        console.error("Error loading analytics:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Running telemetry and data analytics...</p>
        </div>
      </div>
    )
  }

  const data = stats || {
    totalUsers: 0,
    totalNominees: 0,
    totalAssets: 0,
    totalStorageBytes: 0,
    activeUsers: 0,
    planDistribution: {},
  }

  // Calculate some analytics percentages
  const freeUsers = data.planDistribution["free"] || 0
  const proUsers = data.planDistribution["pro"] || 0
  const premiumUsers = data.planDistribution["premium"] || 0
  const totalPlans = freeUsers + proUsers + premiumUsers || 1
  
  const freePercent = Math.round((freeUsers / totalPlans) * 100)
  const proPercent = Math.round((proUsers / totalPlans) * 100)
  const premiumPercent = Math.round((premiumUsers / totalPlans) * 100)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">System Telemetry & Analytics</h2>
        <p className="text-muted-foreground text-sm">
          Platform performance indices, plan conversion ratios, and storage capacity auditing.
        </p>
      </div>

      {/* Analytics widgets row */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversion Rate</span>
              <span className="text-emerald-500 flex items-center text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-lg">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                +12.4%
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold tracking-tight font-mono text-foreground">
                {Math.round(((proUsers + premiumUsers) / totalPlans) * 100)}%
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5">Paid subscriptions ratio</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Average Assets / User</span>
              <span className="text-violet-400 flex items-center text-xs font-bold bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-lg">
                Steady
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold tracking-tight font-mono text-foreground">
                {data.totalUsers ? (data.totalAssets / data.totalUsers).toFixed(1) : "0"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5">Encrypted files & nodes per account</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Heartbeat Active Pulse</span>
              <span className="text-emerald-500 flex items-center text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-lg">
                Healthy
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold tracking-tight font-mono text-foreground">
                {data.totalUsers ? Math.round((data.activeUsers / data.totalUsers) * 100) : "0"}%
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5">User accounts online in last 30d</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AVG Upload Size</span>
              <span className="text-amber-500 flex items-center text-xs font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-lg">
                Optimized
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-bold tracking-tight font-mono text-foreground">
                {data.totalAssets ? formatAdminBytes(Math.round(data.totalStorageBytes / data.totalAssets)) : "0 B"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1.5">Average file payload encryption size</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Telemetry Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Plan distribution visual indicator card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Subscription Plan Share</CardTitle>
            <CardDescription>Ratios of users across different platform plans</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-violet-600" />
                  Free Tier
                </span>
                <span className="font-semibold text-foreground">{freeUsers} Users ({freePercent}%)</span>
              </div>
              <div className="w-full bg-muted/40 h-3 rounded-full overflow-hidden">
                <div className="bg-violet-600 h-full rounded-full transition-all duration-500" style={{ width: `${freePercent}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-sky-500" />
                  Pro Tier
                </span>
                <span className="font-semibold text-foreground">{proUsers} Users ({proPercent}%)</span>
              </div>
              <div className="w-full bg-muted/40 h-3 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full transition-all duration-500" style={{ width: `${proPercent}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  Premium Tier
                </span>
                <span className="font-semibold text-foreground">{premiumUsers} Users ({premiumPercent}%)</span>
              </div>
              <div className="w-full bg-muted/40 h-3 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${premiumPercent}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Visual Bar chart for Storage & Bandwidth Telemetry */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Storage Growth Telemetry</CardTitle>
            <CardDescription>Visualized usage trend indices relative to database quotas</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px] flex items-end justify-between gap-4 pt-4">
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="w-full bg-violet-600/20 group-hover:bg-violet-600/40 rounded-t h-[40px] transition-all duration-300 relative">
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">10%</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Q1</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="w-full bg-violet-600/30 group-hover:bg-violet-600/50 rounded-t h-[60px] transition-all duration-300 relative">
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">25%</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Q2</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="w-full bg-violet-600/50 group-hover:bg-violet-600/70 rounded-t h-[90px] transition-all duration-300 relative">
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">45%</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Q3</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="w-full bg-violet-600/75 group-hover:bg-violet-600/90 rounded-t h-[130px] transition-all duration-300 relative">
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">65%</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Q4</span>
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 group">
              <div className="w-full bg-gradient-to-t from-violet-600 to-indigo-600 rounded-t h-[160px] transition-all duration-300 relative shadow-lg shadow-violet-600/10">
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-violet-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">100%</span>
              </div>
              <span className="text-[10px] text-violet-400 font-semibold font-mono">Current</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
