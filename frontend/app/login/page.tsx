"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Shield,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Lock,
  User,
} from "lucide-react"
import { toast } from "sonner"
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google"
import { setCurrentUserId, setLoggedIn, saveUser } from "@/lib/store"
import { secureFetch } from "@/lib/api"

/**
 * Geometric enclave mark from Landing Page
 */
function LogoIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M 128.005 191.173 C 128.448 156.208 156.93 128 192 128 L 192 64 L 128 64 C 128 99.346 99.346 128 64 128 L 64 192 L 128 192 Z M 192 256 L 64 256 C 28.654 256 0 227.346 0 192 L 0 64 L 64 64 L 64 0 L 192 0 C 227.346 0 256 28.654 256 64 L 256 192 L 192 192 Z" />
    </svg>
  )
}

/**
 * Cinematic Vault Video Showcase centered with real-time enclave telemetry
 */
function VaultVideoShowcase() {
  return (
    <div className="relative w-full max-w-[420px] xl:max-w-[460px] rounded-2xl bg-[#0F0F0F]/90 backdrop-blur-2xl p-3 border border-white/15 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] select-none mx-auto text-left">
      {/* Top Window Bar */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <span className="text-[10px] font-mono tracking-wider text-neutral-400 uppercase ml-1">
            Enclave Telemetry Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[9px] font-mono text-emerald-400 font-semibold tracking-wide">
            LIVE SECURE
          </span>
        </div>
      </div>

      {/* Video Screen */}
      <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-black border border-white/10 shadow-inner group">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-700 opacity-90"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4" type="video/mp4" />
        </video>

        {/* Cinematic Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

        {/* Floating Top Left Overlay: Asset Total */}
        <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <div>
            <div className="text-[8px] uppercase tracking-wider text-neutral-400">Secured Assets</div>
            <div className="text-xs font-bold font-mono text-white tracking-tight">$1,420,000.00</div>
          </div>
        </div>

        {/* Floating Top Right Overlay: TEE Node */}
        <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-white/15 text-right">
          <div className="text-[8px] uppercase tracking-wider text-neutral-400">Node Spec</div>
          <div className="text-[10px] font-mono font-medium text-emerald-400">FIPS-203 Ready</div>
        </div>

        {/* Floating Bottom Directives */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
          <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 flex items-center gap-1.5 text-[9px] text-neutral-300">
            <span className="text-emerald-400 font-bold">3/5</span>
            <span>Shamir Shards</span>
          </div>
          <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 flex items-center gap-1.5 text-[9px] text-neutral-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Switch: Armed (28d)</span>
          </div>
        </div>
      </div>

      {/* Bottom Partition Metrics */}
      <div className="grid grid-cols-3 gap-2 mt-2.5 pt-1">
        <div className="bg-[#181818] rounded-lg p-2 border border-white/5 text-center">
          <div className="text-[8px] text-neutral-400 uppercase tracking-wider">Encryption</div>
          <div className="text-[11px] font-semibold text-white font-mono mt-0.5">AES-256-GCM</div>
        </div>
        <div className="bg-[#181818] rounded-lg p-2 border border-white/5 text-center">
          <div className="text-[8px] text-neutral-400 uppercase tracking-wider">Architecture</div>
          <div className="text-[11px] font-semibold text-emerald-400 font-mono mt-0.5">TEE Enclave</div>
        </div>
        <div className="bg-[#181818] rounded-lg p-2 border border-white/5 text-center">
          <div className="text-[8px] text-neutral-400 uppercase tracking-wider">Access</div>
          <div className="text-[11px] font-semibold text-white font-mono mt-0.5">Zero-Knowledge</div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [show2FA, setShow2FA] = useState(false)
  const [twoFactorToken, setTwoFactorToken] = useState("")
  const [tempUserId, setTempUserId] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Please fill in all fields")
      return
    }

    setLoading(true)

    try {
      const response = await secureFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      if (data.twoFactorRequired) {
        setShow2FA(true)
        setTempUserId(data.userId)
        toast.info("Two-Factor Authentication required")
        return
      }

      setCurrentUserId(data.user.id)
      saveUser(data.user)
      setLoggedIn(true)

      toast.success("Welcome back, " + (data.user.fullName || "User") + "!")
      router.push("/dashboard")
    } catch (error: any) {
      toast.error(error.message || "Invalid credentials")
    } finally {
      setLoading(false)
    }
  }

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!twoFactorToken) {
      toast.error("Please enter the 2FA token")
      return
    }

    setLoading(true)
    try {
      const response = await secureFetch("/auth/2fa/login-verify", {
        method: "POST",
        body: JSON.stringify({ userId: tempUserId, token: twoFactorToken }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Invalid 2FA token")

      setCurrentUserId(data.user.id)
      saveUser(data.user)
      setLoggedIn(true)

      toast.success("Login successful!")
      router.push("/dashboard")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      toast.error("Google login failed")
      return
    }

    setLoading(true)
    try {
      const response = await secureFetch("/auth/google-auth", {
        method: "POST",
        body: JSON.stringify({ credential: credentialResponse.credential }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Google authentication failed")

      setCurrentUserId(data.user.id)
      saveUser(data.user)
      setLoggedIn(true)

      if (data.source === "signup") {
        toast.success("Account created! Please complete your profile.")
        router.push("/complete-profile")
      } else {
        toast.success("Welcome back!")
        if (data.user.isProfileComplete === false) {
          router.push("/complete-profile")
        } else {
          router.push("/dashboard")
        }
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-full bg-[#0D0D0D] text-white flex flex-col lg:flex-row overflow-hidden font-tt-norms font-sans select-none">
      {/* LEFT SHOWCASE PANEL (Centered Cinematic Video & Enclave Telemetry) */}
      <section className="relative w-full lg:w-[48%] h-auto lg:h-full p-6 sm:p-8 lg:p-10 flex flex-col justify-between items-center text-center overflow-hidden bg-black">
        {/* Subtle Ambient Radial Glow & Background Video */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px]" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-white/5 rounded-full blur-[100px]" />
        </div>

        {/* Top Tagline & Enclave Pill - Centered */}
        <div className="relative z-10 w-full flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-neutral-300 backdrop-blur-md mb-2">
            <LogoIcon className="w-3.5 h-3.5 text-white" />
            <span className="font-mono uppercase tracking-wider text-[10px] text-neutral-300">
              Zero-Knowledge Hardware Enclave
            </span>
          </div>
          <p className="text-xs text-neutral-400 tracking-tight max-w-sm">
            Digital inheritance made simple — zero-knowledge cryptographic vault.
          </p>
        </div>

        {/* Center Hero Title & Video Showcase - Centered in Middle */}
        <div className="relative z-10 my-auto py-2 flex flex-col items-center justify-center text-center w-full mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4 leading-tight">
            Manage your legacy
          </h1>

          <div className="w-full flex justify-center transform hover:scale-[1.01] transition-transform duration-300">
            <VaultVideoShowcase />
          </div>
        </div>

        {/* Bottom Security Highlights - Centered */}
        <div className="relative z-10 flex items-center justify-center gap-4 sm:gap-6 pt-3 border-t border-white/10 text-[11px] text-neutral-400 w-full max-w-md">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-neutral-300" />
            <span>AES-256-GCM</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-300" />
            <span>Post-Quantum Ready</span>
          </div>
          <span>•</span>
          <span>Zero-Knowledge TEE</span>
        </div>
      </section>

      {/* RIGHT AUTH CARD (White Card with Landing Page Button & Inputs) */}
      <section
        style={{ colorScheme: "light" }}
        className="light-auth-card w-full lg:w-[52%] h-full bg-white text-black lg:rounded-l-[38px] p-6 sm:p-10 lg:p-12 flex flex-col justify-between shadow-2xl relative z-20 overflow-y-auto lg:overflow-hidden"
      >
        {/* Top Bar: Brand Logo & Sign Up link */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-85">
            <LogoIcon className="w-6 h-6 text-black" />
            <span className="text-xl font-bold tracking-tight text-black">
              SecureVault
            </span>
          </Link>

          <Link
            href="/signup"
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black transition"
          >
            <User className="w-3.5 h-3.5 text-neutral-500" />
            <span>Sign Up</span>
          </Link>
        </div>

        {/* Form Center Content */}
        <div className="my-auto max-w-[390px] w-full mx-auto py-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-black mb-5 text-left">
            {show2FA ? "Two-Factor Auth" : "Sign In"}
          </h2>

          {!show2FA ? (
            <form onSubmit={handleLogin} className="space-y-3.5">
              {/* Email Input */}
              <div>
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ colorScheme: "light" }}
                  className="w-full h-12 rounded-full border border-black/15 bg-white px-5 text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ colorScheme: "light" }}
                  className="w-full h-12 rounded-full border border-black/15 bg-white px-5 pr-12 text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Forgot password link */}
              <div className="text-left pt-0.5">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-neutral-600 hover:text-black underline underline-offset-2"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Landing Page Solid Black Pill Button with Arrow Icon */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full h-12 rounded-full bg-black hover:bg-neutral-800 text-white font-medium text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                      <ArrowRight className="w-3 h-3 text-white" />
                    </span>
                  </>
                )}
              </button>

              {/* Divider & Google Login */}
              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-black/10"></div>
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-white px-3 text-neutral-400 font-medium tracking-wider">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="w-full flex justify-center scale-95">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error("Google login failed")}
                  theme="outline"
                  size="large"
                  text="continue_with"
                  shape="pill"
                  width="360"
                />
              </div>
            </form>
          ) : (
            /* 2FA Form */
            <form onSubmit={handle2FAVerify} className="space-y-4">
              <p className="text-xs text-neutral-500">
                Enter the 6-digit TOTP code from your authenticator app.
              </p>

              <div>
                <input
                  type="text"
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, ""))}
                  style={{ colorScheme: "light" }}
                  className="w-full h-12 rounded-full border border-black/15 bg-white text-center text-xl font-bold tracking-[0.4em] text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full h-12 rounded-full bg-black hover:bg-neutral-800 text-white font-medium text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.99]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-white" />
                    <span>Verify &amp; Unlock</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShow2FA(false)}
                className="w-full text-center text-xs font-semibold text-neutral-500 hover:text-black py-1 transition"
              >
                Back to standard sign in
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-3 border-t border-black/5 text-[11px] text-neutral-400">
          <div>© 2026 SecureVault Inc.</div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-black transition">
              Home
            </Link>
            <span className="text-neutral-300">•</span>
            <span>Zero-Knowledge Architecture</span>
          </div>
        </div>
      </section>
    </div>
  )
}




