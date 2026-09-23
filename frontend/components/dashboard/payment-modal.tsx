"use client"

import React, { useState, useRef } from "react"
import Image from "next/image"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
    QrCode,
    Upload,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
    Sparkles,
    ShieldCheck,
    Copy,
    Check,
    FileImage,
    X,
} from "lucide-react"
import { PlanInfo, submitPaymentRequest } from "@/lib/payment-api"

interface PaymentModalProps {
    isOpen: boolean
    onClose: () => void
    plan: PlanInfo | null
    onSuccess?: () => void
}

export function PaymentModal({ isOpen, onClose, plan, onSuccess }: PaymentModalProps) {
    const [utrId, setUtrId] = useState("")
    const [screenshot, setScreenshot] = useState<File | null>(null)
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [submittedData, setSubmittedData] = useState<{ utr: string; planName: string } | null>(null)
    const [copiedUpi, setCopiedUpi] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!plan) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type)) {
            toast.error("Please upload a valid image file (JPEG, PNG, or WebP)")
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be under 5MB")
            return
        }

        setScreenshot(file)
        const reader = new FileReader()
        reader.onloadend = () => {
            setScreenshotPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    const removeScreenshot = () => {
        setScreenshot(null)
        setScreenshotPreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!utrId.trim() || utrId.trim().length < 4) {
            toast.error("Please enter a valid UPI Transaction / UTR ID")
            return
        }

        if (!screenshot) {
            toast.error("Please upload a screenshot of your successful UPI payment")
            return
        }

        setLoading(true)
        try {
            const res = await submitPaymentRequest(plan.id, utrId.trim(), screenshot)
            toast.success("Payment request submitted successfully!")
            setSubmittedData({ utr: utrId.trim(), planName: plan.name })
            setIsSuccess(true)
            if (onSuccess) onSuccess()
        } catch (err: any) {
            toast.error(err.message || "Failed to submit payment request")
        } finally {
            setLoading(false)
        }
    }

    const handleModalClose = () => {
        if (!loading) {
            setIsSuccess(false)
            setUtrId("")
            removeScreenshot()
            onClose()
        }
    }

    const copyUpiId = (id: string) => {
        navigator.clipboard.writeText(id)
        setCopiedUpi(true)
        toast.success("UPI ID copied to clipboard")
        setTimeout(() => setCopiedUpi(false), 2000)
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleModalClose}>
            <DialogContent className="max-w-2xl bg-zinc-950/95 border-white/10 text-foreground backdrop-blur-xl shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                <QrCode className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                                    Upgrade to {plan.name} Plan
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs uppercase font-bold">
                                        ₹{plan.price}/mo
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Scan the QR code, pay via any UPI app, and submit your transaction details for verification.
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-y-auto p-6 space-y-6 flex-1">
                    {isSuccess ? (
                        /* Success View */
                        <div className="py-8 text-center space-y-4">
                            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 animate-in zoom-in-50 duration-300">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-foreground">Payment Proof Submitted!</h3>
                                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                                    Thank you! Your payment request for the <strong className="text-foreground">{submittedData?.planName} Plan</strong> (UTR: <span className="font-mono text-primary font-bold">{submittedData?.utr}</span>) has been received.
                                </p>
                            </div>

                            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 max-w-md mx-auto text-left space-y-2 text-xs">
                                <div className="flex items-center gap-2 text-amber-400 font-semibold">
                                    <Clock className="h-4 w-4 shrink-0" />
                                    <span>Verification in progress</span>
                                </div>
                                <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    Our Support & Compliance team will verify your payment details shortly. Your vault storage and limits will be upgraded automatically upon approval.
                                </p>
                            </div>

                            <div className="pt-4">
                                <Button
                                    onClick={handleModalClose}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 h-10 rounded-xl"
                                >
                                    Done
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Form View */
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Step 1: UPI QR Code Section */}
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-black items-center justify-center">
                                            1
                                        </span>
                                        <h4 className="text-sm font-bold text-foreground">Scan QR Code to Pay ₹{plan.price}</h4>
                                    </div>
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                        <ShieldCheck className="h-3 w-3 mr-1 inline" /> Secure UPI
                                    </Badge>
                                </div>

                                <div className="grid sm:grid-cols-2 gap-5 items-center">
                                    {/* QR Code Image Container */}
                                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 border border-white/15 shadow-inner">
                                        <div className="relative w-48 h-48 rounded-xl overflow-hidden bg-white p-2 shadow-lg">
                                            <Image
                                                src="/UBI_QR.jpeg"
                                                alt="SecureVault UPI QR Code"
                                                fill
                                                className="object-contain p-1"
                                                priority
                                            />
                                        </div>
                                        <p className="mt-2 text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                            <Sparkles className="h-3 w-3 text-amber-400" /> Scan with any UPI app
                                        </p>
                                    </div>

                                    {/* Payment details & Instructions */}
                                    <div className="space-y-3 text-xs">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-muted-foreground font-semibold">Payable Amount</Label>
                                            <div className="text-2xl font-black text-foreground font-mono">
                                                ₹{plan.price} <span className="text-xs font-normal text-muted-foreground">/ month</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-muted-foreground font-semibold">UPI ID / VPA</Label>
                                            <div className="flex items-center gap-2 p-2 rounded-lg bg-black/40 border border-white/10">
                                                <span className="font-mono text-xs text-foreground font-bold select-all flex-1">
                                                    ubiqr.9840259160@ubi
                                                </span>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-xs hover:bg-white/10 text-muted-foreground hover:text-foreground"
                                                    onClick={() => copyUpiId("ubiqr.9840259160@ubi")}
                                                >
                                                    {copiedUpi ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-[11px] text-blue-300 leading-relaxed">
                                            Accepted via Google Pay, PhonePe, Paytm, BHIM, or any UPI banking app.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Verification Details */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-black items-center justify-center">
                                        2
                                    </span>
                                    <h4 className="text-sm font-bold text-foreground">Submit Payment Proof</h4>
                                </div>

                                {/* UTR / Transaction ID */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="utrId" className="text-xs font-bold text-foreground">
                                        UPI Transaction ID / UTR Number <span className="text-rose-400">*</span>
                                    </Label>
                                    <Input
                                        id="utrId"
                                        placeholder="e.g. 425612345678 (12-digit UTR)"
                                        value={utrId}
                                        onChange={(e) => setUtrId(e.target.value)}
                                        className="h-10 bg-white/5 border-white/10 text-foreground font-mono text-sm rounded-xl focus:ring-primary"
                                        required
                                        disabled={loading}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        You can find the 12-digit UTR or Reference number in your UPI app's transaction history receipt.
                                    </p>
                                </div>

                                {/* Screenshot Upload */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold text-foreground">
                                        Payment Screenshot / Receipt <span className="text-rose-400">*</span>
                                    </Label>

                                    {screenshotPreview ? (
                                        <div className="relative rounded-xl border border-white/15 bg-white/5 p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="relative h-14 w-14 rounded-lg overflow-hidden border border-white/10">
                                                    <Image
                                                        src={screenshotPreview}
                                                        alt="Payment proof preview"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div className="text-xs">
                                                    <p className="font-semibold text-foreground truncate max-w-[200px]">
                                                        {screenshot?.name}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {((screenshot?.size || 0) / (1024 * 1024)).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={removeScreenshot}
                                                className="h-8 w-8 p-0 rounded-full hover:bg-rose-500/20 text-rose-400"
                                                disabled={loading}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-white/15 hover:border-primary/50 bg-white/5 hover:bg-white/10 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200"
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp,image/jpg"
                                                className="hidden"
                                                onChange={handleFileChange}
                                                disabled={loading}
                                            />
                                            <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-xs font-semibold text-foreground">
                                                Click or drag screenshot here
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Supports PNG, JPEG, or WebP (max 5MB)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Submit CTA */}
                            <div className="pt-2 flex items-center justify-end gap-3 border-t border-white/10">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleModalClose}
                                    disabled={loading}
                                    className="h-10 text-xs font-bold border-white/10 text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading || !utrId.trim() || !screenshot}
                                    className="h-10 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 shadow-lg shadow-primary/20"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Submitting...
                                        </>
                                    ) : (
                                        `Submit Payment (₹${plan.price})`
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
