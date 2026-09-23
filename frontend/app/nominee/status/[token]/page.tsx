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
            <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]">
                <Loader2 className="h-8 w-8 animate-spin text-black" />
            </div>
        )
    }

    if (!statusData || statusData.status === "NONE") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4 text-black font-tt-norms font-sans">
                <Card className="w-full max-w-md border-black/8 bg-white text-center p-8 space-y-4 rounded-3xl shadow-xl">
                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                    <h2 className="text-xl font-bold text-black">No Active Request Found</h2>
                    <p className="text-sm text-neutral-500">
                        You have not submitted a death verification claim yet.
                    </p>
                    <Button onClick={() => router.push(`/nominee/verify/${token}`)} className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full">
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
        <main className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4 py-12 relative overflow-hidden text-black font-tt-norms font-sans">
            <div className="relative w-full max-w-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-black/8 bg-white shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="border-b border-black/8 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100 border border-black/8 text-black">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-bold text-black">Verification Status Portal</CardTitle>
                                <p className="text-xs text-neutral-500">Track the inheritance transfer process</p>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-6 space-y-6">
                        {/* Timeline / Stepper */}
                        <div className="relative flex justify-between items-center px-4">
                            {/* Horizontal progress bar background */}
                            <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px] bg-neutral-200 z-0" />
                            {/* Active progress bar indicator */}
                            <div
                                className="absolute left-8 top-1/2 -translate-y-1/2 h-[2px] bg-black transition-all duration-500 z-0"
                                style={{
                                    width: isApproved || isRejected ? "100%" : isUnderReview ? "50%" : "0%"
                                }}
                            />

                            {/* Step 1: Submitted */}
                            <div className="relative flex flex-col items-center z-10">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                                    isSubmitted ? "bg-black border-black text-white shadow-xs" : "bg-white border-black/10 text-neutral-400"
                                }`}>
                                    <CheckCircle className="h-5 w-5" />
                                </div>
                                <span className={`mt-2 text-xs font-semibold ${isSubmitted ? "text-black font-bold" : "text-neutral-400"}`}>Submitted</span>
                            </div>

                            {/* Step 2: Under Review */}
                            <div className="relative flex flex-col items-center z-10">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                                    isUnderReview ? "bg-black border-black text-white shadow-xs" : "bg-white border-black/10 text-neutral-400"
                                }`}>
                                    {status === "UNDER_REVIEW" ? (
                                        <Clock className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Clock className="h-5 w-5" />
                                    )}
                                </div>
                                <span className={`mt-2 text-xs font-semibold ${isUnderReview ? "text-black font-bold" : "text-neutral-400"}`}>Under Review</span>
                            </div>

                            {/* Step 3: Approved / Rejected */}
                            <div className="relative flex flex-col items-center z-10">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                                    isApproved ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" :
                                    isRejected ? "bg-red-600 border-red-600 text-white shadow-xs" :
                                    isMoreDocs ? "bg-amber-600 border-amber-600 text-white shadow-xs" :
                                    "bg-white border-black/10 text-neutral-400"
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
                                    isApproved ? "text-emerald-700 font-bold" :
                                    isRejected ? "text-red-700 font-bold" :
                                    isMoreDocs ? "text-amber-700 font-bold" :
                                    "text-neutral-400"
                                }`}>
                                    {isApproved ? "Approved" : isRejected ? "Rejected" : isMoreDocs ? "Action Required" : "Final Decision"}
                                </span>
                            </div>
                        </div>

                        {/* Status Message Card */}
                        <div className="rounded-2xl border border-black/8 bg-neutral-50 p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-black/8 pb-3">
                                <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Claim Status</span>
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                                    isApproved ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                    isRejected ? "bg-red-50 text-red-700 border-red-200" :
                                    isMoreDocs ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    "bg-neutral-100 text-neutral-800 border-black/10"
                                }`}>
                                    {status.replace("_", " ")}
                                </span>
                            </div>

                            {/* Detailed Info Grid */}
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <p className="text-neutral-500 flex items-center gap-1 mb-1"><User className="h-3.5 w-3.5" /> Account Owner</p>
                                    <p className="font-semibold text-black">{ownerName}</p>
                                </div>
                                <div>
                                    <p className="text-neutral-500 flex items-center gap-1 mb-1"><Heart className="h-3.5 w-3.5" /> Relationship</p>
                                    <p className="font-semibold text-black">{relationship}</p>
                                </div>
                                <div>
                                    <p className="text-neutral-500 flex items-center gap-1 mb-1"><Calendar className="h-3.5 w-3.5" /> Submitted On</p>
                                    <p className="font-semibold text-black">{submittedAt}</p>
                                </div>
                                <div>
                                    <p className="text-neutral-500 flex items-center gap-1 mb-1"><FileText className="h-3.5 w-3.5" /> Request ID</p>
                                    <p className="font-mono text-neutral-700">{verification.id}</p>
                                </div>
                            </div>

                            {/* Remarks / Rejection Reason / More Docs Instructions */}
                            {verification?.remarks && (
                                <div className="border-t border-black/8 pt-3 space-y-1">
                                    <p className="text-xs font-semibold text-neutral-500">Claimant Notes:</p>
                                    <p className="text-xs text-black italic">"{verification.remarks}"</p>
                                </div>
                            )}

                            {statusData.verification.remarks && (isRejected || isMoreDocs) && (
                                <div className="border-t border-red-200 bg-red-50 p-3 rounded-xl space-y-1">
                                    <p className="text-xs font-bold text-red-700 flex items-center gap-1">
                                        <AlertTriangle className="h-3.5 w-3.5" /> Compliance Feedback:
                                    </p>
                                    <p className="text-xs text-red-800 italic">"{statusData.verification.remarks}"</p>
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
                                    className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full shadow-sm"
                                >
                                    <FolderKey className="h-5 w-5 mr-2" /> Access Inherited Assets (View-Only)
                                </Button>
                            )}

                            {isRejected && (
                                <Button
                                    onClick={() => {
                                        router.push(`/nominee/verify/${token}`)
                                    }}
                                    className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full shadow-sm"
                                >
                                    <RefreshCw className="h-5 w-5 mr-2" /> Resubmit Claim & Upload Documents
                                </Button>
                            )}

                            {isMoreDocs && (
                                <Button
                                    onClick={() => {
                                        router.push(`/nominee/verify/${token}`)
                                    }}
                                    className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full shadow-sm"
                                >
                                    <RefreshCw className="h-5 w-5 mr-2" /> Upload Supporting Documents
                                </Button>
                            )}

                            {!isApproved && !isRejected && !isMoreDocs && (
                                <div className="text-center p-4 rounded-2xl border border-black/8 bg-neutral-50 text-xs text-neutral-600">
                                    Our compliance team is actively reviewing your request. You will receive an email update once processed.
                                </div>
                            )}

                            <Button
                                variant="ghost"
                                onClick={() => router.push(`/nominee/verify/${token}`)}
                                className="w-full text-xs text-neutral-500 hover:text-black rounded-full"
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
