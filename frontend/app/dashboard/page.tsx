"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  FolderKey,
  Users,
  HardDrive,
  Clock,
  ArrowRight,
  PlusCircle,
  FileText,
  KeyRound,
  ImageIcon,
  FileKey,
  FileCheck,
  Crown,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getUser,
  saveUser,
  formatBytes,
  getCurrentUserId,
} from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { DigitalAsset, Nominee, User } from "@/lib/store"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

const typeIcons: Record<string, React.ElementType> = {
  document: FileText,
  password: KeyRound,
  "crypto-key": FileKey,
  image: ImageIcon,
  "legal-file": FileCheck,
}

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

export default function DashboardOverview() {
  const [user, setUser] = useState<User | null>(null)
  const [assets, setAssets] = useState<DigitalAsset[]>([])
  const [nominees, setNominees] = useState<Nominee[]>([])
  const [storage, setStorage] = useState(0)
  const [inactivity, setInactivity] = useState({ remaining: 0, total: 0, percentage: 0, isExpired: false })

  useEffect(() => {
    const userId = getCurrentUserId()

    if (userId) {
      const fetchData = async () => {
        try {
          const [assetsRes, nomineesRes, userRes] = await Promise.all([
            secureFetch(`/assets/${userId}`),
            secureFetch(`/nominees/${userId}`),
            secureFetch(`/auth/me/${userId}`)
          ])

          if (userRes.ok) {
            const userData = await userRes.json()
            saveUser(userData)
            setUser(userData)
          }

          const assetsData = await assetsRes.json()
          const nomineesData = await nomineesRes.json()

          setAssets(assetsData)
          setNominees(nomineesData)
          setStorage(assetsData.reduce((sum: number, a: any) => sum + (a.fileSize || 1024), 0))

          // Inactivity status (simulated based on user settings)
          const currUser = getUser()
          if (currUser) {
            const totalMs = currUser.inactivityPeriod * 30 * 24 * 60 * 60 * 1000
            // Since we don't have logout time synced yet, assume 10% elapsed for demo
            setInactivity({
              remaining: totalMs * 0.9,
              total: totalMs,
              percentage: 10,
              isExpired: false
            })
          }
        } catch (error) {
          console.error("Dashboard fetch error:", error)
        }
      }
      fetchData()
    }
  }, [])

  const assetTypeCounts = assets.reduce((acc, asset) => {
    acc[asset.type] = (acc[asset.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const chartData = Object.entries(assetTypeCounts).map(([name, value]) => ({
    name: name.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    value,
  }))

  const formatRemaining = (ms: number) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24))
    const months = Math.floor(days / 30)
    const remDays = days % 30
    if (months > 0) return `${months}mo ${remDays}d`
    return `${days}d`
  }

  const summaryCards = [
    {
      title: "Digital Assets",
      value: assets.length.toString(),
      icon: FolderKey,
      href: "/dashboard/assets",
    },
    {
      title: "Nominees",
      value: nominees.length.toString(),
      icon: Users,
      href: "/dashboard/nominees",
    },
    {
      title: "Storage Used",
      value: formatBytes(storage),
      icon: HardDrive,
      href: "/dashboard/assets",
    },
    {
      title: "Vault Tier",
      value: user?.plan?.toUpperCase() || "FREE",
      icon: user?.plan === "premium" ? Crown : user?.plan === "pro" ? Zap : Shield,
      href: "/dashboard/pricing",
    },
    {
      title: "Inactivity Timer",
      value: user ? `${user.inactivityPeriod}mo` : "—",
      icon: Clock,
      href: "/dashboard/settings",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back{user ? `, ${user.fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {"Here's an overview of your digital vault."}
        </p>
      </div>

      {/* Plan Status Banner */}
      {user?.plan && user.plan !== "free" && (
        <div className={`flex items-center justify-between rounded-2xl p-4 border animate-in slide-in-from-top-4 duration-500 ${user.plan === "premium" ? "bg-amber-500/10 border-amber-500/20" : "bg-blue-500/10 border-blue-500/20"
          }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-background ${user.plan === "premium" ? "text-amber-500" : "text-blue-500"
              }`}>
              {user.plan === "premium" ? <Crown className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm font-bold capitalize">{user.plan} Plan Active</p>
              <p className="text-xs text-muted-foreground">Thank you for securing your legacy with us.</p>
            </div>
          </div>
          <Link href="/dashboard/pricing">
            <Button variant="ghost" size="sm" className="text-xs">View Plans</Button>
          </Link>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          const isStorage = card.title === "Storage Used"
          const usagePercent = user && user.storageLimit > 0
            ? (storage / user.storageLimit) * 100
            : 0
          const isWarning = usagePercent > 90

          return (
            <Link key={card.title} href={card.href}>
              <Card className="group cursor-pointer border-border bg-card transition-all hover:border-primary/40 hover:bg-secondary/30 min-h-[110px]">
                <CardContent className="flex flex-col gap-3 p-5 h-full justify-center">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{card.title}</p>
                      <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    </div>
                  </div>
                  {isStorage && user && (
                    <div className="space-y-1.5 animate-in fade-in duration-700">
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 ${isWarning ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-medium">
                        <span className={isWarning ? "text-destructive font-bold" : "text-muted-foreground"}>
                          {Math.round(usagePercent)}% Used
                        </span>
                        <span className="text-muted-foreground font-semibold">
                          {formatBytes(user.storageLimit)} Limit
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Asset distribution chart */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Asset Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="flex items-center gap-6">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "8px",
                          color: "var(--color-foreground)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2">
                  {chartData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {item.name} ({item.value})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
                <FolderKey className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No assets yet</p>
                <Link href="/dashboard/assets/add">
                  <Button size="sm" className="gap-2 bg-primary text-primary-foreground">
                    <PlusCircle className="h-4 w-4" />
                    Add Your First Asset
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vault Health status */}
        <Card className="border-border bg-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Vault Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeOpacity="0.1"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - 85 / 100)}`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-bold text-foreground">85%</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Secure</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 flex-1">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Excellent Readiness</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your vault is well-prepared for legacy transfer. Complete the remaining steps to reach 100%.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 border border-emerald-500/20">
                      <div className="h-1 w-1 rounded-full bg-emerald-500" />
                      Nominees Set
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 border border-emerald-500/20">
                      <div className="h-1 w-1 rounded-full bg-emerald-500" />
                      2FA Active
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recommended Actions</p>
                <div className="grid gap-2">
                  <Link href="/dashboard/nominees">
                    <div className="group flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-xs font-medium text-foreground">Verify nominee contact details</span>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                  <Link href="/dashboard/settings">
                    <div className="group flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Shield className="h-4 w-4 text-amber-500" />
                        </div>
                        <span className="text-xs font-medium text-foreground">Update emergency access PIN</span>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent assets */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Recent Assets</CardTitle>
          <Link href="/dashboard/assets">
            <Button variant="ghost" size="sm" className="gap-1 text-primary">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {assets.length > 0 ? (
            <div className="flex flex-col gap-3">
              {assets.slice(0, 5).map((asset) => {
                const Icon = typeIcons[asset.type] || FileText
                const nominee = nominees.find((n) => n.id === asset.nomineeId)
                return (
                  <div
                    key={asset.id}
                    className="flex items-center gap-4 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-secondary/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {asset.type.replace("-", " ")} {nominee ? `• Assigned to ${nominee.name}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">No assets yet. Start by adding your first digital asset.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Settings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
