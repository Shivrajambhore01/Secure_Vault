"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Shield,
  LayoutDashboard,
  FolderKey,
  PlusCircle,
  Users,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  User,
  Crown,
  Sparkles,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { getUser, isLoggedIn, setLoggedIn } from "@/lib/store"
import { secureFetch } from "@/lib/api"

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/assets", label: "Digital Assets", icon: FolderKey },
  { href: "/dashboard/assets/add", label: "Add Asset", icon: PlusCircle },
  { href: "/dashboard/nominees", label: "Nominees", icon: Users },
  { href: "/dashboard/pricing", label: "Upgrade Plan", icon: Crown },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<any | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login")
      return
    }
    const u = getUser()
    if (u) {
      setUser(u)
      if (!u.isVerified) {
        router.push("/verify-email")
      } else if (u.isProfileComplete === false) {
        router.push("/complete-profile")
      }
    }
  }, [router])

  const handleLogout = async () => {
    try {
      await secureFetch("/auth/logout", { method: "POST" })
    } catch (error) {
      console.error("Logout API failed:", error)
    }
    setLoggedIn(false)
    toast.success("Logged out successfully")
    router.push("/")
  }

  if (!user) return null

  const themeClasses =
    user.plan === "premium" ? "bg-[#0d1520] text-foreground" :
      user.plan === "pro" ? "bg-gradient-to-br from-background via-blue-950/20 to-background text-foreground" :
        "bg-background text-foreground";

  const glowEffect = user.plan === "premium" ? "before:fixed before:inset-0 before:bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.05),transparent_50%)]" : "";

  return (
    <div className={`flex min-h-screen transition-all duration-500 ${themeClasses} ${glowEffect}`}>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Shield className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-sidebar-foreground">SecureVault</span>
          <button
            className="ml-auto lg:hidden text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Logout */}
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top navbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            className="lg:hidden text-foreground"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden flex-1 sm:block sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets, nominees..."
              className="bg-secondary border-none pl-9 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">

            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
              onClick={() => toast.info("No new notifications")}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
              <span className="sr-only">Notifications</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-secondary">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="hidden text-left sm:block">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground">{user.fullName}</p>
                      {user.plan === "premium" ? (
                        <Crown className="h-3.5 w-3.5 text-amber-500" />
                      ) : user.plan === "pro" ? (
                        <Zap className="h-3.5 w-3.5 text-blue-500" />
                      ) : null}
                    </div>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-foreground">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="text-foreground">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
