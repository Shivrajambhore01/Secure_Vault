"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Shield,
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
  UsersRound,
  FileSearch,
  CreditCard,
  Bell,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getAdminUser, adminIsLoggedIn, setAdminLoggedIn } from "@/lib/admin-store"
import { secureAdminFetch } from "@/lib/admin-api"
import { useTheme } from "next-themes"

interface AdminNavItem {
  href: string
  label: string
  icon: any
  role?: string | string[]
  isPayment?: boolean
}

const adminNavItems: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/verifications", label: "Verifications", icon: FileSearch, role: ["VERIFICATION_ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/security", label: "Security & Audit", icon: Shield, role: ["SECURITY_ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/support", label: "Support Desk", icon: UsersRound, role: ["SUPPORT_ADMIN", "SUPER_ADMIN"] },
  { href: "/admin/support/payments", label: "Subscription UPI", icon: CreditCard, role: ["SUPPORT_ADMIN", "SUPER_ADMIN"], isPayment: true },
  { href: "/admin/admins", label: "Admins (RBAC)", icon: Shield, role: "SUPER_ADMIN" },
  { href: "/admin/users", label: "Users Registry", icon: UsersRound, role: "SUPER_ADMIN" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, role: "SUPER_ADMIN" },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/profile", label: "Profile", icon: User },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [admin, setAdmin] = useState<any | null>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Live administrative notifications state
  const [notificationsData, setNotificationsData] = useState<{
    totalPending: number
    pendingPaymentsCount: number
    pendingVerificationsCount: number
    notifications: any[]
  }>({
    totalPending: 0,
    pendingPaymentsCount: 0,
    pendingVerificationsCount: 0,
    notifications: [],
  })

  const prevPendingCountRef = useRef<number>(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await secureAdminFetch("/notifications")
      if (res.ok) {
        const data = await res.json()
        setNotificationsData(data)

        // Show toast alert if new pending request arrived
        if (data.totalPending > prevPendingCountRef.current && prevPendingCountRef.current !== 0) {
          if (data.pendingPaymentsCount > 0) {
            toast.info("New UPI Payment Request received!", {
              description: "A user submitted payment proof for verification.",
              action: {
                label: "Review Queue",
                onClick: () => router.push("/admin/support/payments"),
              },
            })
          }
        }
        prevPendingCountRef.current = data.totalPending
      }
    } catch {
      // Background poll failure silent
    }
  }, [router])

  useEffect(() => {
    setMounted(true)
    if (!adminIsLoggedIn()) {
      router.push("/admin/login")
      return
    }
    const u = getAdminUser()
    if (u) {
      setAdmin(u)
    }

    // Initial fetch
    fetchNotifications()

    // Poll for new requests every 12 seconds
    const interval = setInterval(() => {
      fetchNotifications()
    }, 12000)

    return () => clearInterval(interval)
  }, [router, fetchNotifications])

  const handleLogout = async () => {
    try {
      await secureAdminFetch("/auth/logout", { method: "POST" })
    } catch (error) {
      console.error("Admin logout API failed:", error)
    }
    setAdminLoggedIn(false)
    toast.success("Successfully logged out from admin panel")
    router.push("/admin/login")
  }

  if (!mounted || !admin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading secure vault admin panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for Mobile */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-foreground text-sm leading-none">SecureVault</span>
              <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-widest mt-1">Admin Panel</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden hover:bg-violet-500/10 text-muted-foreground hover:text-violet-400"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 h-5" />
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
          {adminNavItems.map((item) => {
            // Check roles
            if (item.role) {
              if (Array.isArray(item.role)) {
                if (!item.role.includes(admin.role)) return null
              } else {
                if (item.role !== admin.role) return null
              }
            }
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon

            const hasPendingBadge = item.isPayment && notificationsData.pendingPaymentsCount > 0

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/15"
                    : "text-muted-foreground hover:bg-violet-500/5 hover:text-violet-400"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-white" : "text-muted-foreground group-hover:text-violet-400"}`} />
                  <span>{item.label}</span>
                </div>

                {hasPendingBadge && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 text-black px-1.5 text-[10px] font-black shadow-md animate-pulse">
                    {notificationsData.pendingPaymentsCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer Area / Quick Admin User Info */}
        <div className="border-t border-border p-4 bg-muted/40">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{admin.fullName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{admin.role.replace("_", " ")}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:bg-violet-500/10 hover:text-violet-400"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground tracking-tight hidden sm:block">
              {pathname.startsWith("/admin/support/payments") ? "Subscription & UPI Payments" :
               pathname === "/admin/dashboard" ? "Admin Console Overview" : 
               pathname === "/admin/admins" ? "Admins & RBAC Control" : 
               pathname.startsWith("/admin/security") ? "Security & Audit Control" :
               pathname.startsWith("/admin/support") ? "Customer Support Desk" :
               pathname.startsWith("/admin/verifications") ? "Death Verification Module" :
               pathname === "/admin/users" ? "Platform Users Directory" : 
               pathname === "/admin/analytics" ? "Platform-wide Analytics" : 
               pathname === "/admin/settings" ? "System Settings" : 
               pathname === "/admin/profile" ? "Your Administrative Profile" : "SecureVault Admin"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Notifications Bell Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-full text-muted-foreground hover:bg-violet-500/10 hover:text-violet-400"
                  aria-label="View Administrative Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {notificationsData.totalPending > 0 && (
                    <span className="absolute 1 top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-md animate-pulse">
                      {notificationsData.totalPending}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 sm:w-96 border-border p-0 overflow-hidden shadow-2xl bg-zinc-950">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">Action Notifications</span>
                  </div>
                  {notificationsData.totalPending > 0 ? (
                    <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px] font-black uppercase">
                      {notificationsData.totalPending} Action Required
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-white/10">
                      All Clear
                    </Badge>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                  {notificationsData.notifications.length === 0 ? (
                    <div className="py-8 text-center px-4">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">All caught up!</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        No pending payment verification or death claim requests.
                      </p>
                    </div>
                  ) : (
                    notificationsData.notifications.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        asChild
                        className="p-3.5 focus:bg-white/5 cursor-pointer"
                      >
                        <Link href={item.link} className="flex items-start gap-3 w-full">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            item.type === "PAYMENT_REQUEST"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {item.type === "PAYMENT_REQUEST" ? (
                              <CreditCard className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="text-xs font-bold text-foreground truncate">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {item.description}
                            </p>
                            <p className="text-[10px] text-muted-foreground/80 font-mono">
                              {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                            </p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 self-center" />
                        </Link>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>

                {notificationsData.totalPending > 0 && (
                  <div className="p-2 border-t border-white/10 bg-white/[0.01] text-center">
                    <Link
                      href="/admin/support/payments"
                      className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Open Full Payment Queue <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme switcher */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:bg-violet-500/10 hover:text-violet-400"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative flex items-center gap-2 rounded-xl px-2.5 py-1.5 hover:bg-violet-500/5 text-muted-foreground hover:text-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white font-semibold text-xs shadow-md shadow-violet-600/15">
                    {admin.fullName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium hidden md:inline-block max-w-[100px] truncate">
                    {admin.fullName.split(" ")[0]}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-1 border-border">
                <div className="flex flex-col p-2.5">
                  <p className="text-xs font-semibold text-foreground">{admin.fullName}</p>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{admin.email}</p>
                  <span className="inline-flex self-start items-center rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400 ring-1 ring-inset ring-violet-500/20 mt-2">
                    {admin.role.replace("_", " ")}
                  </span>
                </div>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem asChild>
                  <Link href="/admin/profile" className="cursor-pointer focus:bg-violet-500/5 focus:text-violet-400">
                    <User className="mr-2 h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" className="cursor-pointer focus:bg-violet-500/5 focus:text-violet-400">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout Console
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
