"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    RefreshCw,
    Eye,
    ShieldCheck,
    CreditCard,
    AlertCircle,
    Loader2,
    Check,
    Copy,
    ArrowLeft,
    TrendingUp,
    FileImage,
    X,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
    AdminPaymentRequest,
    PaymentStats,
    fetchAdminPaymentStats,
    fetchAdminPaymentRequests,
    fetchPaymentScreenshotBlob,
    approvePaymentRequest,
    rejectPaymentRequest,
} from "@/lib/payment-admin-api"
import { getAdminUser } from "@/lib/admin-store"

export default function SupportAdminPaymentsPage() {
    const [requests, setRequests] = useState<AdminPaymentRequest[]>([])
    const [stats, setStats] = useState<PaymentStats | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [currentAdmin, setCurrentAdmin] = useState<any>(null)

    // Modals
    const [selectedRequest, setSelectedRequest] = useState<AdminPaymentRequest | null>(null)
    const [isApproveOpen, setIsApproveOpen] = useState(false)
    const [isRejectOpen, setIsRejectOpen] = useState(false)
    const [rejectRemark, setRejectRemark] = useState("")
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
    const [isScreenshotOpen, setIsScreenshotOpen] = useState(false)
    const [loadingScreenshot, setLoadingScreenshot] = useState(false)
    const [copiedUtr, setCopiedUtr] = useState<string | null>(null)

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const [statsData, reqData] = await Promise.all([
                fetchAdminPaymentStats().catch(() => null),
                fetchAdminPaymentRequests(statusFilter),
            ])
            if (statsData) setStats(statsData)
            setRequests(reqData.items || [])
        } catch (err: any) {
            toast.error(err.message || "Failed to load payment verification data")
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => {
        setCurrentAdmin(getAdminUser())
        loadData()
    }, [loadData])

    const isSupportAdmin = currentAdmin?.role === "SUPPORT_ADMIN"

    const handleOpenScreenshot = async (req: AdminPaymentRequest) => {
        setSelectedRequest(req)
        setIsScreenshotOpen(true)
        setLoadingScreenshot(true)
        try {
            const blobUrl = await fetchPaymentScreenshotBlob(req.id)
            setScreenshotUrl(blobUrl)
        } catch (err: any) {
            toast.error(err.message || "Failed to load screenshot")
            setIsScreenshotOpen(false)
        } finally {
            setLoadingScreenshot(false)
        }
    }

    const handleApprove = async () => {
        if (!selectedRequest) return
        setActionLoading(true)
        try {
            await approvePaymentRequest(selectedRequest.id)
            toast.success(`Payment request for ${selectedRequest.userName || selectedRequest.userEmail} approved!`)
            setIsApproveOpen(false)
            setSelectedRequest(null)
            loadData()
        } catch (err: any) {
            toast.error(err.message || "Approval failed")
        } finally {
            setActionLoading(false)
        }
    }

    const handleReject = async () => {
        if (!selectedRequest) return
        if (!rejectRemark.trim()) {
            toast.error("Please provide a reason for declining the payment")
            return
        }

        setActionLoading(true)
        try {
            await rejectPaymentRequest(selectedRequest.id, rejectRemark.trim())
            toast.success("Payment request marked as rejected.")
            setIsRejectOpen(false)
            setRejectRemark("")
            setSelectedRequest(null)
            loadData()
        } catch (err: any) {
            toast.error(err.message || "Rejection failed")
        } finally {
            setActionLoading(false)
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopiedUtr(text)
        toast.success("Copied to clipboard")
        setTimeout(() => setCopiedUtr(null), 2000)
    }

    // Filter by search query
    const filteredRequests = requests.filter((r) => {
        const q = searchQuery.toLowerCase().trim()
        if (!q) return true
        return (
            r.utrId?.toLowerCase().includes(q) ||
            r.userEmail?.toLowerCase().includes(q) ||
            r.userName?.toLowerCase().includes(q) ||
            r.planName?.toLowerCase().includes(q)
        )
    })

    return (
        <div className="min-h-screen bg-dot-grid text-foreground p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
            {/* Top Navigation / Breadcrumb */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link
                            href="/admin/support"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-semibold"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Back to Support Dashboard
                        </Link>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                        <CreditCard className="h-7 w-7 text-primary" />
                        Manual Payment Verification Queue
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        Review submitted UPI proofs, match UTR records, and approve subscriber upgrades.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadData()}
                        disabled={loading}
                        className="h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold gap-2"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh Queue
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-zinc-950/80 border-white/10 backdrop-blur-md rounded-2xl">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground font-semibold">Pending Review</p>
                                <p className="text-2xl font-black text-amber-400 mt-1">{stats.pending}</p>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                                <Clock className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950/80 border-white/10 backdrop-blur-md rounded-2xl">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground font-semibold">Approved</p>
                                <p className="text-2xl font-black text-emerald-400 mt-1">{stats.approved}</p>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950/80 border-white/10 backdrop-blur-md rounded-2xl">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground font-semibold">Rejected</p>
                                <p className="text-2xl font-black text-rose-400 mt-1">{stats.rejected}</p>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                                <XCircle className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950/80 border-white/10 backdrop-blur-md rounded-2xl">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground font-semibold">Total Revenue</p>
                                <p className="text-2xl font-black text-primary mt-1">₹{stats.totalRevenue}</p>
                            </div>
                            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-zinc-950/80 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {["ALL", "PENDING", "APPROVED", "REJECTED"].map((tab) => (
                        <Button
                            key={tab}
                            size="sm"
                            variant={statusFilter === tab ? "default" : "ghost"}
                            onClick={() => setStatusFilter(tab)}
                            className={`h-8 px-3 rounded-xl text-xs font-bold transition-all ${
                                statusFilter === tab
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                            }`}
                        >
                            {tab === "ALL" ? "All Requests" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                        </Button>
                    ))}
                </div>

                <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search UTR, email, user..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 bg-white/5 border-white/10 text-xs rounded-xl text-foreground focus:ring-primary"
                    />
                </div>
            </div>

            {/* Payment Requests Table */}
            <Card className="bg-zinc-950/80 border-white/10 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5 text-muted-foreground uppercase text-[10px] font-black tracking-wider">
                                <th className="p-4 pl-6">Subscriber</th>
                                <th className="p-4">Plan & Amount</th>
                                <th className="p-4">UTR Reference</th>
                                <th className="p-4">Proof</th>
                                <th className="p-4">Submitted At</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 pr-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                                        Loading payment requests...
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-muted-foreground">
                                        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        No payment requests found matching your filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => {
                                    const isPending = req.status === "PENDING"
                                    const isApproved = req.status === "APPROVED"
                                    const isRejected = req.status === "REJECTED"

                                    return (
                                        <tr key={req.id} className="hover:bg-white/5 transition-colors">
                                            {/* User */}
                                            <td className="p-4 pl-6">
                                                <p className="font-bold text-foreground">{req.userName || "User"}</p>
                                                <p className="text-[11px] text-muted-foreground font-mono">{req.userEmail}</p>
                                            </td>

                                            {/* Plan & Amount */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] font-black uppercase ${
                                                            req.planId === "premium"
                                                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                                                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                                        }`}
                                                    >
                                                        {req.planName}
                                                    </Badge>
                                                    <span className="font-mono font-bold text-foreground">₹{req.amount}</span>
                                                </div>
                                            </td>

                                            {/* UTR */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs text-foreground bg-white/5 px-2 py-1 rounded-md border border-white/10 select-all font-semibold">
                                                        {req.utrId}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(req.utrId)}
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                    >
                                                        {copiedUtr === req.utrId ? (
                                                            <Check className="h-3 w-3 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </td>

                                            {/* Proof Screenshot */}
                                            <td className="p-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenScreenshot(req)}
                                                    className="h-7 text-[11px] px-2.5 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 text-foreground gap-1.5 font-semibold"
                                                >
                                                    <FileImage className="h-3.5 w-3.5 text-primary" />
                                                    View Proof
                                                </Button>
                                            </td>

                                            {/* Submitted At */}
                                            <td className="p-4 text-[11px] text-muted-foreground font-mono">
                                                {new Date(req.submittedAt).toLocaleString("en-IN", {
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </td>

                                            {/* Status */}
                                            <td className="p-4">
                                                {isPending && (
                                                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-black uppercase">
                                                        <Clock className="h-2.5 w-2.5 mr-1" /> Pending
                                                    </Badge>
                                                )}
                                                {isApproved && (
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-black uppercase">
                                                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Approved
                                                    </Badge>
                                                )}
                                                {isRejected && (
                                                    <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px] font-black uppercase">
                                                        <XCircle className="h-2.5 w-2.5 mr-1" /> Rejected
                                                    </Badge>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="p-4 pr-6 text-right">
                                                {isPending ? (
                                                    isSupportAdmin ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedRequest(req)
                                                                    setIsApproveOpen(true)
                                                                }}
                                                                className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 shadow-sm"
                                                            >
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setSelectedRequest(req)
                                                                    setIsRejectOpen(true)
                                                                }}
                                                                className="h-7 text-[11px] font-bold border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-lg px-2.5"
                                                            >
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground italic">
                                                            Support Admin only
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-[11px] text-muted-foreground font-mono">
                                                        {req.reviewedAt
                                                            ? new Date(req.reviewedAt).toLocaleDateString()
                                                            : "Reviewed"}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Screenshot Lightbox Modal */}
            <Dialog open={isScreenshotOpen} onOpenChange={setIsScreenshotOpen}>
                <DialogContent className="max-w-3xl bg-zinc-950 border-white/10 text-foreground p-0 overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileImage className="h-5 w-5 text-primary" />
                            <div>
                                <DialogTitle className="text-sm font-bold text-foreground">
                                    Payment Screenshot — UTR: {selectedRequest?.utrId}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    {selectedRequest?.userName} ({selectedRequest?.userEmail}) • ₹{selectedRequest?.amount} for {selectedRequest?.planName} Plan
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 flex items-center justify-center min-h-[300px] bg-black/50">
                        {loadingScreenshot ? (
                            <div className="text-center text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
                                Decrypting payment proof...
                            </div>
                        ) : screenshotUrl ? (
                            <img
                                src={screenshotUrl}
                                alt="Decrypted payment proof"
                                className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
                            />
                        ) : (
                            <p className="text-xs text-muted-foreground">Could not load screenshot</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Approve Confirmation Modal */}
            <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                <DialogContent className="max-w-md bg-zinc-950 border-white/10 text-foreground rounded-2xl">
                    <DialogHeader>
                        <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-2">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-lg font-black text-foreground">
                            Approve Subscription Upgrade?
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Approving this request will immediately activate the{" "}
                            <strong className="text-foreground">{selectedRequest?.planName} Plan</strong> (₹{selectedRequest?.amount}) for{" "}
                            <strong className="text-foreground">{selectedRequest?.userName || selectedRequest?.userEmail}</strong>, issue an invoice, and send a confirmation email.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-1.5 font-mono">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">UTR:</span>
                            <span className="text-foreground font-bold">{selectedRequest?.utrId}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Plan:</span>
                            <span className="text-emerald-400 font-bold uppercase">{selectedRequest?.planName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Validity:</span>
                            <span className="text-foreground">30 Days from approval</span>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setIsApproveOpen(false)}
                            disabled={actionLoading}
                            className="h-9 text-xs font-semibold border-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleApprove}
                            disabled={actionLoading}
                            className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20"
                        >
                            {actionLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Approving...
                                </>
                            ) : (
                                "Confirm & Activate Plan"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Modal */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                <DialogContent className="max-w-md bg-zinc-950 border-white/10 text-foreground rounded-2xl">
                    <DialogHeader>
                        <div className="h-12 w-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mb-2">
                            <XCircle className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-lg font-black text-foreground">
                            Decline Payment Request
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Specify the reason why this payment cannot be approved. This remark will be logged and emailed to the user.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 py-2">
                        <label className="text-xs font-bold text-foreground">
                            Rejection Reason / Remark <span className="text-rose-400">*</span>
                        </label>
                        <Textarea
                            placeholder="e.g. UTR number not found in bank statement, screenshot unreadable, incorrect payment amount..."
                            value={rejectRemark}
                            onChange={(e) => setRejectRemark(e.target.value)}
                            className="bg-white/5 border-white/10 text-xs rounded-xl text-foreground focus:ring-rose-500 min-h-[80px]"
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setIsRejectOpen(false)}
                            disabled={actionLoading}
                            className="h-9 text-xs font-semibold border-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleReject}
                            disabled={actionLoading || !rejectRemark.trim()}
                            className="h-9 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-600/20"
                        >
                            {actionLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Rejecting...
                                </>
                            ) : (
                                "Decline Payment"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
