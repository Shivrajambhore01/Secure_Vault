"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, RefreshCw, LogOut, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { getUser, setLoggedIn, isLoggedIn } from "@/lib/store"
import { secureFetch } from "@/lib/api"

export default function VerifyEmailPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [user, setUser] = useState(getUser())

    useEffect(() => {
        if (!isLoggedIn()) {
            router.push("/login")
            return
        }

        // If already verified, go to dashboard
        if (user?.isVerified) {
            router.push("/dashboard")
        }
    }, [user, router])

    const handleResendToken = async () => {
        setLoading(true)
        try {
            const response = await secureFetch("/auth/resend-verification", {
                method: "POST"
            })

            if (response.ok) {
                toast.success("Verification email resent!", {
                    description: "Please check your inbox and spam folder."
                })
            } else {
                const error = await response.json()
                toast.error(error.error || "Failed to resend email")
            }
        } catch (error) {
            toast.error("An error occurred. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        try {
            await secureFetch("/auth/logout", { method: "POST" })
            setLoggedIn(false)
            router.push("/login")
        } catch (error) {
            setLoggedIn(false)
            router.push("/login")
        }
    }

    if (!user || user.isVerified) return null

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                        <Mail className="h-10 w-10 text-primary animate-pulse" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Verify your email</CardTitle>
                    <CardDescription className="text-muted-foreground mt-2">
                        We've sent a verification link to <span className="font-semibold text-foreground">{user.email}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Please click the link in the email to activate your account and gain full access to your digital vault.
                    </p>
                    <div className="rounded-lg bg-secondary/30 p-4 text-xs text-left border border-border/50">
                        <h4 className="font-bold mb-2 flex items-center gap-2">
                            <AlertCircle className="h-3 w-3" /> Didn't receive the email?
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li>Check your spam or junk folder</li>
                            <li>Wait a few minutes for it to arrive</li>
                            <li>Ensure the email address is correct</li>
                        </ul>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button
                        className="w-full h-11 font-bold gap-2 transition-all hover:scale-[1.02]"
                        onClick={handleResendToken}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Resend Verification Email
                    </Button>
                    <Button variant="ghost" className="w-full h-11 text-muted-foreground hover:text-foreground gap-2" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                        Sign out and try another account
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
