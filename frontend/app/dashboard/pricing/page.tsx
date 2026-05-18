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
        <div className="flex flex-col gap-8 pb-10">
            <div className="text-center">
                <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">Upgrade Your Vault</h1>
                <p className="mt-2 text-muted-foreground">Secure more legacy with our premium storage plans.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {plans.map((plan) => {
                    const Icon = plan.icon
                    const isCurrent = user?.plan === plan.id

                    return (
                        <Card
                            key={plan.id}
                            className={`relative flex flex-col overflow-hidden bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 ${plan.border
                                } ${plan.glow || ""} ${plan.popular ? "ring-2 ring-blue-500" : ""}`}
                        >
                            {plan.popular && (
                                <div className="absolute right-0 top-0 rounded-bl-lg bg-blue-500 px-3 py-1 text-[10px] font-bold uppercase text-white">
                                    Most Popular
                                </div>
                            )}

                            <CardHeader className="pb-4">
                                <div className={`mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted group-hover:bg-secondary transition-colors`}>
                                    <Icon className={`h-6 w-6 ${plan.color}`} />
                                </div>
                                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold">{plan.price}</span>
                                    <span className="text-muted-foreground">one-time</span>
                                </div>
                                <p className="mt-4 text-sm font-semibold text-primary">{plan.storage} Storage</p>
                            </CardHeader>

                            <CardContent className="flex-1 pb-8">
                                <ul className="space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex gap-3 text-sm text-foreground">
                                            <Check className="h-4 w-4 shrink-0 text-success" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>

                            <CardFooter>
                                <Button
                                    className={`w-full h-12 text-sm font-bold transition-all ${isCurrent
                                        ? "bg-secondary text-muted-foreground cursor-default"
                                        : plan.id === "premium"
                                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                                            : ""
                                        }`}
                                    disabled={isCurrent || (upgrading !== null)}
                                    onClick={() => handleUpgrade(plan.id)}
                                >
                                    {upgrading === plan.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : isCurrent ? (
                                        "Current Plan"
                                    ) : (
                                        `Upgrade to ${plan.name}`
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>

            {/* Trust Section */}
            <div className="mt-10 rounded-3xl bg-secondary/30 p-8 text-center border border-border/50 backdrop-blur-sm">
                <Sparkles className="mx-auto h-8 w-8 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Lifetime Access</h3>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                    All our plans are one-time payments. No monthly subscriptions. Your digital legacy is secured forever.
                </p>
            </div>
        </div>
    )
}
