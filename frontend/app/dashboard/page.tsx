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
      "bg-sky-500/10 text-sky-500 border-sky-500/30",
      "bg-violet-500/10 text-violet-500 border-violet-500/30",
      "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
      "bg-amber-500/10 text-amber-500 border-amber-500/30",
    ]
    return colors[index % colors.length]
  }

  return (
    <div className="flex flex-col gap-6 p-1 sm:p-2">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 dark:border-white/5 bg-linear-to-br from-indigo-500/15 via-primary/5 to-purple-500/10 p-6 md:p-8 shadow-xs">
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500 border border-emerald-500/20 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Vault Secure • Active Protection
            </div>
            
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              Welcome back{user ? `, ${user.fullName.split(" ")[0]}` : ""}
            </h1>
            <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
              Manage your digital assets, set up secure heritage protocols, and keep your legacy completely protected.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/assets/add">
              <Button className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/95 transition-all hover:scale-105 active:scale-95 duration-200">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Asset
              </Button>
            </Link>
            <Link href="/dashboard/nominees">
              <Button variant="outline" className="h-11 rounded-xl border-border bg-card/50 backdrop-blur-xs font-semibold hover:bg-secondary/80 transition-all hover:scale-105 active:scale-95 duration-200">
                <UserPlus className="mr-2 h-4 w-4 text-muted-foreground" />
                Assign Nominee
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-6 lg:grid-cols-12">
        <Card className="md:col-span-6 lg:col-span-8 border-border bg-card/40 backdrop-blur-xs shadow-xs transition-all hover:shadow-md hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FolderKey className="h-5 w-5 text-primary" />
                Vault Inventory
              </CardTitle>
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/25 border-none font-semibold px-2.5 py-0.5">
                {assets.length} Total Assets
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {assets.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                {Object.entries(typeIcons).map(([type, Icon]) => {
                  const count = assetTypeCounts[type] || 0;
                  const colors = typeColors[type] || "text-muted-foreground bg-muted";
                  return (
                    <div 
                      key={type} 
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xs ${colors} ${count > 0 ? "opacity-100" : "opacity-40"}`}
                    >
                      <Icon className="h-6 w-6 mb-2" />
                      <span className="text-[11px] font-bold capitalize text-center leading-none tracking-tight">
                        {type.replace("-", " ")}
                      </span>
                      <span className="text-xl font-extrabold mt-2 leading-none">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-36 flex-col items-center justify-center gap-3 text-center">
                <FolderKey className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Your secure vault is empty</p>
                <Link href="/dashboard/assets/add">
                  <Button size="sm" className="gap-2 bg-primary text-primary-foreground font-semibold">
                    <PlusCircle className="h-4 w-4" />
                    Secure Your First Asset
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 lg:col-span-4 border-border bg-card/40 backdrop-blur-xs shadow-xs transition-all hover:shadow-md hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Vault Tier
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className={`relative overflow-hidden rounded-xl border p-4 flex flex-col justify-between min-h-[110px] ${
              user?.plan === "premium" 
                ? "bg-gradient-to-br from-amber-500/10 via-background to-background border-amber-500/30 text-amber-500" 
                : user?.plan === "pro" 
                  ? "bg-gradient-to-br from-blue-500/10 via-background to-background border-blue-500/30 text-blue-500" 
                  : "bg-secondary/40 border-border text-foreground"
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xs uppercase font-extrabold tracking-widest text-muted-foreground">Current Plan</h3>
                  <p className="text-3xl font-extrabold mt-1 tracking-tight capitalize">
                    {user?.plan || "Free"}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-background border ${
                  user?.plan === "premium" ? "border-amber-500/20 text-amber-500 shadow-amber-500/5 shadow-md" : user?.plan === "pro" ? "border-blue-500/20 text-blue-500 shadow-blue-500/5 shadow-md" : "border-border text-muted-foreground"
                }`}>
                  {user?.plan === "premium" ? <Crown className="h-5 w-5" /> : user?.plan === "pro" ? <Zap className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {user?.plan === "premium" ? "Ultimate access. 24/7 priority legacy transfers active." : user?.plan === "pro" ? "Extended storage limits and additional nominees active." : "Standard legacy storage with free features."}
              </p>
            </div>
            
            <Link href="/dashboard/pricing" className="w-full">
              <Button variant="ghost" size="sm" className="w-full text-xs font-semibold text-primary hover:text-primary/80 justify-between">
                <span>Manage Subscription</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 lg:col-span-4 border-border bg-card/40 backdrop-blur-xs shadow-xs transition-all hover:shadow-md hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              Secure Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-extrabold tracking-tight">
                {formatBytes(storage)}
              </p>
              <p className="text-xs text-muted-foreground">
                of {formatBytes(totalLimit)} Limit
              </p>
            </div>

            <div className="space-y-2">
              <Progress 
                value={storagePercentage} 
                className="h-2.5 bg-secondary [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-indigo-500" 
              />
              <div className="flex justify-between text-[11px] font-bold">
                <span className={storagePercentage > 90 ? "text-destructive" : "text-primary"}>
                  {Math.round(storagePercentage)}% Used
                </span>
                <span className="text-muted-foreground font-semibold">
                  {formatBytes(totalLimit - storage)} Free
                </span>
              </div>
            </div>
            
            <p className="text-[11px] text-muted-foreground leading-normal">
              Encrypted files are divided, hashed, and distributed safely in cloud storage clusters.
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 lg:col-span-4 border-border bg-card/40 backdrop-blur-xs shadow-xs transition-all hover:shadow-md hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Active Nominees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {nominees.length > 0 ? (
              <div className="space-y-3">
                <div className="flex -space-x-2.5 overflow-hidden py-1">
                  {nominees.slice(0, 4).map((nominee, idx) => {
                    const initials = nominee.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                    return (
                      <div
                        key={nominee.id}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-background font-extrabold text-xs shadow-sm hover:translate-y-[-2px] transition-transform ${getNomineeColor(
                          idx
                        )}`}
                        title={nominee.name}
                      >
                        {initials}
                      </div>
                    )
                  })}
                  {nominees.length > 4 && (
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-secondary text-secondary-foreground font-bold text-xs">
                      +{nominees.length - 4}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  Your assets are assigned to <strong className="text-foreground">{nominees.length} nominee{nominees.length > 1 ? "s" : ""}</strong>. They will only receive access following the inactivity trigger.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2 text-center gap-2">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No nominees designated yet</p>
                <Link href="/dashboard/nominees">
                  <Button size="sm" variant="outline" className="h-8 text-xs font-semibold">
                    Set Up Heritage
                  </Button>
                </Link>
              </div>
            )}

            <Link href="/dashboard/nominees" className="w-full block">
              <Button variant="ghost" size="sm" className="w-full text-xs font-semibold text-primary hover:text-primary/80 justify-between p-0">
                <span>Manage Nominees</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 lg:col-span-4 border-border bg-card/40 backdrop-blur-xs shadow-xs transition-all hover:shadow-md hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Inactivity Trigger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {user ? `${user.inactivityPeriod} Months` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Maximum Inactivity Window
              </p>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-500 font-bold">Protocol Standby</span>
                <span className="text-muted-foreground">100% Reset</span>
              </div>
              <Progress value={100} className="h-2 bg-secondary [&>div]:bg-emerald-500" />
            </div>

            <p className="text-[11px] text-muted-foreground leading-normal">
              Logging into SecureVault automatically resets this timer. Heritage instructions are launched if the timer hits 0.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 mt-2">
        <Card className="lg:col-span-5 border-border bg-card/40 backdrop-blur-xs shadow-xs transition-all hover:shadow-md hover:border-primary/20 duration-300 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Vault Integrity Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-6">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeOpacity="0.08"
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
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - vaultHealthPercentage / 100)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-black text-foreground leading-none">{vaultHealthPercentage}%</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-extrabold mt-1">Ready</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-1 text-center sm:text-left">
                <h3 className="text-base font-extrabold text-foreground">
                  {vaultHealthPercentage === 100 
                    ? "Vault Fully Configured" 
                    : vaultHealthPercentage >= 75 
                      ? "High Readiness Level" 
                      : "Action Required"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                  Your legacy protocol configuration score is {vaultHealthPercentage}%. Finalize the recommended checks to assure complete legacy transfers.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Setup Checklist</h4>
              <div className="grid gap-2">
                {checklistItems.map((item, idx) => (
                  <Link key={idx} href={item.href}>
                    <div className="group flex items-center justify-between p-2.5 rounded-xl bg-background/50 border border-border/60 hover:border-primary/40 hover:bg-secondary/40 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className={`h-4.5 w-4.5 ${item.status ? "text-emerald-500 fill-emerald-500/10" : "text-muted-foreground/30"}`} />
                        <span className={`text-xs font-semibold transition-colors ${item.status ? "text-foreground line-through decoration-muted-foreground/30 opacity-70" : "text-foreground group-hover:text-primary"}`}>
                          {item.label}
                        </span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7 border-border bg-card/40 backdrop-blur-xs shadow-xs transition-all hover:shadow-md hover:border-primary/20 duration-300 rounded-2xl flex flex-col justify-between">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Assets
            </CardTitle>
            <Link href="/dashboard/assets">
              <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary/80 font-bold text-xs p-0 px-2.5">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between gap-4">
            {assets.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {assets.slice(0, 4).map((asset) => {
                  const Icon = typeIcons[asset.type] || FileText
                  const assetNomineeIds = asset.nomineeIds || (asset.nomineeId ? [asset.nomineeId] : [])
                  const assignedNominees = nominees.filter((n) => assetNomineeIds.includes(n.id))
                  const nomineeNames = assignedNominees.map((n) => n.name).join(", ")
                  const colors = typeColors[asset.type] || "text-muted-foreground bg-muted";
                  return (
                    <div
                      key={asset.id}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/50 p-3 transition-all hover:shadow-xs hover:border-primary/30 hover:bg-secondary/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${colors}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground leading-tight">{asset.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                            {asset.type.replace("-", " ")} {nomineeNames ? `• Assigned to ${nomineeNames}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold px-2">
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
              <div className="flex h-44 items-center justify-center text-center">
                <p className="text-xs text-muted-foreground">No secure legacy assets found. Your uploads and secure credentials will show up here.</p>
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
