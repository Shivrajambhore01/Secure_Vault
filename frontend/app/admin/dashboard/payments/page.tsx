"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    RefreshCw,
    CreditCard,
    ArrowLeft,
    TrendingUp,
    FileImage,
    Lock,
    Loader2,
    Copy,
    Check,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    AdminPaymentRequest,
    PaymentStats,
    fetchAdminPaymentStats,
    fetchAdminPaymentRequests,
    fetchPaymentScreenshotBlob,
} from "@/lib/payment-admin-api"

export default function SuperAdminPaymentsPage() {
    const [requests, setRequests] = useState<AdminPaymentRequest[]>([])
    const [stats, setStats] = useState<PaymentStats | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [loading, setLoading] = useState(true)

    // Screenshot modal
    const [selectedRequest, setSelectedRequest] = useState<AdminPaymentRequest | null>(null)
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
        loadData()
    }, [loadData])

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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopiedUtr(text)
        toast.success("Copied to clipboard")
        setTimeout(() => setCopiedUtr(null), 2000)
    }

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
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link
                            href="/admin/dashboard"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-semibold"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Back to Super Admin Dashboard
                        </Link>
                    </div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                            <CreditCard className="h-7 w-7 text-primary" />
                            Payment Verification Oversight
                        </h1>
                        <Badge variant="outline" className="bg-white/5 border-white/10 text-muted-foreground text-[10px] font-bold">
                            <Lock className="h-3 w-3 mr-1" /> Read-Only Oversight
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Super Admin oversight view of subscriber payments and revenue. Action items are processed by Support Admins.
                    </p>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadData()}
                    disabled={loading}
                    className="h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold gap-2"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
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

            {/* Filter & Search */}
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

            {/* Table */}
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
                                <th className="p-4 pr-6">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                                        Loading payment requests...
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                                        <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        No payment requests found matching your filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 pl-6">
                                            <p className="font-bold text-foreground">{req.userName || "User"}</p>
                                            <p className="text-[11px] text-muted-foreground font-mono">{req.userEmail}</p>
                                        </td>
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
                                        <td className="p-4 text-[11px] text-muted-foreground font-mono">
                                            {new Date(req.submittedAt).toLocaleString("en-IN", {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </td>
                                        <td className="p-4 pr-6">
                                            {req.status === "PENDING" && (
                                                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-black uppercase">
                                                    <Clock className="h-2.5 w-2.5 mr-1" /> Pending
                                                </Badge>
                                            )}
                                            {req.status === "APPROVED" && (
                                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-black uppercase">
                                                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Approved
                                                </Badge>
                                            )}
                                            {req.status === "REJECTED" && (
                                                <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px] font-black uppercase">
                                                    <XCircle className="h-2.5 w-2.5 mr-1" /> Rejected
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Screenshot Lightbox */}
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
        </div>
    )
}
