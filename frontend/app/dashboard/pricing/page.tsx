"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Check,
    Crown,
    Flame,
    Zap,
    Sparkles,
    ShieldCheck,
    Clock,
    Receipt,
    FileText,
    HardDrive,
    Users,
    FileUp,
    FolderLock,
    Lock,
    HelpCircle,
    ArrowRight,
    CheckCircle2,
    Shield,
    KeyRound,
    UserCheck,
    BadgeCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { getUser } from "@/lib/store"
import {
    fetchPlans,
    fetchMySubscription,
    PlanInfo,
    ActiveSubscription,
    PaymentRequestItem,
    InvoiceItem,
} from "@/lib/payment-api"
import { PaymentModal } from "@/components/dashboard/payment-modal"

interface DetailedPlan {
    id: string
    name: string
    tagline: string
    price: number
    currency: string
    billingPeriod: string
    storageLimit: number
    storageLabel: string
    fileSizeLimit: number
    fileSizeLabel: string
    nomineeLimit: number
    nomineeLabel: string
    assetLimit: number
    assetLabel: string
    badge?: string
    popular?: boolean
    features: { text: string; highlight?: boolean }[]
}

const DETAILED_PLANS: DetailedPlan[] = [
    {
        id: "free",
        name: "Free Vault",
        tagline: "Essential personal digital vault with zero-knowledge encryption.",
        price: 0,
        currency: "INR",
        billingPeriod: "forever free",
        storageLimit: 50 * 1024 * 1024,
        storageLabel: "50 MB Storage",
        fileSizeLimit: 5 * 1024 * 1024,
        fileSizeLabel: "5 MB File Cap",
        nomineeLimit: 1,
        nomineeLabel: "1 Nominee",
        assetLimit: 5,
        assetLabel: "5 Digital Assets",
        badge: "Starter Tier",
        features: [
            { text: "50 MB AES-256 Encrypted Cloud Storage" },
            { text: "5 MB Max Upload Size per Document" },
            { text: "1 Designated Beneficiary Nominee" },
            { text: "Up to 5 Digital Asset Vault Records" },
            { text: "Zero-Knowledge AES-256-GCM Encryption", highlight: true },
            { text: "Automated Inactivity Heartbeat Tracking", highlight: true },
            { text: "Death Claim Verification Workflow", highlight: true },
            { text: "24-Hour Time-Limited Nominee Access Link" },
        ],
    },
    {
        id: "pro",
        name: "Pro Vault",
        tagline: "Expanded capacity for individuals protecting critical financial & legal assets.",
        price: 199,
        currency: "INR",
        billingPeriod: "/ month",
        storageLimit: 5 * 1024 * 1024 * 1024,
        storageLabel: "5 GB Storage",
        fileSizeLimit: 100 * 1024 * 1024,
        fileSizeLabel: "100 MB File Cap",
        nomineeLimit: 5,
        nomineeLabel: "5 Nominees",
        assetLimit: 50,
        assetLabel: "50 Digital Assets",
        badge: "Recommended",
        popular: true,
        features: [
            { text: "5 GB Ultra-Fast Encrypted Cloud Storage", highlight: true },
            { text: "100 MB File Size Cap for Large Documents" },
            { text: "Up to 5 Designated Beneficiary Nominees", highlight: true },
            { text: "Up to 50 Digital Asset Vault Records", highlight: true },
            { text: "High-Resolution Image & Video Safekeeping" },
            { text: "Priority Support & Fast Verification Queue" },
            { text: "Zero-Knowledge AES-256-GCM Encryption" },
            { text: "Automated Inactivity Heartbeat & Death Claims" },
        ],
    },
    {
        id: "premium",
        name: "Premium Vault",
        tagline: "Maximum storage, multi-nominee family legacy, and VIP compliance support.",
        price: 499,
        currency: "INR",
        billingPeriod: "/ month",
        storageLimit: 25 * 1024 * 1024 * 1024,
        storageLabel: "25 GB Storage",
        fileSizeLimit: 500 * 1024 * 1024,
        fileSizeLabel: "500 MB File Cap",
        nomineeLimit: 10,
        nomineeLabel: "10 Nominees",
        assetLimit: 1000,
        assetLabel: "Unlimited (1k Cap)",
        badge: "Executive Suite",
        features: [
            { text: "25 GB Massive Encrypted Cloud Storage", highlight: true },
            { text: "500 MB Large File Size Cap for Video & Archives" },
            { text: "Up to 10 Beneficiary Nominees (Multi-Inheritance)", highlight: true },
            { text: "Unlimited Digital Assets (Soft Cap 1,000)", highlight: true },
            { text: "24/7 Dedicated Support & Compliance Escalation" },
            { text: "Multi-Node Redundant Backup Assurance" },
            { text: "Executive Gold Crown Badge & Early Features", highlight: true },
            { text: "Zero-Knowledge AES-256-GCM Encryption" },
        ],
    },
]

