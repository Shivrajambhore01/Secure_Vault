"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  FileText,
  KeyRound,
  FileKey,
  ShieldCheck,
  AlertTriangle,
  Plus,
  MoreHorizontal,
  FolderKey,
  HardDrive,
  Users,
  CheckCircle2,
  Lock,
  ArrowRight,
  UserCheck,
} from "lucide-react"
import {
  saveUser,
  formatBytes,
  getCurrentUserId,
  isPinVerifiedSession,
  setPinVerifiedSession,
} from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { DigitalAsset, Nominee, User } from "@/lib/store"
import { VaultActivityChart } from "@/components/dashboard/VaultActivityChart"
import { ProtectionBreakdown } from "@/components/dashboard/ProtectionBreakdown"
import { HeritageCalloutCard } from "@/components/dashboard/HeritageCalloutCard"
import { PinModal } from "@/components/dashboard/pin-modal"
import { toast } from "sonner"

export default function DashboardOverview() {
  const [user, setUser] = useState<User | null>(null)
  const [assets, setAssets] = useState<DigitalAsset[]>([])
  const [nominees, setNominees] = useState<Nominee[]>([])
  const [storage, setStorage] = useState(0)
  const [pinVerified, setPinVerified] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)

  useEffect(() => {
    setPinVerified(isPinVerifiedSession())
  }, [])

  useEffect(() => {
    const userId = getCurrentUserId()

    if (userId) {
      const fetchData = async () => {
        try {
          const [assetsRes, nomineesRes, userRes] = await Promise.all([
            secureFetch(`/assets/${userId}`),
            secureFetch(`/nominees/${userId}`),
            secureFetch(`/auth/me/${userId}`)
          ])

          if (userRes.ok) {
            const userData = await userRes.json()
            saveUser(userData)
            setUser(userData)
          }

          const assetsData = await assetsRes.json()
          const nomineesData = await nomineesRes.json()

          setAssets(Array.isArray(assetsData) ? assetsData : [])
          setNominees(Array.isArray(nomineesData) ? nomineesData : [])
          if (Array.isArray(assetsData)) {
            setStorage(assetsData.reduce((sum: number, a: any) => sum + (a.fileSize || 1024), 0))
          }
        } catch (error) {
          console.error("Dashboard fetch error:", error)
        }
      }
      fetchData()
    }
  }, [])

  const totalLimit = user?.storageLimit || 500 * 1024 * 1024
  const storagePercentage = Math.min(Math.round((storage / totalLimit) * 100), 100)

  return (
    <div className="font-tt-norms font-sans text-black">
      {/* Dual-Column Modular Island Surface matching Reference Screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

        {/* Primary Main Work Area (Left ~65% / 7 cols on lg, 8 cols on xl) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          
          {/* Header & Nominee Avatar Stack (Exact structure from reference) */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">
                  Vault Overview
                </h1>
                {!pinVerified ? (
                  <button
                    onClick={() => setShowPinModal(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full cursor-pointer hover:bg-amber-100 transition shadow-2xs"
                  >
                    <Lock className="w-2.5 h-2.5" />
                    <span>PIN Required</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shadow-2xs">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Unlocked</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-neutral-400 mt-1">
                01 - 16 September, 2026
              </p>
            </div>

            {/* Beneficiary / Heir Stack */}
            <div className="flex items-center">
              <div className="flex items-center -space-x-2 mr-2">
                {nominees.slice(0, 3).map((nom, idx) => (
                  <div
                    key={nom.id || idx}
                    title={nom.name}
                    className="w-8 h-8 rounded-full bg-neutral-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-black shadow-2xs overflow-hidden"
                  >
                    {(nom.name || "N").slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {nominees.length === 0 && (
                  <>
                    <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-amber-800 shadow-2xs">
                      EV
                    </div>
                    <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-800 shadow-2xs">
                      MV
                    </div>
                    <div className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-purple-800 shadow-2xs">
                      CV
                    </div>
                  </>
                )}
              </div>

              {/* Add Nominee plus button */}
              <Link href="/dashboard/nominees">
                <button
                  title="Add Beneficiary"
                  className="w-8 h-8 rounded-full border border-neutral-300 text-neutral-500 hover:text-black hover:border-black flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>

          {/* Micro-Bar Activity Chart */}
          <div className="pt-2">
            <VaultActivityChart />
          </div>

          {/* Chronological Activity Feed (Exact layout from reference) */}
          <div className="space-y-6 pt-2">
            
            {/* Group 1: Today */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-sm font-bold text-black">Today</span>
                <button className="text-neutral-400 hover:text-black p-1 rounded-full cursor-pointer">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Item 1: Blue Badge */}
                <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-black truncate">Primary Enclave Key</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">5:12 pm • FIPS-203 Post-Quantum Protected</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-black shrink-0">+2.4 MB</span>
                </div>

                {/* Item 2: Purple Badge */}
                <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-black truncate">Estate Testament &amp; Will</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">3:45 pm • Verified Notarized Document</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-black shrink-0">+15.0 MB</span>
                </div>

                {/* Item 3: Orange Badge */}
                <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#F97316] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileKey className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-black truncate">Crypto Hardware Seed Backup</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">1:20 pm • Shamir Secret Shares</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-black shrink-0">Sealed</span>
                </div>
              </div>
            </div>

            {/* Group 2: Monday, 14 September 2026 */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between pb-1">
                <span className="text-sm font-bold text-black">Monday, 14 September 2026</span>
                <button className="text-neutral-400 hover:text-black p-1 rounded-full cursor-pointer">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Item 4: Red Badge */}
                <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#EF4444] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-black truncate">Healthcare Directives</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">10:15 am • Dual Beneficiary Approval Required</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-black shrink-0">+1.8 MB</span>
                </div>

                {/* Item 5: Green Badge */}
                <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-black truncate">Eleanor Vance (Primary Heir)</h4>
                      <p className="text-xs text-neutral-400 mt-0.5">9:30 am • ID Verified &amp; Onboarded</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-700 shrink-0">Verified</span>
                </div>
              </div>
            </div>

          </div>

          {/* Quick Action Footer Pill */}
          <div className="pt-2 flex items-center justify-between border-t border-black/5">
            <Link href="/dashboard/assets">
              <button className="text-xs font-bold text-neutral-600 hover:text-black flex items-center gap-1.5 transition-colors cursor-pointer py-1">
                <span>View all encrypted vault assets ({assets.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
            <Link href="/dashboard/assets/add">
              <button className="h-9 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-semibold px-4 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Secondary Intelligence Rail (Right ~35% / 5 cols on lg, 4 cols on xl) */}
        <div className="lg:col-span-5 xl:col-span-4 lg:border-l lg:border-black/5 lg:pl-8 space-y-8">
          
          {/* 1. Category Protection Meters */}
          <ProtectionBreakdown assets={assets} />

          {/* 2. Storage Quota Meter */}
          <div className="rounded-2xl border border-black/8 bg-neutral-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-black" />
                <span className="text-xs font-bold text-black">Encrypted Storage</span>
              </div>
              <span className="font-mono text-xs font-bold text-neutral-700">
                {formatBytes(storage)} / {formatBytes(totalLimit)}
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-neutral-200/80 overflow-hidden">
              <div
                style={{ width: `${Math.max(6, storagePercentage)}%` }}
                className="h-full rounded-full bg-black transition-all duration-500"
              />
            </div>

            <div className="flex items-center justify-between pt-0.5 text-[11px] text-neutral-500">
              <span>{storagePercentage}% allocated</span>
              <Link href="/dashboard/pricing" className="font-bold text-black hover:underline">
                Upgrade to 50 GB →
              </Link>
            </div>
          </div>

          {/* 3. Dead-Man Switch Safety Card (Matching bottom card in reference) */}
          <HeritageCalloutCard />

        </div>

      </div>

      {/* PIN Verification Modal */}
      <PinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setPinVerifiedSession()
          setPinVerified(true)
          setShowPinModal(false)
          toast.success("Security PIN verified. Vault unlocked.")
        }}
      />
    </div>
  )
}
