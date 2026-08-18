"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, ArrowLeft, Loader2, Mail, KeyRound, CheckCircle2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { secureFetch } from "@/lib/api"
import { getUser } from "@/lib/store"

export default function ForgotPasswordPage() {
    const router = useRouter()
    const [step, setStep] = useState(1) // 1: Request, 2: Verify, 3: Reset, 4: Success
    const [email, setEmail] = useState("")
    const [otp, setOtp] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [resetToken, setResetToken] = useState("")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const user = getUser()
        if (user && user.email) {
            setEmail(user.email)
        }
    }, [])

    const handleRequestOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) {
            toast.error("Please enter your email")
            return
        }

        setLoading(true)
        try {
            const response = await secureFetch("/auth/forgot-request", {
                method: "POST",
                body: JSON.stringify({ email, type: "password" }),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to send OTP")

            toast.success("OTP sent to your email")
            setStep(2)
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!otp) {
            toast.error("Please enter the 6-digit OTP")
            return
        }

        setLoading(true)
        try {
            const response = await secureFetch("/auth/forgot-verify", {
                method: "POST",
                body: JSON.stringify({ email, otp, type: "password" }),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Invalid or expired OTP")

            setResetToken(data.resetToken)
            toast.success("OTP verified successfully")
            setStep(3)
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPassword || !confirmPassword) {
            toast.error("Please fill in all fields")
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }
        if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters")
            return
        }

        setLoading(true)
        try {
            const response = await secureFetch("/auth/reset-credential", {
                method: "POST",
                body: JSON.stringify({
                    resetToken,
                    newValue: newPassword,
                    type: "password"
                }),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to reset password")

            toast.success("Password reset successfully")
            setStep(4)
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center bg-background px-4 overflow-hidden">
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

            <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 py-8">
                <Link
                    href="/login"
                    className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                </Link>

                <div className="rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl p-8 shadow-2xl shadow-primary/5">
                    <div className="mb-8 flex flex-col items-center">
                        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 ${step === 4 ? "bg-emerald-500/10 text-emerald-500 scale-110" : ""}`}>
                            {step === 1 && <Mail className="h-7 w-7" />}
                            {step === 2 && <KeyRound className="h-7 w-7" />}
                            {step === 3 && <Lock className="h-7 w-7" />}
                            {step === 4 && <CheckCircle2 className="h-8 w-8" />}
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {step === 1 && "Forgot Password?"}
                            {step === 2 && "Verification"}
                            {step === 3 && "Reset Password"}
                            {step === 4 && "All Set!"}
                        </h1>
                        <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">
                            {step === 1 && "Enter your email address and we'll send you an OTP to reset your password."}
                            {step === 2 && `We've sent a 6-digit code to ${email}. Enter it below to continue.`}
                            {step === 3 && "Almost there! Create a new strong password for your secure vault."}
                            {step === 4 && "Your password has been successfully updated. You can now log in with your new credentials."}
                        </p>
                    </div>

                    {step === 1 && (
                        <form onSubmit={handleRequestOTP} className="flex flex-col gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="bg-secondary/20 border-border pl-10 focus:ring-primary/20"
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} className="w-full py-6 text-base font-semibold">
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send OTP"}
                            </Button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyOTP} className="flex flex-col gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="otp">Verification Code</Label>
                                <Input
                                    id="otp"
                                    type="text"
                                    placeholder="000 000"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                    className="bg-secondary/20 border-border text-center text-3xl font-bold tracking-[0.5em] h-16 focus:ring-primary/20"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button type="submit" disabled={loading} className="w-full py-6 text-base font-semibold">
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Code"}
                                </Button>
                                <button
                                    type="button"
                                    onClick={handleRequestOTP}
                                    className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
                                >
                                    Didn't receive a code? Resend
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleResetPassword} className="flex flex-col gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">New Password</Label>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="bg-secondary/20 border-border h-12"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirm Password</Label>
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="bg-secondary/20 border-border h-12"
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} className="w-full py-6 text-base font-semibold">
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update Password"}
                            </Button>
                        </form>
                    )}

                    {step === 4 && (
                        <div className="space-y-4">
                            <Button
                                onClick={() => router.push("/login")}
                                className="w-full py-6 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 border-none"
                            >
                                Return to Login
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