export default function PricingPage() {
    const [currentPlanId, setCurrentPlanId] = useState<string>("free")
    const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null)
    const [pendingRequest, setPendingRequest] = useState<PaymentRequestItem | null>(null)
    const [invoices, setInvoices] = useState<InvoiceItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPlanForModal, setSelectedPlanForModal] = useState<PlanInfo | null>(null)
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const localUser = getUser()
            if (localUser?.plan) {
                setCurrentPlanId(localUser.plan)
            }

            try {
                const subData = await fetchMySubscription()
                if (subData.subscription && subData.subscription.status === "ACTIVE") {
                    setActiveSubscription(subData.subscription)
                    setCurrentPlanId(subData.subscription.planId)
                }
                if (subData.pendingRequest) {
                    setPendingRequest(subData.pendingRequest)
                } else {
                    setPendingRequest(null)
                }
                if (subData.invoices) {
                    setInvoices(subData.invoices)
                }
            } catch (err) {
                console.warn("Subscription details load notice:", err)
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleSelectPlan = (plan: DetailedPlan) => {
        if (plan.id === currentPlanId) return
        const planInfo: PlanInfo = {
            id: plan.id,
            name: plan.name,
            price: plan.price,
            currency: plan.currency,
            billingPeriod: plan.billingPeriod,
            storageLimit: plan.storageLimit,
            fileSizeLimit: plan.fileSizeLimit,
            nomineeLimit: plan.nomineeLimit,
            assetLimit: plan.assetLimit,
            features: plan.features.map((f) => f.text),
        }
        setSelectedPlanForModal(planInfo)
        setIsPaymentModalOpen(true)
    }

    return (
        <div className="flex flex-col gap-10 pb-20 bg-dot-grid min-h-screen text-foreground">
            {/* Header Section */}
            <div className="text-center space-y-3 pt-6 max-w-2xl mx-auto px-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wide">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Transparent Security Plans</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-primary">
                    Simple, Predictable Vault Pricing
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Protect your digital legacy with enterprise-grade AES-256-GCM encryption. Upgrade anytime via direct UPI with manual verification.
                </p>
            </div>

            {/* Pending Payment Alert Banner */}
            {pendingRequest && (
                <div className="max-w-5xl mx-auto w-full px-4">
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-xl shadow-lg shadow-amber-500/5">
                        <div className="flex items-start gap-3.5">
                            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                <Clock className="h-5 w-5 animate-pulse" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-foreground">
                                        Payment Verification in Progress
                                    </h4>
                                    <Badge className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                                        Under Review
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Your payment for <strong className="text-foreground">{pendingRequest.planName} Plan</strong> (UTR: <span className="font-mono text-primary font-bold">{pendingRequest.utrId}</span>) has been submitted and is currently being verified by our compliance team.
                                </p>
                            </div>
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground shrink-0 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                            Submitted: {new Date(pendingRequest.submittedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                    </div>
                </div>
            )}

            {/* Active Subscription Banner */}
            {activeSubscription && (
                <div className="max-w-5xl mx-auto w-full px-4">
                    <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <div className="text-xs">
                                <span className="font-bold text-foreground">Current Active Plan: </span>
                                <span className="text-emerald-400 uppercase font-black tracking-wider">{activeSubscription.planId}</span>
                                <span className="text-muted-foreground ml-2">
                                    • Valid until {new Date(activeSubscription.endDate).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
                                </span>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            Active Subscription
                        </Badge>
                    </div>
                </div>
            )}

            {/* Plan Cards Grid — Precision Alignment */}
            <div className="grid gap-8 lg:grid-cols-3 max-w-6xl mx-auto w-full px-4">
                {DETAILED_PLANS.map((plan) => {
                    const isCurrent = currentPlanId === plan.id
                    const isPendingForThis = pendingRequest?.status === "PENDING" && pendingRequest.planId === plan.id

                    const cardTheme =
                        plan.id === "premium"
                            ? "border-amber-500/30 bg-gradient-to-b from-amber-500/[0.07] via-zinc-950 to-zinc-950 shadow-xl shadow-amber-500/5 hover:border-amber-500/50"
                            : plan.id === "pro"
                            ? "border-blue-500/40 bg-gradient-to-b from-blue-500/[0.08] via-zinc-950 to-zinc-950 shadow-2xl shadow-blue-500/10 ring-1 ring-blue-500/30 hover:border-blue-500/60"
                            : "border-white/10 bg-gradient-to-b from-white/[0.04] via-zinc-950 to-zinc-950 shadow-lg hover:border-white/20"

                    const iconColor =
                        plan.id === "premium"
                            ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                            : plan.id === "pro"
                            ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                            : "text-zinc-400 bg-white/5 border-white/10"

                    const Icon = plan.id === "premium" ? Crown : plan.id === "pro" ? Flame : Zap

                    return (
                        <Card
                            key={plan.id}
                            className={`relative flex flex-col justify-between overflow-hidden rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1.5 backdrop-blur-xl ${cardTheme}`}
                        >
                            {/* Popular Ribbon */}
                            {plan.popular && (
                                <div className="absolute top-0 right-0">
                                    <div className="rounded-bl-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1.5 text-[10px] font-black uppercase text-white tracking-widest shadow-md">
                                        Most Popular
                                    </div>
                                </div>
                            )}

                            <div>
                                {/* Top Badge & Icon */}
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${iconColor} shadow-inner`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 ${
                                            plan.id === "premium"
                                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                                : plan.id === "pro"
                                                ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                                : "bg-white/5 text-muted-foreground border-white/10"
                                        }`}
                                    >
                                        {plan.badge}
                                    </Badge>
                                </div>

                                {/* Plan Title & Subtitle */}
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-foreground tracking-tight">
                                        {plan.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground min-h-[32px] leading-relaxed">
                                        {plan.tagline}
                                    </p>
                                </div>

                                {/* Price Block */}
                                <div className="mt-5 pb-5 border-b border-white/10">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-4xl sm:text-5xl font-black text-foreground tracking-tight font-mono">
                                            ₹{plan.price}
                                        </span>
                                        <span className="text-xs font-bold text-muted-foreground">
                                            {plan.billingPeriod}
                                        </span>
                                    </div>
                                </div>

                                {/* Structured Capacity Matrix (2x2 Grid) */}
                                <div className="grid grid-cols-2 gap-2.5 my-5">
                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                        <HardDrive className="h-4 w-4 text-primary shrink-0" />
                                        <div className="overflow-hidden">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Storage</p>
                                            <p className="text-xs font-black text-foreground truncate">{plan.storageLabel}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                        <Users className="h-4 w-4 text-primary shrink-0" />
                                        <div className="overflow-hidden">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Nominees</p>
                                            <p className="text-xs font-black text-foreground truncate">{plan.nomineeLabel}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                        <FileUp className="h-4 w-4 text-primary shrink-0" />
                                        <div className="overflow-hidden">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Max File</p>
                                            <p className="text-xs font-black text-foreground truncate">{plan.fileSizeLabel}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                                        <FolderLock className="h-4 w-4 text-primary shrink-0" />
                                        <div className="overflow-hidden">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Assets</p>
                                            <p className="text-xs font-black text-foreground truncate">{plan.assetLabel}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Feature Checkpoints */}
                                <div className="space-y-3 pt-2">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                        Included Features
                                    </p>
                                    <ul className="space-y-2.5">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2.5 text-xs text-foreground/85 leading-tight">
                                                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-0.5">
                                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                                </div>
                                                <span className={feature.highlight ? "font-semibold text-foreground" : ""}>
                                                    {feature.text}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Action CTA Button */}
                            <div className="pt-6 mt-6 border-t border-white/10">
                                {isCurrent ? (
                                    <Button
                                        disabled
                                        className="w-full h-12 text-xs font-bold rounded-2xl bg-white/5 text-muted-foreground border border-white/10 cursor-default"
                                    >
                                        <BadgeCheck className="h-4 w-4 mr-2 text-emerald-400" />
                                        Current Active Plan
                                    </Button>
                                ) : isPendingForThis ? (
                                    <Button
                                        disabled
                                        className="w-full h-12 text-xs font-bold rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-default"
                                    >
                                        <Clock className="h-4 w-4 mr-2 animate-pulse" />
                                        Verification Pending
                                    </Button>
                                ) : plan.id === "free" ? (
                                    <Button
                                        disabled
                                        variant="outline"
                                        className="w-full h-12 text-xs font-bold rounded-2xl border-white/10 text-muted-foreground cursor-default"
                                    >
                                        Default Base Tier
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => handleSelectPlan(plan)}
                                        className={`w-full h-12 text-xs font-bold rounded-2xl transition-all duration-200 shadow-xl ${
                                            plan.id === "premium"
                                                ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98]"
                                                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98]"
                                        }`}
                                    >
                                        Upgrade to {plan.name} (₹{plan.price}/mo)
                                    </Button>
                                )}
                            </div>
                        </Card>
                    )
                })}
            </div>

            {/* Complete Comparison Matrix Table */}
            <div className="max-w-6xl mx-auto w-full px-4 mt-8">
                <div className="rounded-3xl bg-zinc-950/80 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
                    <div className="text-center space-y-1.5 max-w-md mx-auto">
                        <h3 className="text-xl font-black text-foreground">Detailed Feature Comparison</h3>
                        <p className="text-xs text-muted-foreground">
                            Every tier includes our core security architecture. Upgrades scale your storage and nominee limits.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-muted-foreground uppercase text-[10px] font-black tracking-wider">
                                    <th className="py-3 px-4">Feature / Capability</th>
                                    <th className="py-3 px-4 text-center">Free Vault</th>
                                    <th className="py-3 px-4 text-center text-blue-400">Pro Vault (₹199)</th>
                                    <th className="py-3 px-4 text-center text-amber-400">Premium Vault (₹499)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {/* Storage & Limits */}
                                <tr className="bg-white/[0.02]">
                                    <td colSpan={4} className="py-2.5 px-4 font-bold text-primary uppercase text-[10px] tracking-wider">
                                        Storage & File Quotas
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">Cloud Storage Capacity</td>
                                    <td className="py-3 px-4 text-center font-mono">50 MB</td>
                                    <td className="py-3 px-4 text-center font-mono font-bold text-blue-400">5 GB</td>
                                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">25 GB</td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">Maximum File Size Limit</td>
                                    <td className="py-3 px-4 text-center font-mono">5 MB</td>
                                    <td className="py-3 px-4 text-center font-mono">100 MB</td>
                                    <td className="py-3 px-4 text-center font-mono font-bold">500 MB</td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">Max Digital Asset Entries</td>
                                    <td className="py-3 px-4 text-center font-mono">5 Assets</td>
                                    <td className="py-3 px-4 text-center font-mono font-bold">50 Assets</td>
                                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">Unlimited (1k Cap)</td>
                                </tr>

                                {/* Nominees & Inheritance */}
                                <tr className="bg-white/[0.02]">
                                    <td colSpan={4} className="py-2.5 px-4 font-bold text-primary uppercase text-[10px] tracking-wider">
                                        Nominees & Beneficiary Controls
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">Designated Beneficiary Nominees</td>
                                    <td className="py-3 px-4 text-center font-mono">1 Nominee</td>
                                    <td className="py-3 px-4 text-center font-mono font-bold text-blue-400">5 Nominees</td>
                                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">10 Nominees</td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">Per-Asset Nominee Allocation</td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">Time-Limited 24h Secure Access Link</td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                </tr>

                                {/* Security Architecture */}
                                <tr className="bg-white/[0.02]">
                                    <td colSpan={4} className="py-2.5 px-4 font-bold text-primary uppercase text-[10px] tracking-wider">
                                        Core Security (Never Gated)
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">AES-256-GCM Zero-Knowledge Encryption</td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">Automated Inactivity Heartbeat</td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">Death Certificate Verification Workflow</td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                    <td className="py-3 px-4 text-center"><Check className="h-4 w-4 text-emerald-400 mx-auto" /></td>
                                </tr>
                                <tr>
                                    <td className="py-3 px-4 font-medium text-foreground">Support & Compliance Level</td>
                                    <td className="py-3 px-4 text-center text-muted-foreground">Standard</td>
                                    <td className="py-3 px-4 text-center text-blue-400 font-semibold">Priority Queue</td>
                                    <td className="py-3 px-4 text-center text-amber-400 font-semibold">24/7 Dedicated Legal</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Invoices History (if any) */}
            {invoices.length > 0 && (
                <div className="max-w-6xl mx-auto w-full px-4">
                    <div className="rounded-3xl bg-zinc-950/80 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                                <Receipt className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground">Payment Invoices & Receipts</h3>
                                <p className="text-xs text-muted-foreground">Official billing receipts for verified subscription payments</p>
                            </div>
                        </div>

                        <div className="divide-y divide-white/10">
                            {invoices.map((inv) => (
                                <div key={inv.id} className="py-3.5 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-4 w-4 text-primary shrink-0" />
                                        <div>
                                            <p className="font-bold text-foreground">{inv.planName} Plan Subscription</p>
                                            <p className="text-[11px] text-muted-foreground font-mono">Invoice ID: #{inv.id.slice(0, 8)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-foreground font-mono">₹{inv.amount}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {new Date(inv.issuedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Frequently Asked Questions */}
            <div className="max-w-4xl mx-auto w-full px-4">
                <div className="rounded-3xl bg-zinc-950/60 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <HelpCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground">Subscription FAQs</h3>
                            <p className="text-xs text-muted-foreground">Common questions regarding payments, security, and expiry</p>
                        </div>
                    </div>

                    <Accordion type="single" collapsible className="w-full space-y-2">
                        <AccordionItem value="item-1" className="border-white/10 bg-white/[0.02] px-4 rounded-xl">
                            <AccordionTrigger className="text-xs sm:text-sm font-semibold hover:no-underline">
                                How does the UPI payment verification process work?
                            </AccordionTrigger>
                            <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                                Click "Upgrade" on your preferred plan to open the payment modal. Scan the Union Bank of India QR code using any UPI app (GPay, PhonePe, Paytm, BHIM) and complete the payment. Enter the 12-digit UTR reference ID and attach a screenshot of the receipt. Our Support Admin team reviews the bank statement and activates your plan immediately.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-2" className="border-white/10 bg-white/[0.02] px-4 rounded-xl">
                            <AccordionTrigger className="text-xs sm:text-sm font-semibold hover:no-underline">
                                What happens if my 30-day subscription expires?
                            </AccordionTrigger>
                            <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                                <strong>Your existing files, digital assets, and nominees are NEVER deleted or lost.</strong> Your vault automatically switches back to Free tier limits (50 MB storage). You will simply be unable to upload new files until you renew or reduce storage.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-3" className="border-white/10 bg-white/[0.02] px-4 rounded-xl">
                            <AccordionTrigger className="text-xs sm:text-sm font-semibold hover:no-underline">
                                Are core security features locked behind paid subscriptions?
                            </AccordionTrigger>
                            <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                                <strong>No.</strong> Zero-Knowledge AES-256-GCM encryption, Inactivity Heartbeat monitoring, and Nominee Death Claim Verification are available on every plan, including the Free tier. Paid tiers only scale storage capacity and nominee quotas.
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="item-4" className="border-white/10 bg-white/[0.02] px-4 rounded-xl">
                            <AccordionTrigger className="text-xs sm:text-sm font-semibold hover:no-underline">
                                Can I upgrade from Pro to Premium mid-cycle?
                            </AccordionTrigger>
                            <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                                Yes. When you submit a payment for Premium while on Pro, your new 30-day Premium period starts upon approval, immediately expanding your storage to 25 GB and nominees to 10.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>

            {/* Payment Modal */}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                plan={selectedPlanForModal}
                onSuccess={() => {
                    loadData()
                }}
            />
        </div>
    )
}
