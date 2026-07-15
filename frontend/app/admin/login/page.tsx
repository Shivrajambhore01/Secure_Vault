"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Shield, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { setAdminLoggedIn, setAdminUser, adminIsLoggedIn } from "@/lib/admin-store"
import { secureAdminFetch } from "@/lib/admin-api"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (adminIsLoggedIn()) {
      router.push("/admin/dashboard")
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Please enter email and password")
      return
    }

    setLoading(true)
    try {
      const response = await secureAdminFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      setAdminUser(data.admin)
      setAdminLoggedIn(true)

      toast.success(`Welcome back, Admin ${data.admin.fullName}!`)
      router.push("/admin/dashboard")
    } catch (error: any) {
      toast.error(error.message || "Invalid administrative credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#070b11] overflow-hidden px-4">
      {/* Decorative background grid and neon lights */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Back to website button */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-violet-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Portal
        </Link>

        {/* Form Card */}
        <div className="border border-border bg-card/60 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
          {/* Top colored strip */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600" />
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-4 shadow-lg shadow-violet-500/10">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Console Access</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              Secure administrative login for platform controllers
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@securevault.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="bg-background/40 focus:border-violet-500 focus:ring-violet-500/20"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Security Password</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10 bg-background/40 focus:border-violet-500 focus:ring-violet-500/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-violet-500/25 py-5 rounded-xl transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Decrypting credentials...
                </>
              ) : (
                "Authorize Console Access"
              )}
            </Button>
          </form>
        </div>

        {/* Small warning notice */}
        <p className="text-center text-[10px] text-muted-foreground mt-6 leading-relaxed max-w-sm mx-auto">
          Authorized administrative access only. All sessions, actions, and downloads are fully audited. Unauthorized access attempts will be blocked and recorded.
        </p>
      </div>
    </div>
  )
}
