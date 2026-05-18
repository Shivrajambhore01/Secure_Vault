"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Phone, Calendar, KeyRound, Shield, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { getUser, saveUser, isLoggedIn } from "@/lib/store"
import { secureFetch } from "@/lib/api"

export default function CompleteProfilePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [user, setUser] = useState(getUser())

    // Form fields
    const [fullName, setFullName] = useState("")
    const [phone, setPhone] = useState("")
    const [dob, setDob] = useState("")
    const [pin, setPin] = useState("")
    const [confirmPin, setConfirmPin] = useState("")
    const [agreed, setAgreed] = useState(false)

    useEffect(() => {
        if (!isLoggedIn()) {
            router.push("/login")
            return
        }

        const currentUser = getUser()
        if (!currentUser) {
            router.push("/login")
            return
        }

        // If profile is already complete, go to dashboard
        if (currentUser.isProfileComplete) {
            router.push("/dashboard")
            return
        }

        setUser(currentUser)
        setFullName(currentUser.fullName || "")
    }, [router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!fullName.trim()) {
            toast.error("Full name is required")
            return
        }
        if (!phone.trim() || phone.length < 10) {
            toast.error("Please enter a valid phone number")
            return
        }
        if (!dob) {
            toast.error("Date of birth is required")
            return
        }
        if (!pin || pin.length < 4) {
            toast.error("Security PIN must be at least 4 digits")
            return
        }
        if (pin !== confirmPin) {
            toast.error("PINs do not match")
            return
        }
        if (!agreed) {
            toast.error("Please agree to the terms to continue")
            return
        }

        setLoading(true)
        try {
            const response = await secureFetch("/auth/complete-profile", {
                method: "POST",
                body: JSON.stringify({ fullName, phone, dob, pin }),
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to save profile")

            // Update local store
            saveUser(data.user)
            toast.success("Profile completed! Welcome to SecureVault.")
            router.push("/dashboard")
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!user) return null

    return (
        <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
            {/* Background glow */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px]" />
            </div>

            <div className="relative w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-border bg-card shadow-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
                            <Shield className="h-7 w-7 text-primary-foreground" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-foreground">Complete Your Profile</CardTitle>
                        <CardDescription className="text-muted-foreground mt-1">
                            Welcome, <span className="font-semibold text-foreground">{user.email}</span>! <br />
                            Please fill in the details below to secure your vault.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
                            {/* Full Name */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="fullName" className="flex items-center gap-2 text-foreground">
                                    <User className="h-4 w-4 text-primary" /> Full Name
                                </Label>
                                <Input
                                    id="fullName"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Enter your full name"
                                    className="bg-input border-border text-foreground"
                                />
                            </div>

                            {/* Phone */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="phone" className="flex items-center gap-2 text-foreground">
                                    <Phone className="h-4 w-4 text-primary" /> Mobile Number
                                </Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+91 9876543210"
                                    className="bg-input border-border text-foreground"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Used for inactivity alerts and emergency calls.
                                </p>
                            </div>

                            {/* Date of Birth */}
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="dob" className="flex items-center gap-2 text-foreground">
                                    <Calendar className="h-4 w-4 text-primary" /> Date of Birth
                                </Label>
                                <Input
                                    id="dob"
                                    type="date"
                                    value={dob}
                                    onChange={(e) => setDob(e.target.value)}
                                    className="bg-input border-border text-foreground"
                                />
                            </div>

                            {/* Security PIN */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="pin" className="flex items-center gap-2 text-foreground">
                                        <KeyRound className="h-4 w-4 text-primary" /> Security PIN
                                    </Label>
                                    <Input
                                        id="pin"
                                        type="password"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                                        placeholder="4-6 digits"
                                        className="bg-input border-border text-foreground"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="confirmPin" className="text-foreground">Confirm PIN</Label>
                                    <Input
                                        id="confirmPin"
                                        type="password"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={confirmPin}
                                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                                        placeholder="Re-enter PIN"
                                        className="bg-input border-border text-foreground"
                                    />
                                </div>
                            </div>

                            {/* Agreement */}
                            <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-4">
                                <Checkbox
                                    id="terms"
                                    checked={agreed}
                                    onCheckedChange={(checked) => setAgreed(checked === true)}
                                    className="mt-0.5"
                                />
                                <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                                    I agree to SecureVault's <span className="text-primary font-medium">Terms of Service</span> and{" "}
                                    <span className="text-primary font-medium">Privacy Policy</span>. I understand my data will be securely
                                    stored and used for vault management and nominee notifications.
                                </label>
                            </div>

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={loading || !agreed}
                                className="w-full h-12 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.01]"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle className="h-5 w-5 mr-2" />
                                        Complete Setup & Enter Vault
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
