"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Shield,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  User,
  KeyRound,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google"
import { generateId, saveUser, setLoggedIn, setCurrentUserId } from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { User as UserType } from "@/lib/store"

const stepIcons = [User, KeyRound, ShieldCheck]
const stepLabels = ["Basic Info", "Verify OTP", "Create PIN"]

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
  const labels = ["Weak", "Fair", "Good", "Strong"]
  const colors = ["bg-destructive", "bg-warning", "bg-primary", "bg-success"]

  if (!password) return null

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${i < strength ? colors[strength - 1] : "bg-border"
              }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {strength > 0 ? labels[strength - 1] : "Too short"}
      </span>
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Step 1 fields
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [dob, setDob] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Step 2 fields
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [otpTimer, setOtpTimer] = useState(30)

  // Step 3 fields
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

  const handleStep1 = async () => {
    if (!fullName || !phone || !email || !dob || !password || !confirmPassword) {
      toast.error("Please fill in all fields")
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Please enter a valid email")
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

    // We'll let the backend handle the existence check during the final step.
    // Local storage check is removed because it gets out of sync if users are deleted manually in Atlas.

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
    if (value.length > 1) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next
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

  const handleStep2 = async () => {
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

  const handleStep3 = async () => {
    if (pin.length < 4) {
      toast.error("PIN must be at least 4 digits")
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
          pin, // Using the Step 3 pin as the initial PIN
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
      }

      // Sync with local storage for session management
      setCurrentUserId(data.user.id)
      saveUser(data.user)
      setLoggedIn(true)

      toast.success("Account created successfully!")
      router.push("/dashboard")
    } catch (error: any) {
      toast.error(error.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8 overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-45 scale-105"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/50 to-background" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      </div>

      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl p-8 shadow-2xl shadow-primary/5">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Create Your Vault</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Secure your digital legacy in minutes
            </p>
          </div>

          {/* Google Signup */}
          <div className="mb-8 flex flex-col gap-4">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  if (!credentialResponse.credential) return
                  setLoading(true)
                  try {
                    const response = await secureFetch("/auth/google-auth", {
                      method: "POST",
                      body: JSON.stringify({ credential: credentialResponse.credential }),
                    })
                    const data = await response.json()
                    if (!response.ok) throw new Error(data.error || "Google auth failed")

                    setCurrentUserId(data.user.id)
                    saveUser(data.user)
                    setLoggedIn(true)
                    toast.success(data.source === "signup" ? "Account created!" : "Logged in successfully!")
                    router.push("/dashboard")
                  } catch (error: any) {
                    toast.error(error.message)
                  } finally {
                    setLoading(false)
                  }
                }}
                onError={() => toast.error("Google login failed")}
                theme="outline"
                size="large"
                text="signup_with"
                shape="rectangular"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground px-2">OR</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          {/* Step indicator */}
          <div className="mb-8 flex items-center justify-center gap-4">
            {stepLabels.map((label, i) => {
              const Icon = stepIcons[i]
              return (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && (
                    <div
                      className={`h-px w-8 transition-colors ${i <= step ? "bg-primary" : "bg-border"
                        }`}
                    />
                  )}
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                        ? "border-2 border-primary text-primary"
                        : "border border-border text-muted-foreground"
                      }`}
                  >
                    {i < step ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Step 1: Basic Info */}
          {step === 0 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Full Name</Label>
                <Input
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-foreground">Phone</Label>
                  <Input
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-foreground">Date of Birth</Label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="bg-input border-border text-foreground"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Email</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-input border-border text-foreground pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Rewrite your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <Button
                onClick={handleStep1}
                disabled={loading}
                className="mt-2 w-full gap-2 bg-primary text-primary-foreground py-5"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: OTP */}
          {step === 1 && (
            <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-center text-sm text-muted-foreground">
                {"We've sent a 6-digit verification code to"}{" "}
                <span className="font-medium text-foreground">{email}</span>
              </p>

              <div className="flex gap-3">
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
                    className="h-14 w-12 rounded-lg border border-border bg-input text-center text-xl font-bold text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                ))}
              </div>

              <div className="text-sm text-muted-foreground">
                {otpTimer > 0 ? (
                  <span>
                    Resend in <span className="font-medium text-primary">{otpTimer}s</span>
                  </span>
                ) : (
                  <button
                    className="text-primary hover:underline"
                    onClick={() => {
                      startOtpTimer()
                      toast.info("OTP resent!")
                    }}
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <Button
                onClick={handleStep2}
                disabled={loading}
                className="w-full gap-2 bg-primary text-primary-foreground py-5"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Verify OTP
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 3: PIN */}
          {step === 2 && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-center text-sm text-muted-foreground">
                Create a secure PIN to protect your digital assets.
                {"You'll need this PIN to view or edit sensitive data."}
              </p>

              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Create PIN (4-6 digits)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/, ""))}
                  className="bg-input border-border text-foreground text-center text-xl tracking-[0.5em]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-foreground">Confirm PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Confirm PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/, ""))}
                  className="bg-input border-border text-foreground text-center text-xl tracking-[0.5em]"
                />
              </div>

              <Button
                onClick={handleStep3}
                disabled={loading}
                className="mt-2 w-full gap-2 bg-primary text-primary-foreground py-5"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Create Account
                  </>
                )}
              </Button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
