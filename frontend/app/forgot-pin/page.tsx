"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Shield, ArrowLeft, Loader2, Mail, KeyRound, CheckCircle2, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { secureFetch } from "@/lib/api"
import { getUser } from "@/lib/store"

export default function ForgotPinPage() {
    const router = useRouter()
    const [step, setStep] = useState(1) // 1: Request, 2: Verify, 3: Reset, 4: Success
    const [email, setEmail] = useState("")
    const [otp, setOtp] = useState("")
    const [newPin, setNewPin] = useState("")
    const [confirmPin, setConfirmPin] = useState("")
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
                body: JSON.stringify({ email, type: "pin" }),
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
                body: JSON.stringify({ email, otp, type: "pin" }),
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

    const handleResetPin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPin || !confirmPin) {
            toast.error("Please fill in all fields")
            return
        }
        if (newPin !== confirmPin) {
            toast.error("PINs do not match")
            return
        }
        if (newPin.length < 4) {
            toast.error("PIN must be at least 4 digits")
            return
        }

        setLoading(true)
        try {
            const response = await secureFetch("/auth/reset-credential", {
                method: "POST",
                body: JSON.stringify({
                    resetToken,
                    newValue: newPin,
                    type: "pin"
                }),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to reset PIN")

            toast.success("PIN reset successfully")
            setStep(4)
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
                    href="/dashboard"
                    className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </Link>

                <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-primary/5">
                    <div className="mb-8 flex flex-col items-center">
                        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 transition-all duration-500 ${step === 4 ? "bg-emerald-500/10 text-emerald-500 scale-110" : ""}`}>
                            {step === 1 && <Mail className="h-7 w-7" />}
                            {step === 2 && <KeyRound className="h-7 w-7" />}
                            {step === 3 && <Hash className="h-7 w-7" />}
                            {step === 4 && <CheckCircle2 className="h-8 w-8" />}
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">
                            {step === 1 && "Forgot Vault PIN?"}
                            {step === 2 && "Verification"}
                            {step === 3 && "Reset PIN"}
                            {step === 4 && "All Set!"}
                        </h1>
                        <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">
                            {step === 1 && "Forgot your security PIN? No worries. We'll send an OTP to your email to reset it."}
                            {step === 2 && `We've sent a 6-digit code to ${email}. Enter it below to continue.`}
                            {step === 3 && "Secure your vault with a new PIN. Choose something memorable but hard to guess."}
                            {step === 4 && "Your security PIN has been successfully reset. You can now use it to access your assets."}
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
                                        className="bg-secondary/20 border-border pl-10 focus:ring-amber-500/20"
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} className="w-full py-6 text-base font-semibold bg-amber-500 hover:bg-amber-600 border-none">
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
                                    className="bg-secondary/20 border-border text-center text-3xl font-bold tracking-[0.5em] h-16 focus:ring-amber-500/20"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button type="submit" disabled={loading} className="w-full py-6 text-base font-semibold bg-amber-500 hover:bg-amber-600 border-none">
                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Code"}
                                </Button>
                                <button
                                    type="button"
                                    onClick={handleRequestOTP}
                                    className="text-sm text-muted-foreground hover:text-amber-500 transition-colors font-medium"
                                >
                                    Didn't receive a code? Resend
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleResetPin} className="flex flex-col gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-pin">New PIN</Label>
                                    <Input
                                        id="new-pin"
                                        type="password"
                                        placeholder="••••"
                                        maxLength={4}
                                        value={newPin}
                                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                                        className="bg-secondary/20 border-border h-14 text-center text-2xl tracking-widest focus:ring-amber-500/20"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-pin">Confirm PIN</Label>
                                    <Input
                                        id="confirm-pin"
                                        type="password"
                                        placeholder="••••"
                                        maxLength={4}
                                        value={confirmPin}
                                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                                        className="bg-secondary/20 border-border h-14 text-center text-2xl tracking-widest focus:ring-amber-500/20"
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} className="w-full py-6 text-base font-semibold bg-amber-500 hover:bg-amber-600 border-none">
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update PIN"}
                            </Button>
                        </form>
                    )}

                    {step === 4 && (
                        <div className="space-y-4">
                            <Button
                                onClick={() => router.push("/dashboard")}
                                className="w-full py-6 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 border-none"
                            >
                                Return to Dashboard
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
