"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google"
import { setCurrentUserId, setLoggedIn, saveUser } from "@/lib/store"
import { secureFetch } from "@/lib/api"

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

      // Update local store for dashboard consistency
      setCurrentUserId(data.user.id)
      saveUser(data.user) // Cache the user data
      setLoggedIn(true)

      toast.success("Welcome back, " + data.user.fullName + "!")
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
        // If returning user but profile not complete, redirect to complete profile
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Login to access your secure vault
            </p>
          </div>

          {!show2FA ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground pr-10"
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
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handle2FAVerify} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="2fa-token" className="text-foreground">Two-Factor Authentication Token</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Enter the 6-digit code from your authenticator app
                </p>
                <Input
                  id="2fa-token"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value)}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground text-center text-2xl tracking-[0.5em] h-14"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Login"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setShow2FA(false)}
                className="text-muted-foreground"
              >
                Back to Login
              </Button>
            </form>
          )}

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error("Google login failed")}
              theme="outline"
              size="large"
              width="100%"
              text="continue_with"
              shape="rectangular"
            />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {"Don't have an account? "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
