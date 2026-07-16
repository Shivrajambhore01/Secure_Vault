"use client"

import { useState, useEffect } from "react"
import { Check, Crown, Flame, Zap, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { getUser, saveUser, getCurrentUserId } from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { User } from "@/lib/store"

const plans = [
    {
        id: "free",
        name: "Free",
        price: "$0",
        storage: "500 MB",
        features: ["500 MB Secure Storage", "Basic Asset Upload", "50MB File Size Limit", "Standard Support"],
        icon: Zap,
        color: "text-muted-foreground",
        border: "border-border",
    },
    {
        id: "pro",
        name: "Pro",
        price: "$29",
        storage: "10 GB",
        features: [
            "10 GB Secure Storage",
            "500MB File Size Limit",
            "Pro Badge on Profile",
            "Priority Support",
            "Ad-free Experience",
        ],
        icon: Flame,
        color: "text-blue-500",
        border: "border-blue-500/50",
        popular: true,
    },
    {
        id: "premium",
        name: "Premium",
        price: "$99",
        storage: "100 GB",
        features: [
            "100 GB Secure Storage",
            "Unlimited File Size",
            "Crown Badge ✨",
            "Premium Exclusive Theme",
            "Advanced Filtering",
            "Early Feature Access",
        ],
        icon: Crown,
        color: "text-amber-500",
        border: "border-amber-500/50",
        glow: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
    },
]

export default function PricingPage() {
    const [user, setUser] = useState<User | null>(null)
    const [upgrading, setUpgrading] = useState<string | null>(null)

    useEffect(() => {
        setUser(getUser())
    }, [])

    const handleUpgrade = async (planId: string) => {
        const userId = getCurrentUserId()
        if (!userId) return

        setUpgrading(planId)

        try {
            const response = await secureFetch("/auth/update-plan", {
                method: "POST",
                body: JSON.stringify({ userId, plan: planId }),
            })

            if (!response.ok) throw new Error("Upgrade failed")

            const data = await response.json()

            // Update local storage and state
            const updatedUser = { ...user!, ...data.user, id: userId }
            saveUser(updatedUser)
            setUser(updatedUser)

            toast.success(`Successfully upgraded to ${planId.toUpperCase()}!`)
        } catch (error) {
            toast.error("Error during upgrade simulation")
        } finally {
            setUpgrading(null)
        }
    }

    return (
        <div className="flex flex-col gap-8 pb-12 bg-dot-grid min-h-screen">
            <div className="text-center space-y-3">
                <h1 className="text-3xl font-black text-foreground tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-primary">
                    Upgrade Your Vault
                </h1>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                    Secure your digital legacy with expanded cloud storage, multi-node replication, and advanced nominees.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3 mt-4">
                {plans.map((plan) => {
                    const Icon = plan.icon
                    const isCurrent = user?.plan === plan.id

                    const holoGradient = 
                        plan.id === "premium" ? "holo-gradient-premium border-amber-500/20" :
                        plan.id === "pro" ? "holo-gradient-pro border-blue-500/20" :
                        "holo-gradient-free border-white/5";

                    const cardShadow =
                        plan.id === "premium" ? "shadow-lg hover:shadow-amber-500/10" :
                        plan.id === "pro" ? "shadow-lg hover:shadow-blue-500/10" :
                        "shadow-md";

                    return (
                        <Card
                            key={plan.id}
                            className={`relative flex flex-col overflow-hidden bg-glass glass-border backdrop-blur-md transition-all duration-300 hover:-translate-y-2 rounded-3xl p-6 ${holoGradient} ${cardShadow} ${
                                plan.popular ? "ring-1.5 ring-blue-500/40" : ""
                            }`}
                        >
                            {plan.popular && (
                                <div className="absolute right-0 top-0 rounded-bl-2xl bg-blue-500 px-4 py-1.5 text-[10px] font-black uppercase text-white tracking-wider shadow-md">
                                    Most Popular
                                </div>
                            )}

                            <CardHeader className="pt-2 p-0 pb-4">
                                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-background/60 border border-white/5 backdrop-blur-lg shadow-inner`}>
                                    <Icon className={`h-6 w-6 ${plan.color}`} />
                                </div>
                                <CardTitle className="text-2xl font-black tracking-tight text-foreground">{plan.name}</CardTitle>
                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-foreground tracking-tight">{plan.price}</span>
                                    <span className="text-xs text-muted-foreground font-semibold">one-time payment</span>
                                </div>
                                <p className="mt-2 text-xs font-extrabold text-primary uppercase tracking-wider">{plan.storage} Storage</p>
                            </CardHeader>

                            <CardContent className="flex-1 p-0 py-4 border-t border-white/5 mt-2">
                                <ul className="space-y-3.5">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-xs text-foreground/80 font-medium">
                                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                <Check className="h-3 w-3" />
                                            </div>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>

                            <CardFooter className="p-0 pt-6 mt-4">
                                <Button
                                    className={`w-full h-11 text-xs font-bold rounded-xl transition-all duration-200 ${
                                        isCurrent
                                            ? "bg-secondary/40 text-muted-foreground border border-white/5 cursor-default hover:bg-secondary/40"
                                            : plan.id === "premium"
                                                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
                                                : plan.id === "pro"
                                                    ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]"
                                                    : "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-[1.02] active:scale-[0.98]"
                                    }`}
                                    disabled={isCurrent || (upgrading !== null)}
                                    onClick={() => handleUpgrade(plan.id)}
                                >
                                    {upgrading === plan.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : isCurrent ? (
                                        "Current Active Plan"
                                    ) : (
                                        `Activate ${plan.name}`
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>

            {/* Trust Section */}
            <div className="mt-8 rounded-3xl bg-glass border border-white/5 p-8 text-center backdrop-blur-md max-w-xl mx-auto shadow-lg relative overflow-hidden">
                <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-primary/10 blur-xl" />
                <Sparkles className="mx-auto h-9 w-9 text-primary mb-4 animate-pulse" />
                <h3 className="text-lg font-black mb-1.5 text-foreground">Lifetime Heritage Protection</h3>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto font-medium">
                    All updates are one-time secure vaults purchases. No recurring monthly overheads. Your digital legacy remains protected indefinitely.
                </p>
            </div>
        </div>
    )
}

