"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Shield,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Check,
  User,
  KeyRound,
  ShieldCheck,
  Lock,
  Mail,
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

function PasswordStrength({ password }: { password: string }) {
  const getStrength = () => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }
  const strength = getStrength()
  const labels = ["Weak", "Fair", "Good", "Military Grade"]
  const colors = ["bg-red-500", "bg-amber-500", "bg-blue-600", "bg-emerald-600"]

  if (!password) return null

  return (
    <div className="mt-1 flex flex-col gap-1">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < strength ? colors[strength - 1] : "bg-neutral-200"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-neutral-400">Security</span>
        <span
          className={`font-semibold ${
            strength === 4
              ? "text-emerald-600"
              : strength === 3
              ? "text-blue-600"
              : strength === 2
              ? "text-amber-600"
              : "text-red-500"
          }`}
        >
          {strength > 0 ? labels[strength - 1] : "Too short"}
        </span>
      </div>
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Step 0 fields (Account Info)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [dob, setDob] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Step 1 fields (OTP)
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [otpTimer, setOtpTimer] = useState(30)

  // Step 2 fields (Master PIN)
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")

  const startOtpTimer = useCallback(() => {
    setOtpTimer(30)
    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleStep1 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!fullName || !phone || !email || !dob || !password || !confirmPassword) {
      toast.error("Please fill in all fields")
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Please enter a valid email address")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      const response = await secureFetch("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to send OTP")

      setStep(1)
      startOtpTimer()
      toast.success(data.devMode ? `OTP sent! (check backend logs)` : "OTP sent to your email!")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("")
      if (digits.length > 0) {
        const newOtp = [...otp]
        digits.forEach((d, idx) => {
          if (idx < 6) newOtp[idx] = d
        })
        setOtp(newOtp)
        const nextIdx = Math.min(digits.length, 5)
        document.getElementById(`otp-${nextIdx}`)?.focus()
      }
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`)
      next?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`)
      prev?.focus()
    }
  }

  const handleStep2 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const otpValue = otp.join("")
    if (otpValue.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP")
      return
    }

    setLoading(true)
    try {
      const response = await secureFetch("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp: otpValue }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Verification failed")

      setStep(2)
      toast.success("OTP verified successfully!")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStep3 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (pin.length !== 4) {
      toast.error("PIN must be exactly 4 digits")
      return
    }
    if (pin !== confirmPin) {
      toast.error("PINs do not match")
      return
    }

    setLoading(true)

    try {
      const response = await secureFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          email,
          password,
          pin,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
      }

      setCurrentUserId(data.user.id)
      saveUser(data.user)
      setLoggedIn(true)

      toast.success("Vault initialized! Welcome, " + (data.user.fullName || "User") + "!")
      router.push("/dashboard")
    } catch (error: any) {
      toast.error(error.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return
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
      toast.success(data.source === "signup" ? "Account created! Please complete your profile." : "Logged in successfully!")
      
      if (data.source === "signup" || data.user.isProfileComplete === false) {
        router.push("/complete-profile")
      } else {
        router.push("/dashboard")
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
      <section className="relative w-full lg:w-[46%] h-auto lg:h-full p-6 sm:p-8 lg:p-10 flex flex-col justify-between items-center text-center overflow-hidden bg-black">
        {/* Subtle Ambient Radial Glow */}
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
            Create your vault
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
        className="light-auth-card w-full lg:w-[54%] h-full bg-white text-black lg:rounded-l-[38px] p-6 sm:p-8 lg:p-10 flex flex-col justify-between shadow-2xl relative z-20 overflow-y-auto lg:overflow-hidden"
      >
        {/* Top Bar: Brand Logo & Sign In link */}
        <div className="flex items-center justify-between pb-2">
          <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-85">
            <LogoIcon className="w-6 h-6 text-black" />
            <span className="text-xl font-bold tracking-tight text-black">
              SecureVault
            </span>
          </Link>

          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black transition"
          >
            <User className="w-3.5 h-3.5 text-neutral-500" />
            <span>Sign In</span>
          </Link>
        </div>

        {/* Form Center Content */}
        <div className="my-auto max-w-[420px] w-full mx-auto py-1">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-black text-left">
              {step === 0 && "Sign Up"}
              {step === 1 && "Verify Email"}
              {step === 2 && "Master PIN"}
            </h2>
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Step {step + 1} of 3
            </span>
          </div>

          {/* Progress Bar in Landing Page Monochrome Style */}
          <div className="flex gap-1.5 mb-3.5">
            {[0, 1, 2].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  s <= step ? "bg-black" : "bg-neutral-200"
                }`}
              />
            ))}
          </div>

          {/* STEP 0: Account Details */}
          {step === 0 && (
            <div className="space-y-2.5">
              <form onSubmit={handleStep1} className="space-y-2.5">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{ colorScheme: "light" }}
                    className="w-full h-10 rounded-full border border-black/15 bg-white px-4 text-xs sm:text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="tel"
                      required
                      placeholder="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={{ colorScheme: "light" }}
                      className="w-full h-10 rounded-full border border-black/15 bg-white px-4 text-xs sm:text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      style={{ colorScheme: "light" }}
                      className="w-full h-10 rounded-full border border-black/15 bg-white px-4 text-xs sm:text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <input
                    type="email"
                    required
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ colorScheme: "light" }}
                    className="w-full h-10 rounded-full border border-black/15 bg-white px-4 text-xs sm:text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                  />
                </div>

                <div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Password (min 8 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ colorScheme: "light" }}
                      className="w-full h-10 rounded-full border border-black/15 bg-white px-4 pr-11 text-xs sm:text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                    />
                    <button
                      type="button"
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <div>
                  <input
                    type="password"
                    required
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ colorScheme: "light" }}
                    className="w-full h-10 rounded-full border border-black/15 bg-white px-4 text-xs sm:text-sm text-black placeholder:text-neutral-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                  />
                </div>

                {/* Landing Page Solid Black Pill Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full h-11 rounded-full bg-black hover:bg-neutral-800 text-white font-medium text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 mt-1"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <span>Continue</span>
                      <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                        <ArrowRight className="w-2.5 h-2.5 text-white" />
                      </span>
                    </>
                  )}
                </button>
              </form>

              {/* Google signup */}
              <div className="relative my-2.5 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-black/10"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2.5 text-neutral-400 font-medium tracking-wider">
                    Or sign up with
                  </span>
                </div>
              </div>

              <div className="w-full flex justify-center scale-90 -my-1">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error("Google signup failed")}
                  theme="outline"
                  size="large"
                  text="signup_with"
                  shape="pill"
                  width="360"
                />
              </div>
            </div>
          )}

          {/* STEP 1: OTP Verification */}
          {step === 1 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="bg-[#FAFAFA] rounded-xl p-3 text-center border border-black/5">
                <p className="text-xs text-neutral-500">
                  Verification code dispatched to:
                </p>
                <p className="text-xs sm:text-sm font-semibold text-black mt-0.5">{email}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-2.5 text-center">
                  6-Digit Verification Code
                </label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value.replace(/\D/, ""))}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      style={{ colorScheme: "light" }}
                      className="w-10 sm:w-11 h-12 rounded-xl border border-black/15 bg-white text-center text-lg font-bold text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                    />
                  ))}
                </div>
              </div>

              <div className="text-center text-xs text-neutral-500">
                {otpTimer > 0 ? (
                  <span>
                    Resend code in{" "}
                    <span className="font-semibold text-black">{otpTimer}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      startOtpTimer()
                      toast.info("A new OTP code has been sent!")
                    }}
                    className="font-semibold text-black underline hover:opacity-80 transition cursor-pointer"
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full h-11 rounded-full bg-black hover:bg-neutral-800 text-white font-medium text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.99]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Verify Code &amp; Continue</span>
                    <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                      <ArrowRight className="w-2.5 h-2.5 text-white" />
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(0)}
                className="w-full text-center text-xs font-semibold text-neutral-500 hover:text-black py-1 transition"
              >
                Back to step 1
              </button>
            </form>
          )}

          {/* STEP 2: Master PIN */}
          {step === 2 && (
            <form onSubmit={handleStep3} className="space-y-4">
              <div className="bg-neutral-50 rounded-xl p-3 text-center border border-black/10">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Establish your 4-digit master PIN. You will need this PIN to view sensitive vault assets and authorize emergency releases.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5 text-center">
                  Set 4-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/, ""))}
                  style={{ colorScheme: "light" }}
                  className="w-full h-11 rounded-full border border-black/15 bg-white text-center text-2xl font-bold tracking-[0.5em] text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1.5 text-center">
                  Confirm 4-Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/, ""))}
                  style={{ colorScheme: "light" }}
                  className="w-full h-11 rounded-full border border-black/15 bg-white text-center text-2xl font-bold tracking-[0.5em] text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10 transition shadow-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full h-11 rounded-full bg-black hover:bg-neutral-800 text-white font-medium text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-[0.99]"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>Create Vault</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-xs font-semibold text-neutral-500 hover:text-black py-1 transition"
              >
                Back to OTP verification
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t border-black/5 text-[11px] text-neutral-400">
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




