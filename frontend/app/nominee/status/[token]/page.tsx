"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    Shield,
    Clock,
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    FolderKey,
    RefreshCw,
    ArrowLeft,
    FileText,
    User,
    Calendar,
    Heart
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { BASE_URL } from "@/lib/api"

export default function NomineeStatusPage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [loading, setLoading] = useState(true)
    const [statusData, setStatusData] = useState<any>(null)

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${BASE_URL}/nominees/status/${token}`)
            if (!res.ok) {
                toast.error("Failed to load status details.")
                router.push("/")
                return
            }
            const data = await res.json()
            setStatusData(data)
        } catch (error) {
            toast.error("Error connecting to server.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (token) {
            fetchStatus()
        }
    }, [token])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#070b11]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    if (!statusData || statusData.status === "NONE") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#070b11] px-4 text-slate-100">
                <Card className="w-full max-w-md border-slate-800 bg-slate-900/60 backdrop-blur-md text-center p-6 space-y-4">
                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                    <h2 className="text-xl font-bold">No Active Request Found</h2>
                    <p className="text-sm text-slate-400">
                        You have not submitted a death verification claim yet.
                    </p>
                    <Button onClick={() => router.push(`/nominee/verify/${token}`)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold">
                        Go to Verification Page
                    </Button>
                </Card>
            </main>
        )
    }

    const { status, verification, ownerName, relationship } = statusData
    const submittedAt = verification?.createdAt ? new Date(verification.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }) : "N/A"

    // Stepper logic
    const isSubmitted = true
    const isUnderReview = status === "UNDER_REVIEW" || status === "APPROVED" || status === "REJECTED" || status === "MORE_DOCUMENTS_REQUIRED"
    const isApproved = status === "APPROVED"
    const isRejected = status === "REJECTED"
    const isMoreDocs = status === "MORE_DOCUMENTS_REQUIRED"

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#070b11] px-4 py-12 relative overflow-hidden text-slate-100">
            {/* Background ambient lighting */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[140px]" />
                <div className="absolute left-1/3 top-2/3 h-[500px] w-[500px] rounded-full bg-teal-500/5 blur-[120px]" />
            </div>

            <div className="relative w-full max-w-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl">
                    <CardHeader className="border-b border-slate-800 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold text-slate-100">Verification Status Portal</CardTitle>
                                <p className="text-xs text-slate-400">Track the inheritance transfer process</p>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-6 space-y-6">
                        {/* Timeline / Stepper */}
                        <div className="relative flex justify-between items-center px-4">
                            {/* Horizontal progress bar background */}
                            <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800 z-0" />
                            {/* Active progress bar indicator */}
                            <div
                                className="absolute left-8 top-1/2 -translate-y-1/2 h-[2px] bg-emerald-500 transition-all duration-500 z-0"
                                style={{
                                    width: isApproved || isRejected ? "100%" : isUnderReview ? "50%" : "0%"
                                }}
                            />

                            {/* Step 1: Submitted */}
                            <div className="relative flex flex-col items-center z-10">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                                    isSubmitted ? "bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25" : "bg-slate-950 border-slate-800 text-slate-500"
                                }`}>
                                    <CheckCircle className="h-5 w-5" />
                                </div>
                                <span className={`mt-2 text-xs font-semibold ${isSubmitted ? "text-emerald-400 font-bold" : "text-slate-500"}`}>Submitted</span>
                            </div>

                            {/* Step 2: Under Review */}
                            <div className="relative flex flex-col items-center z-10">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                                    isUnderReview ? "bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25" : "bg-slate-950 border-slate-800 text-slate-500"
                                }`}>
                                    {status === "UNDER_REVIEW" ? (
                                        <Clock className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Clock className="h-5 w-5" />
                                    )}
                                </div>
                                <span className={`mt-2 text-xs font-semibold ${isUnderReview ? "text-emerald-400 font-bold" : "text-slate-500"}`}>Under Review</span>
                            </div>

                            {/* Step 3: Approved / Rejected */}
                            <div className="relative flex flex-col items-center z-10">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                                    isApproved ? "bg-emerald-500 border-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25" :
                                    isRejected ? "bg-red-500 border-red-500 text-slate-100 shadow-lg shadow-red-500/25" :
                                    isMoreDocs ? "bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/25" :
                                    "bg-slate-950 border-slate-800 text-slate-500"
                                }`}>
                                    {isApproved ? (
                                        <CheckCircle className="h-5 w-5" />
                                    ) : isRejected ? (
                                        <XCircle className="h-5 w-5" />
                                    ) : isMoreDocs ? (
                                        <AlertTriangle className="h-5 w-5" />
                                    ) : (
                                        <Shield className="h-5 w-5" />
                                    )}
                                </div>
                                <span className={`mt-2 text-xs font-semibold ${
                                    isApproved ? "text-emerald-400 font-bold" :
                                    isRejected ? "text-red-400 font-bold" :
                                    isMoreDocs ? "text-amber-400 font-bold" :
                                    "text-slate-500"
                                }`}>
                                    {isApproved ? "Approved" : isRejected ? "Rejected" : isMoreDocs ? "Action Required" : "Final Decision"}
                                </span>
                            </div>
                        </div>

                        {/* Status Message Card */}
                        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Claim Status</span>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                                    isApproved ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                    isRejected ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                    isMoreDocs ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                    "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                }`}>
                                    {status.replace("_", " ")}
                                </span>
                            </div>

                            {/* Detailed Info Grid */}
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <p className="text-slate-400 flex items-center gap-1 mb-1"><User className="h-3.5 w-3.5" /> Account Owner</p>
                                    <p className="font-semibold text-slate-200">{ownerName}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 flex items-center gap-1 mb-1"><Heart className="h-3.5 w-3.5" /> Relationship</p>
                                    <p className="font-semibold text-slate-200">{relationship}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 flex items-center gap-1 mb-1"><Calendar className="h-3.5 w-3.5" /> Submitted On</p>
                                    <p className="font-semibold text-slate-200">{submittedAt}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 flex items-center gap-1 mb-1"><FileText className="h-3.5 w-3.5" /> Request ID</p>
                                    <p className="font-mono text-slate-300">{verification.id}</p>
                                </div>
                            </div>

                            {/* Remarks / Rejection Reason / More Docs Instructions */}
                            {verification?.remarks && (
                                <div className="border-t border-slate-800/50 pt-3 space-y-1">
                                    <p className="text-xs font-semibold text-slate-400">Claimant Notes:</p>
                                    <p className="text-xs text-slate-300 italic">"{verification.remarks}"</p>
                                </div>
                            )}

                            {statusData.verification.remarks && (isRejected || isMoreDocs) && (
                                <div className="border-t border-red-500/20 bg-red-950/10 p-3 rounded-lg space-y-1">
                                    <p className="text-xs font-bold text-red-400 flex items-center gap-1">
                                        <AlertTriangle className="h-3.5 w-3.5" /> Compliance Feedback:
                                    </p>
                                    <p className="text-xs text-red-300 italic">"{statusData.verification.remarks}"</p>
                                </div>
                            )}
                        </div>

                        {/* Actions block */}
                        <div className="space-y-3 pt-2">
                            {isApproved && (
                                <Button
                                    onClick={() => {
                                        sessionStorage.setItem(`sv_nominee_token_${token}`, token)
                                        router.push(`/nominee/vault/${token}`)
                                    }}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold py-6 rounded-xl shadow-lg shadow-emerald-500/20"
                                >
                                    <FolderKey className="h-5 w-5 mr-2" /> Access Inherited Assets (View-Only)
                                </Button>
                            )}

                            {isRejected && (
                                <Button
                                    onClick={() => {
                                        router.push(`/nominee/verify/${token}`)
                                    }}
                                    className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-slate-100 font-bold py-6 rounded-xl shadow-lg shadow-red-500/20"
                                >
                                    <RefreshCw className="h-5 w-5 mr-2" /> Resubmit Claim & Upload Documents
                                </Button>
                            )}

                            {isMoreDocs && (
                                <Button
                                    onClick={() => {
                                        router.push(`/nominee/verify/${token}`)
                                    }}
                                    className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-bold py-6 rounded-xl shadow-lg shadow-amber-500/20"
                                >
                                    <RefreshCw className="h-5 w-5 mr-2" /> Upload Supporting Documents
                                </Button>
                            )}

                            {!isApproved && !isRejected && !isMoreDocs && (
                                <div className="text-center p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400">
                                    Our compliance team is actively reviewing your request. You will receive an email update once processed.
                                </div>
                            )}

                            <Button
                                variant="ghost"
                                onClick={() => router.push(`/nominee/verify/${token}`)}
                                className="w-full hover:bg-slate-800 text-xs text-slate-400 hover:text-slate-200"
                            >
                                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Return to Nominee Portal
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
