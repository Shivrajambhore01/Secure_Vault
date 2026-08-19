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
  CheckCircle2,
  AlertCircle,
  Activity,
  UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  getUser,
  saveUser,
  formatBytes,
  getCurrentUserId,
} from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { DigitalAsset, Nominee, User } from "@/lib/store"

const typeIcons: Record<string, React.ElementType> = {
  document: FileText,
  password: KeyRound,
  "crypto-key": FileKey,
  image: ImageIcon,
  "legal-file": FileCheck,
}

const typeColors: Record<string, string> = {
  document: "text-sky-500 bg-sky-500/10 border-sky-500/20",
  password: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  "crypto-key": "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  image: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  "legal-file": "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
}

const CHART_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#10b981",
]

export default function DashboardOverview() {
  const [user, setUser] = useState<User | null>(null)
  const [assets, setAssets] = useState<DigitalAsset[]>([])
  const [nominees, setNominees] = useState<Nominee[]>([])
  const [storage, setStorage] = useState(0)

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

  const totalLimit = user?.storageLimit || 500 * 1024 * 1024
  const storagePercentage = Math.min((storage / totalLimit) * 100, 100)

  const checklistItems = [
    { label: "Secure your first digital asset", status: assets.length > 0, href: "/dashboard/assets/add" },
    { label: "Designate inheritance nominees", status: nominees.length > 0, href: "/dashboard/nominees" },
    { label: "Configure emergency fallback PIN", status: true, href: "/dashboard/settings" },
    { label: "Complete your profile details", status: user?.isProfileComplete || false, href: "/dashboard/settings" },
  ]

  const completedCount = checklistItems.filter(item => item.status).length
  const vaultHealthPercentage = Math.round((completedCount / checklistItems.length) * 100)

  const getNomineeColor = (index: number) => {
    const colors = [
      "bg-sky-500/10 text-sky-500 border-sky-500/30 shadow-[0_0_10px_rgba(14,165,233,0.15)]",
      "bg-violet-500/10 text-violet-500 border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.15)]",
      "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
      "bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
    ]
    return colors[index % colors.length]
  }

  const assetTypeHoverClasses: Record<string, string> = {
    document: "hover:border-sky-500/40 hover:bg-sky-500/5 hover:shadow-[0_0_15px_rgba(14,165,233,0.1)]",
    password: "hover:border-amber-500/40 hover:bg-amber-500/5 hover:shadow-[0_0_15px_rgba(245,158,11,0.1)]",
    "crypto-key": "hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:shadow-[0_0_15px_rgba(99,102,241,0.1)]",
    image: "hover:border-rose-500/40 hover:bg-rose-500/5 hover:shadow-[0_0_15px_rgba(244,63,94,0.1)]",
    "legal-file": "hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]",
  }

  return (
    <div className="flex flex-col gap-8 p-1 sm:p-2 bg-dot-grid min-h-screen">
      {/* Premium Welcome Hero Panel */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-indigo-500/15 via-primary/5 to-purple-500/10 p-8 md:p-10 shadow-xl backdrop-blur-md">
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/20 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl animate-pulse" style={{ animationDuration: "8s" }} />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-bold text-emerald-500 border border-emerald-500/20 shadow-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Vault Secure • Active Real-Time Protection
            </div>
            
            <h1 className="text-3xl font-black tracking-tight text-foreground md:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-primary">
              Welcome back{user ? `, ${user.fullName.split(" ")[0]}` : ""}
            </h1>
            <p className="max-w-xl text-sm md:text-base text-muted-foreground leading-relaxed">
              Configure your secure digital heritage, archive critical assets, and define trusted transfer conditions.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 shrink-0">
            <Link href="/dashboard/assets/add">
              <Button className="h-12 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg hover:shadow-primary/20 hover:bg-primary/95 transition-all hover:scale-[1.03] active:scale-[0.98] duration-200 px-6">
                <PlusCircle className="mr-2 h-5 w-5" />
                Secure New Asset
              </Button>
            </Link>
            <Link href="/dashboard/nominees">
              <Button variant="outline" className="h-12 rounded-xl border-border bg-card/40 backdrop-blur-md font-bold hover:bg-secondary/80 transition-all hover:scale-[1.03] active:scale-[0.98] duration-200 px-6 text-foreground">
                <UserPlus className="mr-2 h-5 w-5 text-muted-foreground" />
                Assign Nominee
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid gap-8 md:grid-cols-6 lg:grid-cols-12">
        {/* Cell 1: Inventory (Bento Big Cell) */}
        <Card className="md:col-span-6 lg:col-span-8 bg-glass glass-border backdrop-blur-md shadow-lg transition-all hover:shadow-xl hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between p-6">
          <CardHeader className="pb-4 p-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-extrabold flex items-center gap-2.5">
                <FolderKey className="h-6 w-6 text-primary" />
                Vault Inventory
              </CardTitle>
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-bold px-3 py-1 text-xs rounded-full">
                {assets.length} Assets Archived
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center p-0 mt-4">
            {assets.length > 0 ? (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
                {Object.entries(typeIcons).map(([type, Icon]) => {
                  const count = assetTypeCounts[type] || 0;
                  const colors = typeColors[type] || "text-muted-foreground bg-muted";
                  const hoverGlow = assetTypeHoverClasses[type] || "hover:border-border";
                  return (
                    <div 
                      key={type} 
                      className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1.5 cursor-pointer bg-card/20 backdrop-blur-xs ${colors} ${hoverGlow} ${count > 0 ? "opacity-100 border-border" : "opacity-35 border-transparent"}`}
                    >
                      <Icon className="h-8 w-8 mb-3" />
                      <span className="text-xs font-bold capitalize text-center leading-none tracking-tight">
                        {type.replace("-", " ")}
                      </span>
                      <span className="text-2xl font-black mt-3 leading-none">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-44 flex-col items-center justify-center gap-4 text-center">
                <div className="p-4 rounded-full bg-muted/20 border border-border/40">
                  <FolderKey className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Your secure vault is empty</p>
                  <p className="text-xs text-muted-foreground mt-1">Start encrypting files or keys to populate your inventory.</p>
                </div>
                <Link href="/dashboard/assets/add">
                  <Button size="sm" className="gap-2 bg-primary text-primary-foreground font-bold rounded-lg shadow-sm px-4">
                    <PlusCircle className="h-4 w-4" />
                    Secure Your First Asset
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cell 2: Premium Tier (Bento Right Top Cell) */}
        <Card className={`md:col-span-3 lg:col-span-4 bg-glass glass-border backdrop-blur-md shadow-lg transition-all hover:shadow-xl duration-300 rounded-2xl flex flex-col justify-between p-6 ${
          user?.plan === "premium" 
            ? "glow-card-premium holo-gradient-premium animate-border-shimmer" 
            : user?.plan === "pro" 
              ? "glow-card-pro holo-gradient-pro" 
              : "glow-card-free holo-gradient-free"
        }`}>
          <CardHeader className="pb-2 p-0">
            <CardTitle className="text-xl font-extrabold flex items-center gap-2.5">
              <Shield className="h-6 w-6 text-primary" />
              Vault Tier
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between p-0 mt-4">
            <div className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between min-h-[120px] bg-card/10 backdrop-blur-md border-white/5`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Current Plan</h3>
                  <p className="text-3xl font-black mt-1 tracking-tight capitalize bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-primary">
                    {user?.plan || "Free"}
                  </p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-background/60 border backdrop-blur-lg shadow-md ${
                  user?.plan === "premium" ? "border-amber-500/30 text-amber-500 shadow-amber-500/5" : user?.plan === "pro" ? "border-blue-500/30 text-blue-500 shadow-blue-500/5" : "border-border text-muted-foreground"
                }`}>
                  {user?.plan === "premium" ? <Crown className="h-6 w-6 animate-pulse" /> : user?.plan === "pro" ? <Zap className="h-6 w-6 animate-pulse" /> : <Shield className="h-6 w-6" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed font-medium">
                {user?.plan === "premium" ? "Unlimited access. Priority multi-node legacy transfers active." : user?.plan === "pro" ? "Extended storage limits and dual-nominee release active." : "Standard legacy storage with free features."}
              </p>
            </div>
            
            <Link href="/dashboard/pricing" className="w-full mt-4 block">
              <Button variant="ghost" size="sm" className="w-full text-xs font-bold text-primary hover:text-primary/80 justify-between px-2.5 py-2 hover:bg-secondary/40 rounded-xl transition-all">
                <span>Manage & Upgrade Plan</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Cell 3: Secure Storage (Bento Middle Left Cell) */}
        <Card className="md:col-span-3 lg:col-span-4 bg-glass glass-border backdrop-blur-md shadow-lg transition-all hover:shadow-xl hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between p-6">
          <CardHeader className="pb-2 p-0">
            <CardTitle className="text-xl font-extrabold flex items-center gap-2.5">
              <HardDrive className="h-6 w-6 text-primary" />
              Secure Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between p-0 mt-4 space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
                {formatBytes(storage)}
              </p>
              <p className="text-xs text-muted-foreground font-semibold">
                of {formatBytes(totalLimit)} Limit
              </p>
            </div>

            <div className="space-y-3">
              {/* Premium Progress Bar */}
              <div className="relative w-full h-3 rounded-full bg-secondary/50 overflow-hidden border border-white/5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-primary transition-all duration-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" 
                  style={{ width: `${storagePercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className={storagePercentage > 90 ? "text-destructive" : "text-primary"}>
                  {Math.round(storagePercentage)}% Capacity Used
                </span>
                <span className="text-muted-foreground font-semibold">
                  {formatBytes(totalLimit - storage)} Free
                </span>
              </div>
            </div>
            
            <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
              Encrypted vault segments are hashed and distributed across decentralized cloud infrastructure.
            </p>
          </CardContent>
        </Card>

        {/* Cell 4: Nominees (Bento Middle Center Cell) */}
        <Card className="md:col-span-3 lg:col-span-4 bg-glass glass-border backdrop-blur-md shadow-lg transition-all hover:shadow-xl hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between p-6">
          <CardHeader className="pb-2 p-0">
            <CardTitle className="text-xl font-extrabold flex items-center gap-2.5">
              <Users className="h-6 w-6 text-primary" />
              Active Nominees
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between p-0 mt-4 space-y-4">
            {nominees.length > 0 ? (
              <div className="space-y-4">
                <div className="flex -space-x-3 overflow-hidden py-2">
                  {nominees.slice(0, 5).map((nominee, idx) => {
                    const initials = nominee.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                    return (
                      <div
                        key={nominee.id}
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-background font-black text-xs shadow-md hover:translate-y-[-4px] hover:scale-105 hover:z-10 transition-all cursor-pointer ${getNomineeColor(
                          idx
                        )}`}
                        title={nominee.name}
                      >
                        {initials}
                      </div>
                    )
                  })}
                  {nominees.length > 5 && (
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-background bg-secondary text-secondary-foreground font-black text-xs shadow-md">
                      +{nominees.length - 5}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Your assets are assigned to <strong className="text-foreground">{nominees.length} nominee{nominees.length > 1 ? "s" : ""}</strong>. They will securely acquire access credentials only following verified inactivity triggers.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 text-center gap-3">
                <div className="p-3 rounded-full bg-muted/20 border border-border/40">
                  <Users className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">No nominees designated yet</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Secure your assets by assigning a trusted legacy nominee.</p>
                </div>
                <Link href="/dashboard/nominees">
                  <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-lg px-3">
                    Set Up Heritage
                  </Button>
                </Link>
              </div>
            )}

            <Link href="/dashboard/nominees" className="w-full block">
              <Button variant="ghost" size="sm" className="w-full text-xs font-bold text-primary hover:text-primary/80 justify-between px-2.5 py-2 hover:bg-secondary/40 rounded-xl transition-all">
                <span>Manage Nominees</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Cell 5: Inactivity (Bento Middle Right Cell) */}
        <Card className="md:col-span-3 lg:col-span-4 bg-glass glass-border backdrop-blur-md shadow-lg transition-all hover:shadow-xl hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between p-6">
          <CardHeader className="pb-2 p-0">
            <CardTitle className="text-xl font-extrabold flex items-center gap-2.5">
              <Clock className="h-6 w-6 text-primary" />
              Inactivity Trigger
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between p-0 mt-4 space-y-4">
            <div>
              <p className="text-3xl font-black tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
                {user ? (user.inactivityPeriod < 1 ? "2 Minutes (Test)" : `${user.inactivityPeriod} Months`) : "—"}
              </p>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                Maximum Inactivity Window
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-500 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Protocol Standby
                </span>
                <span className="text-muted-foreground font-semibold">100% Reset</span>
              </div>
              <Progress value={100} className="h-2 bg-secondary/50 [&>div]:bg-emerald-500" />
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
              Every login automatically resets this timer. Heritage transfer launches if countdown is breached without authentication.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid Bottom Section */}
      <div className="grid gap-8 lg:grid-cols-12 mt-2">
        {/* Cell 6: Vault Integrity Score */}
        <Card className="lg:col-span-5 bg-glass glass-border backdrop-blur-md shadow-lg transition-all hover:shadow-xl hover:border-primary/20 duration-300 rounded-2xl p-6">
          <CardHeader className="pb-4 p-0">
            <CardTitle className="text-xl font-extrabold flex items-center gap-2.5">
              <Shield className="h-6 w-6 text-primary" />
              Vault Integrity Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-0 mt-4">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-6 bg-card/10 p-5 rounded-2xl border border-white/5">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--color-primary)" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted/10"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="url(#scoreGrad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - vaultHealthPercentage / 100)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-black text-foreground leading-none">{vaultHealthPercentage}%</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-black mt-1">Ready</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-1 text-center sm:text-left">
                <h3 className="text-base font-black text-foreground">
                  {vaultHealthPercentage === 100 
                    ? "Vault Fully Configured" 
                    : vaultHealthPercentage >= 75 
                      ? "High Readiness Level" 
                      : "Action Required"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                  Your configuration integrity is at {vaultHealthPercentage}%. Satisfy the checklist criteria to guarantee secure digital heritage protocols.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Setup Checklist</h4>
              <div className="grid gap-2">
                {checklistItems.map((item, idx) => (
                  <Link key={idx} href={item.href}>
                    <div className="group flex items-center justify-between p-3 rounded-xl bg-background/30 border border-white/5 hover:border-primary/40 hover:bg-secondary/40 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className={`h-5 w-5 ${item.status ? "text-emerald-500 fill-emerald-500/10" : "text-muted-foreground/30"}`} />
                        <span className={`text-xs font-bold transition-colors ${item.status ? "text-foreground line-through decoration-muted-foreground/30 opacity-60" : "text-foreground group-hover:text-primary"}`}>
                          {item.label}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/55 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cell 7: Recent Assets */}
        <Card className="lg:col-span-7 bg-glass glass-border backdrop-blur-md shadow-lg transition-all hover:shadow-xl hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between p-6">
          <CardHeader className="pb-4 p-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-extrabold flex items-center gap-2.5">
                <Activity className="h-6 w-6 text-primary" />
                Recent Assets
              </CardTitle>
              <Link href="/dashboard/assets">
                <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary/80 font-black text-xs hover:bg-secondary/40 px-3 py-1.5 rounded-xl transition-all">
                  View All Assets
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between p-0 mt-4">
            {assets.length > 0 ? (
              <div className="flex flex-col gap-3">
                {assets.slice(0, 4).map((asset) => {
                  const Icon = typeIcons[asset.type] || FileText
                  const assetNomineeIds = asset.nomineeIds || (asset.nomineeId ? [asset.nomineeId] : [])
                  const assignedNominees = nominees.filter((n) => assetNomineeIds.includes(n.id))
                  const nomineeNames = assignedNominees.map((n) => n.name).join(", ")
                  const colors = typeColors[asset.type] || "text-muted-foreground bg-muted"
                  return (
                    <div
                      key={asset.id}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-background/30 p-4 transition-all hover:shadow-md hover:border-primary/30 hover:bg-secondary/30 cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border backdrop-blur-md shadow-sm ${colors}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors leading-snug">{asset.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-none">
                            {asset.type.replace("-", " ")} {nomineeNames ? `• Assigned to ${nomineeNames}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold px-2 whitespace-nowrap">
                        {new Date(asset.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-52 flex-col items-center justify-center gap-3 text-center">
                <div className="p-3 rounded-full bg-muted/20 border border-border/40">
                  <Activity className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground font-medium max-w-xs">No secure legacy assets found. Your uploads and secure credentials will show up here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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

