"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
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
  Lock,
  KeyRound,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  getUser,
  isLoggedIn,
  setLoggedIn,
  isPinVerifiedSession,
  setPinVerifiedSession,
  clearPinVerifiedSession,
} from "@/lib/store"
import { secureFetch } from "@/lib/api"
import { PinModal } from "@/components/dashboard/pin-modal"

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/assets", label: "Assets" },
  { href: "/dashboard/assets/add", label: "Add Asset" },
  { href: "/dashboard/nominees", label: "Nominees" },
  { href: "/dashboard/pricing", label: "Wallets & Plans" },
  { href: "/dashboard/settings", label: "Settings" },
]

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<any | null>(null)
  const [pinVerified, setPinVerified] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)

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
    setPinVerified(isPinVerifiedSession())
  }, [router])

  const handleLogout = async () => {
    try {
      await secureFetch("/auth/logout", { method: "POST" })
    } catch (error) {
      console.error("Logout API failed:", error)
    }
    setLoggedIn(false)
    clearPinVerifiedSession()
    toast.success("Logged out successfully")
    router.push("/")
  }

  if (!user) return null

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#111111] text-white font-tt-norms font-sans select-none flex p-2 sm:p-3 lg:p-4 gap-2.5 sm:gap-3.5">
      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Fixed-Position Compact Dark Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#111111] px-5 py-6 transition-all duration-300 lg:static lg:h-full lg:w-56 xl:w-60 shrink-0 justify-between overflow-y-auto ${
          sidebarOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="space-y-8">
          {/* User Profile Header */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-3">
              <div className="relative w-12 h-12">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700/80 overflow-hidden flex items-center justify-center text-white text-base font-bold shadow-md">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}</span>
                  )}
                </div>
                {/* Red notification pill indicator */}
                <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white shadow-md border-2 border-[#111111]">
                  4
                </span>
              </div>

              <div>
                <h2 className="text-base font-bold tracking-tight text-white line-clamp-1">
                  {user.fullName || "User Account"}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-[180px]">
                  {user.email || "user@securevault.com"}
                </p>
              </div>
            </div>

            <button
              className="lg:hidden text-neutral-400 hover:text-white p-1 rounded-full"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links - Increased Size, More Space & Smooth Hover Effects */}
          <nav className="space-y-3.5 pt-2">
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center justify-between py-2 px-3 rounded-2xl transition-all duration-200 ease-out cursor-pointer ${
                    active
                      ? "bg-white/[0.08] text-white font-bold text-base sm:text-[17px] tracking-tight translate-x-1"
                      : "text-neutral-400 hover:text-white font-semibold text-sm sm:text-[15px] hover:translate-x-2 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="transition-all duration-200 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                    {item.label}
                  </span>
                  
                  {/* Subtle active/hover bullet indicator */}
                  {active ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs shadow-white" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Enclave & PIN Lock Status & Logout */}
        <div className="space-y-3.5 pt-5 border-t border-neutral-800/80">
          {/* PIN Verification Quick Toggle in Sidebar */}
          <button
            onClick={() => {
              if (pinVerified) {
                clearPinVerifiedSession()
                setPinVerified(false)
                toast.info("Vault locked. PIN verification required.")
              } else {
                setShowPinModal(true)
              }
            }}
            className="flex items-center justify-between w-full py-1.5 px-2 rounded-xl text-xs text-neutral-400 hover:text-white hover:bg-white/[0.04] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              {pinVerified ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-xs font-semibold">{pinVerified ? "PIN Active" : "Verify PIN"}</span>
            </span>
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold ${
                pinVerified ? "bg-emerald-950/90 text-emerald-300 border border-emerald-800/50" : "bg-neutral-800 text-neutral-300"
              }`}
            >
              {pinVerified ? "Unlocked" : "Locked"}
            </span>
          </button>

          <div className="flex items-center justify-between text-xs text-neutral-400 px-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-neutral-300">Enclave Active</span>
            </div>
            <span className="text-[9px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full">
              FIPS-203
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-red-400 transition-colors py-1 px-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Floating White Island - Fixed Height Viewport with its own Scroll Container */}
      <div className="h-full flex-1 bg-white text-black rounded-[24px] sm:rounded-[32px] lg:rounded-[36px] shadow-2xl overflow-hidden min-w-0 flex flex-col border border-white/5 relative">
        {/* Subtle Top Island Header with Search & PIN Status */}
        <header className="flex h-14 shrink-0 items-center justify-between px-5 sm:px-7 border-b border-black/5 bg-white/95 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-neutral-700 p-1.5 rounded-full hover:bg-neutral-100 transition cursor-pointer"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Subtle Search Pill */}
            <div className="relative hidden sm:block w-64 md:w-72">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                placeholder="Search encrypted vault..."
                className="bg-neutral-50 border-transparent hover:bg-neutral-100 focus:bg-white focus:border-black/20 pl-8 text-xs h-8 rounded-full text-black placeholder:text-neutral-400 shadow-2xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* PIN Verification Header Action */}
            {pinVerified ? (
              <button
                onClick={() => {
                  clearPinVerifiedSession()
                  setPinVerified(false)
                  toast.info("Vault locked. PIN verification required.")
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer shadow-2xs"
                title="Click to lock vault session"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>PIN Verified</span>
              </button>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black text-white hover:bg-neutral-800 text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-[0.98]"
                title="Verify your 4-digit PIN to access private telemetry"
              >
                <KeyRound className="w-3 h-3" />
                <span>Verify PIN</span>
              </button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="relative text-neutral-600 hover:text-black h-8 w-8 rounded-full hover:bg-neutral-100 cursor-pointer"
              onClick={() => toast.info("All cryptographic protections active.")}
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </Button>

            <Link href="/dashboard/settings">
              <div className="w-7 h-7 rounded-full bg-neutral-100 border border-black/8 flex items-center justify-center text-xs font-bold text-black hover:bg-neutral-200 transition shadow-2xs cursor-pointer">
                {user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
              </div>
            </Link>
          </div>
        </header>

        {/* Island Content Viewport - Only this area scrolls! Sidebar stays fixed! */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-7 lg:p-8">
          {children}
        </main>
      </div>

      {/* Global PIN Verification Modal */}
      <PinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setPinVerifiedSession()
          setPinVerified(true)
          setShowPinModal(false)
          toast.success("Security PIN verified. Vault unlocked.")
        }}
      />
    </div>
  )
}
