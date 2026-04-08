"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Shield, Mail, Key, Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function NomineeVerifyPage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [loading, setLoading] = useState(true)
    const [verifying, setVerifying] = useState(false)
    const [nominee, setNominee] = useState<{ name: string; maskedEmail: string; email: string } | null>(null)
    const [otpSent, setOtpSent] = useState(false)
    const [otp, setOtp] = useState("")

    useEffect(() => {
        const fetchNominee = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/nominees/verify/${token}`)
                const data = await response.json()
                if (response.ok) {
                    setNominee(data)
                } else {
                    toast.error(data.error || "Invalid access link")
                    router.push("/")
                }
            } catch (error) {
                toast.error("Failed to verify access link")
            } finally {
                setLoading(false)
            }
        }
        fetchNominee()
    }, [token, router])

    const handleGetOtp = async () => {
        if (!nominee) return
        setVerifying(true)
        try {
            const response = await fetch("http://localhost:5000/api/nominees/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, email: nominee.email })
            })
            if (response.ok) {
                setOtpSent(true)
                toast.success("Verification code sent to your email")
            } else {
                const data = await response.json()
                toast.error(data.error || "Failed to send OTP")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setVerifying(false)
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!otp || !nominee) return

        setVerifying(true)
        try {
            const response = await fetch("http://localhost:5000/api/nominees/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, email: nominee.email, otp })
            })

            const data = await response.json()
            if (response.ok) {
                toast.success("Verification successful")
                // Store session token in sessionStorage for the vault page
                sessionStorage.setItem(`sv_nominee_token_${token}`, data.sessionToken)
                router.push(`/nominee/vault/${token}`)
            } else {
                toast.error(data.error || "Invalid OTP")
            }
        } catch (error) {
            toast.error("Verification failed")
        } finally {
            setVerifying(false)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!nominee) return null

    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px]" />
            </div>

            <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
                    <div className="mb-8 flex flex-col items-center text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Shield className="h-7 w-7" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Secure Access Portal</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Hello {nominee.name}. Please verify your identity to access the assigned digital assets.
                        </p>
                    </div>

                    {!otpSent ? (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-center">
                                <p className="text-sm font-medium text-foreground">Registered Email</p>
                                <p className="mt-1 font-mono text-primary">{nominee.maskedEmail}</p>
                            </div>

                            <Button
                                onClick={handleGetOtp}
                                disabled={verifying}
                                className="w-full gap-2 py-6 text-lg font-semibold"
                            >
                                {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                    <>
                                        Get Verification Code <Mail className="h-5 w-5" />
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="otp">Enter 6-digit Code</Label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="otp"
                                        placeholder="000000"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="bg-input py-6 pl-10 text-center text-2xl font-bold tracking-[0.5em]"
                                        maxLength={6}
                                        required
                                    />
                                </div>
                                <p className="text-center text-xs text-muted-foreground">
                                    Check your email for the verification code.
                                </p>
                            </div>

                            <Button
                                type="submit"
                                disabled={verifying}
                                className="w-full gap-2 py-6 text-lg font-semibold"
                            >
                                {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                    <>
                                        Verify & Access Vault <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </Button>

                            <button
                                type="button"
                                onClick={() => setOtpSent(false)}
                                className="w-full text-center text-sm text-primary hover:underline"
                            >
                                Resend Code
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    )
}
