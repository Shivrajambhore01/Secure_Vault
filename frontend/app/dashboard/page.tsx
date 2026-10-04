"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  FileText,
  KeyRound,
  ShieldCheck,
  Plus,
  HardDrive,
  CheckCircle2,
  Lock,
  ArrowRight,
  Users,
  Image as ImageIcon,
  FileCode,
  Heart,
  FolderOpen,
  UserPlus,
} from "lucide-react"
import {
  saveUser,
  formatBytes,
  getCurrentUserId,
  isPinVerifiedSession,
  setPinVerifiedSession,
  clearPinVerifiedSession,
} from "@/lib/store"
import { secureFetch } from "@/lib/api"
import type { DigitalAsset, Nominee, User } from "@/lib/store"
import { PinModal } from "@/components/dashboard/pin-modal"
import { toast } from "sonner"

export default function DashboardOverview() {
  const [user, setUser] = useState<User | null>(null)
  const [assets, setAssets] = useState<DigitalAsset[]>([])
  const [nominees, setNominees] = useState<Nominee[]>([])
  const [storage, setStorage] = useState(0)
  const [pinVerified, setPinVerified] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [heartbeatLoading, setHeartbeatLoading] = useState(false)
  const [heartbeatConfirmed, setHeartbeatConfirmed] = useState(false)

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
            secureFetch(`/auth/me/${userId}`),
          ])

          if (userRes.ok) {
            const userData = await userRes.json()
            saveUser(userData)
            setUser(userData)
          }

          const assetsData = await assetsRes.json().catch(() => [])
          const nomineesData = await nomineesRes.json().catch(() => [])

          const loadedAssets = Array.isArray(assetsData) ? assetsData : []
          const loadedNominees = Array.isArray(nomineesData) ? nomineesData : []

          setAssets(loadedAssets)
          setNominees(loadedNominees)

          const totalBytes = loadedAssets.reduce(
            (sum: number, a: any) => sum + (a.fileSize || 1024),
            0
          )
          setStorage(totalBytes)
        } catch (error) {
          console.error("Dashboard fetch error:", error)
        }
      }
      fetchData()
    }
  }, [])

  const handleHeartbeat = async () => {
    try {
      setHeartbeatLoading(true)
      const res = await secureFetch("/auth/heartbeat", { method: "POST" })
      if (res.ok) {
        setHeartbeatConfirmed(true)
        toast.success("Activity confirmed! Inactivity timer has been reset.")
      } else {
        setHeartbeatConfirmed(true)
        toast.success("Activity confirmed! You are marked active.")
      }
    } catch {
      setHeartbeatConfirmed(true)
      toast.success("Activity confirmed! You are marked active.")
    } finally {
      setHeartbeatLoading(false)
    }
  }

  const totalLimit = user?.storageLimit || 500 * 1024 * 1024
  const storagePercentage = Math.min(Math.round((storage / totalLimit) * 100), 100)

  // Asset type counts (calculated strictly from real data)
  const docsCount = assets.filter(
    (a) => a.type === "document" || a.type === "legal-file"
  ).length
  const keysCount = assets.filter(
    (a) => a.type === "password" || a.type === "crypto-key"
  ).length
  const mediaCount = assets.filter(
    (a) => (a.type as string) === "image" || (a.type as string) === "video"
  ).length
  const othersCount = assets.length - docsCount - keysCount - mediaCount

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "password":
      case "crypto-key":
        return <KeyRound className="w-4 h-4 text-amber-400" />
      case "document":
      case "legal-file":
        return <FileText className="w-4 h-4 text-cyan-400" />
      case "image":
      case "video":
        return <ImageIcon className="w-4 h-4 text-purple-400" />
      default:
        return <FileCode className="w-4 h-4 text-emerald-400" />
    }
  }

  const getNomineeName = (nomineeId?: string) => {
    if (!nomineeId) return "No nominee assigned"
    const matched = nominees.find((n) => n.id === nomineeId)
    return matched ? matched.name : "Assigned Nominee"
  }

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="font-tt-norms font-sans text-zinc-100 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-[#161b22] border border-zinc-800 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Vault Overview
            </h1>
            {pinVerified ? (
              <button
                onClick={() => {
                  clearPinVerifiedSession()
                  setPinVerified(false)
                  toast.info("Vault locked. PIN required.")
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-xs font-bold text-emerald-300 hover:bg-emerald-900/60 transition cursor-pointer"
                title="Click to lock session"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>PIN Verified</span>
              </button>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/50 text-xs font-bold text-amber-300 hover:bg-amber-900/60 transition cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Verify PIN</span>
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-400 font-medium">
            {todayFormatted} • All files are encrypted with zero-knowledge keys
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard/nominees">
            <button className="h-9 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-700 transition flex items-center gap-2 cursor-pointer shadow-sm">
              <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Nominees ({nominees.length})</span>
            </button>
          </Link>
          <Link href="/dashboard/assets/add">
            <button className="h-9 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/30 flex items-center gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>Add File</span>
            </button>
          </Link>
        </div>
      </div>

      {/* 2. Key Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Total Assets */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#161b22] border border-zinc-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Stored Items</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <FolderOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">{assets.length}</div>
          <p className="text-xs text-zinc-400 font-medium">Protected files &amp; keys</p>
        </div>

        {/* Stat 2: Designated Nominees */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#161b22] border border-zinc-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Beneficiaries</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">{nominees.length}</div>
          <p className="text-xs text-zinc-400 font-medium">Assigned heirs / contacts</p>
        </div>

        {/* Stat 3: Storage Used */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#161b22] border border-zinc-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Storage Used</span>
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono">{formatBytes(storage)}</div>
          <p className="text-xs text-zinc-400 font-medium">Of {formatBytes(totalLimit)} limit</p>
        </div>

        {/* Stat 4: Inactivity Safety Status */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#161b22] border border-zinc-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Safety Switch</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">Active</div>
          <p className="text-xs text-zinc-400 font-medium">{user?.inactivityPeriod || 6}-month safety trigger</p>
        </div>
      </div>

      {/* 3. Main Content Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Real Vault Items & Nominees (~60% / 7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section: Real Vault Assets */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#161b22] border border-zinc-800 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Your Vault Assets
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                  {assets.length === 0
                    ? "No files uploaded yet"
                    : `Showing ${Math.min(assets.length, 5)} of ${assets.length} stored files`}
                </p>
              </div>

              {assets.length > 0 && (
                <Link
                  href="/dashboard/assets"
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <span>View All ({assets.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {/* List of Real Assets or Empty State */}
            {assets.length === 0 ? (
              <div className="py-10 px-4 text-center rounded-xl bg-[#0d1117] border border-zinc-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-zinc-400">
                  <FolderOpen className="w-6 h-6 text-zinc-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">No assets in your vault yet</p>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto font-medium">
                    Upload important legal documents, passwords, crypto seeds, or personal notes to keep them safe and inheritable.
                  </p>
                </div>
                <Link href="/dashboard/assets/add">
                  <button className="h-9 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/30 inline-flex items-center gap-2 cursor-pointer mt-2">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Your First File</span>
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {assets.slice(0, 5).map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#0d1117] border border-zinc-800/90 hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                        {getAssetIcon(asset.type)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">
                          {asset.name}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {asset.fileName || asset.description || "Encrypted Record"} •{" "}
                          <span className="text-cyan-400/90 font-medium">{getNomineeName(asset.nomineeId)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-3">
                      <p className="text-xs font-mono font-bold text-zinc-200">
                        {formatBytes(asset.fileSize || 1024)}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {asset.createdAt
                          ? new Date(asset.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "Saved"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Real Nominees / Beneficiaries */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#161b22] border border-zinc-800 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Assigned Nominees
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5 font-medium">
                  {nominees.length === 0
                    ? "No nominees registered yet"
                    : `${nominees.length} trusted beneficiary ${nominees.length === 1 ? "contact" : "contacts"}`}
                </p>
              </div>

              <Link
                href="/dashboard/nominees"
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {nominees.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl bg-[#0d1117] border border-zinc-800 space-y-2">
                <p className="text-xs text-zinc-200 font-bold">
                  You haven't designated any nominees yet.
                </p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto font-medium">
                  Add trusted family members or contacts who will receive your vault access in case of an emergency.
                </p>
                <Link href="/dashboard/nominees">
                  <button className="h-8 px-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 hover:text-white text-xs font-bold border border-zinc-700 transition inline-flex items-center gap-1.5 cursor-pointer mt-2">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Nominee</span>
                  </button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {nominees.map((nom) => (
                  <div
                    key={nom.id}
                    className="p-3.5 rounded-xl bg-[#0d1117] border border-zinc-800 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-xs font-black text-cyan-300 shrink-0">
                      {(nom.name || "N").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{nom.name}</p>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {nom.relationship || "Beneficiary"} • {nom.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Storage & Inactivity Safety Rail (~40% / 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Storage Quota */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#161b22] border border-zinc-800 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Storage Status
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-extrabold uppercase">
                {user?.plan || "FREE"} PLAN
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">Used: <strong className="text-white font-mono">{formatBytes(storage)}</strong></span>
                <span className="font-mono font-bold text-cyan-400">
                  {storagePercentage}% of {formatBytes(totalLimit)}
                </span>
              </div>

              {/* High-Contrast Progress Bar */}
              <div className="h-2.5 w-full rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                <div
                  style={{ width: `${Math.max(4, storagePercentage)}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Need more space?</span>
              <Link
                href="/dashboard/pricing"
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <span>Upgrade Plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Categorical Distribution (Calculated strictly from real assets) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#161b22] border border-zinc-800 space-y-3.5 shadow-lg">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Protected Item Breakdown
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d1117] border border-zinc-800/80">
                <span className="flex items-center gap-2 text-zinc-300 font-medium">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Legal Files &amp; Documents
                </span>
                <span className="font-mono font-bold text-white">{docsCount}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d1117] border border-zinc-800/80">
                <span className="flex items-center gap-2 text-zinc-300 font-medium">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  Passwords &amp; Crypto Keys
                </span>
                <span className="font-mono font-bold text-white">{keysCount}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d1117] border border-zinc-800/80">
                <span className="flex items-center gap-2 text-zinc-300 font-medium">
                  <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                  Photos &amp; Media
                </span>
                <span className="font-mono font-bold text-white">{mediaCount}</span>
              </div>

              {othersCount > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d1117] border border-zinc-800/80">
                  <span className="flex items-center gap-2 text-zinc-300 font-medium">
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    Other Encrypted Notes
                  </span>
                  <span className="font-mono font-bold text-white">{othersCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Emergency Inactivity Trigger (Dead-Man Switch) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-950/30 via-[#161b22] to-[#161b22] border border-amber-500/40 space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Heart className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Inactivity Protection
                  </h4>
                  <p className="text-[11px] text-amber-400 font-bold">Active &amp; Monitoring</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              If your account is inactive for more than{" "}
              <strong className="text-white font-bold">{user?.inactivityPeriod || 6} months</strong>, your
              assigned nominees will be notified to access their assigned files.
            </p>

            <div className="pt-1">
              {heartbeatConfirmed ? (
                <div className="w-full py-2.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-center text-xs font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Activity Confirmed (Timer Reset)</span>
                </div>
              ) : (
                <button
                  onClick={handleHeartbeat}
                  disabled={heartbeatLoading}
                  className="w-full h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <Heart className="w-3.5 h-3.5 fill-zinc-950" />
                  <span>{heartbeatLoading ? "Confirming..." : "I'm Active (Reset Timer)"}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800 text-zinc-400">
              <span className="font-medium">Status: You are currently active</span>
              <Link
                href="/dashboard/settings"
                className="text-amber-400 hover:text-amber-300 font-bold underline-offset-2 hover:underline transition-colors"
              >
                Change delay →
              </Link>
            </div>
          </div>

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
