"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, Home, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getUser, saveUser } from "@/lib/store"

function VerifyContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [message, setMessage] = useState("Verifying your email...")

    useEffect(() => {
        const token = searchParams.get("token")
        if (!token) {
            setStatus("error")
            setMessage("Invalid verification link. Token is missing.")
            return
        }

        const verifyEmail = async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/auth/verify-email?token=${token}`)
                const data = await response.json()

                if (response.ok) {
                    setStatus("success")
                    setMessage(data.message || "Your email has been successfully verified!")

                    // Update local user if logged in
                    const currentUser = getUser()
                    if (currentUser) {
                        saveUser({ ...currentUser, isVerified: true })
                    }
                } else {
                    setStatus("error")
                    setMessage(data.error || "Verification failed. The link may be expired.")
                }
            } catch (error) {
                setStatus("error")
                setMessage("Could not connect to the server. Please check your connection and try again.")
            }
        }

        verifyEmail()
    }, [searchParams])

    return (
        <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl">
            <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary/30">
                    {status === "loading" && <Loader2 className="h-10 w-10 text-primary animate-spin" />}
                    {status === "success" && <ShieldCheck className="h-10 w-10 text-success" />}
                    {status === "error" && <XCircle className="h-10 w-10 text-destructive" />}
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">
                    {status === "loading" && "Verifying..."}
                    {status === "success" && "Success!"}
                    {status === "error" && "Verification Failed"}
                </CardTitle>
                <CardDescription className="text-muted-foreground mt-2">
                    {message}
                </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-3">
                {status === "success" && (
                    <Button
                        className="w-full h-11 font-bold gap-2 transition-all hover:scale-[1.02]"
                        onClick={() => router.push("/dashboard")}
                    >
                        <Home className="h-4 w-4" />
                        Go to Dashboard
                    </Button>  
                )} 
                {status === "error" && ( 
                    <Button
                        className="w-full h-11 font-bold gap-2"
                        variant="outline"
                        onClick={() => router.push("/login")}
                    >
                        Back to Login
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
}

export default function VerifyPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Suspense fallback={
                <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur-sm shadow-2xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary/30">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                        </div>
                        <CardTitle>Verifying...</CardTitle>
                    </CardHeader>
                </Card>
            }>
                <VerifyContent />
            </Suspense>
        </div>
    )
}
