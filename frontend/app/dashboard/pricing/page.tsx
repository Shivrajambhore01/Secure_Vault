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

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    storage: "500 MB",
    features: ["500 MB Secure Storage", "Basic Asset Upload", "50MB File Size Limit", "Standard Support"],
    icon: Zap,
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
      "Priority Multi-Node Replication",
      "Dual-Nominee Trigger Release",
    ],
    icon: Flame,
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
      "Crown Badge on Profile ✨",
      "Multi-Heir Shamir Allocation",
      "Custom Dead Man's Switch Delays",
      "Post-Quantum FIPS-203 Encryption",
    ],
    icon: Crown,
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
    <div className="flex flex-col gap-8 pb-12 font-tt-norms font-sans text-black">
      {/* Title */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-black">
          Upgrade Your Vault
        </h1>
        <p className="text-sm md:text-base text-neutral-600 leading-relaxed font-normal">
          Secure your digital legacy with expanded cloud storage, multi-node replication, and advanced nominee directives.
        </p>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3 mt-4">
        {plans.map((plan) => {
          const Icon = plan.icon
          const isCurrent = user?.plan === plan.id

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between overflow-hidden bg-white border rounded-3xl p-8 shadow-sm transition-all duration-200 hover:shadow-md ${
                plan.popular
                  ? "border-black ring-1 ring-black"
                  : "border-black/8"
              }`}
            >
              {plan.popular && (
                <div className="absolute top-5 right-5">
                  <span className="bg-black text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-xs">
                    Popular
                  </span>
                </div>
              )}

              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 border border-black/5 shadow-2xs mb-5">
                  <Icon className="h-5 w-5 text-black" />
                </div>

                <h3 className="text-2xl font-bold tracking-tight text-black">{plan.name}</h3>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-4xl font-extrabold text-black tracking-tight">{plan.price}</span>
                  <span className="text-xs text-neutral-500 font-medium">one-time vault upgrade</span>
                </div>

                <div className="mt-3 inline-flex items-center gap-1.5 bg-neutral-100 px-3 py-1 rounded-full text-xs font-semibold text-neutral-800">
                  <span>{plan.storage} Storage Capacity</span>
                </div>

                <ul className="space-y-3 mt-6 pt-6 border-t border-black/5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-xs text-neutral-700 font-medium">
                      <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8 mt-6">
                <button
                  disabled={isCurrent || upgrading !== null}
                  onClick={() => handleUpgrade(plan.id)}
                  className={`w-full h-11 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                    isCurrent
                      ? "bg-neutral-100 text-neutral-400 border border-black/5 cursor-default"
                      : "bg-black hover:bg-neutral-800 text-white shadow-sm active:scale-[0.98]"
                  }`}
                >
                  {upgrading === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto text-white" />
                  ) : isCurrent ? (
                    "Current Active Plan"
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Trust Guarantee Section */}
      <div className="mt-6 rounded-3xl bg-white border border-black/8 p-8 text-center max-w-xl mx-auto shadow-sm">
        <Sparkles className="mx-auto h-8 w-8 text-black mb-3" />
        <h3 className="text-lg font-bold text-black mb-1">Lifetime Heritage Protection</h3>
        <p className="text-xs text-neutral-600 leading-relaxed max-w-md mx-auto font-normal">
          All upgrades are permanent, non-custodial allocations. No recurring subscription overheads. Your digital vault directives remain secured indefinitely.
        </p>
      </div>
    </div>
  )
}
