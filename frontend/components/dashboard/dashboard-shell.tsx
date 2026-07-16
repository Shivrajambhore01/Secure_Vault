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
  Sun,
  Moon,
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
import { useTheme } from "next-themes"

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
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
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

  const planBgGlow = 
    theme === "dark"
      ? (user.plan === "premium" 
        ? "bg-[#0b0c10] before:fixed before:inset-0 before:bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.03),transparent_55%)] text-foreground" 
        : user.plan === "pro" 
          ? "bg-[#090b11] before:fixed before:inset-0 before:bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.04),transparent_55%)] text-foreground" 
          : "bg-background text-foreground")
      : "bg-zinc-50 dark:bg-background text-foreground";

  return (
    <div className={`flex min-h-screen transition-all duration-500 relative ${planBgGlow}`}>
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-52 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl transition-all duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
            user.plan === "premium" ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25" : user.plan === "pro" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25" : "bg-sidebar-primary text-sidebar-primary-foreground"
          }`}>
            <Shield className="h-4.5 w-4.5" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-sidebar-foreground">SecureVault</span>
          <button
            className="ml-auto lg:hidden text-sidebar-foreground hover:bg-secondary/40 p-1 rounded-lg"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6">
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all duration-200 ${
                    active
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-xs"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:translate-x-1"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
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
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-destructive"
          >
            <LogOut className="h-4.5 w-4.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-52">
        {/* Top navbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/60 px-4 backdrop-blur-xl sm:px-6">
          <button
            className="lg:hidden text-foreground p-1 rounded-lg hover:bg-secondary/40"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative hidden flex-1 sm:block sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets, nominees..."
              className="bg-secondary/50 border-none pl-9 text-xs h-9 rounded-xl text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary/20"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-xl hover:bg-secondary/40"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground h-9 w-9 rounded-xl hover:bg-secondary/40"
              onClick={() => toast.info("No new notifications")}
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="sr-only">Notifications</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl p-1 px-2.5 transition-colors hover:bg-secondary/40 border border-transparent hover:border-white/5 cursor-pointer">
                  <div className={`flex h-7.5 w-7.5 items-center justify-center rounded-full ${
                    user.plan === "premium" ? "bg-amber-500/10 text-amber-500" : user.plan === "pro" ? "bg-blue-500/10 text-blue-500" : "bg-primary/10 text-primary"
                  }`}>
                    <User className="h-4 w-4" />
                  </div>
                  <div className="hidden text-left sm:block">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground">{user.fullName}</p>
                      {user.plan === "premium" ? (
                        <Crown className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                      ) : user.plan === "pro" ? (
                        <Zap className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                      ) : null}
                    </div>
                  </div>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border rounded-xl shadow-lg mt-1">
                <div className="px-2 py-2">
                  <p className="text-xs font-bold text-foreground">{user.fullName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="rounded-lg">
                  <Link href="/dashboard/settings" className="text-foreground text-xs py-2 cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive text-xs py-2 rounded-lg cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}

