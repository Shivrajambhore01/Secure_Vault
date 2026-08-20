"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    Shield,
    Mail,
    FileText,
    Loader2,
    CheckCircle,
    Upload,
    ArrowRight,
    UserCheck,
    FileCheck,
    KeyRound,
    Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { BASE_URL } from "@/lib/api"

export default function NomineeVerifyPage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    // Global loading and status
    const [loading, setLoading] = useState(true)
    const [verifying, setVerifying] = useState(false)
    const [nomineeDetails, setNomineeDetails] = useState<{
        name: string
        maskedEmail: string
        email: string
        relationship?: string
        ownerName?: string
        maskedOwnerEmail?: string
        ownerEmail?: string
    } | null>(null)
    
    const [requestStatus, setRequestStatus] = useState<any>(null)

    // Flow Step:
    // Step 1: Owner Details & Notice
    // Step 2: Nominee Login / Authentication (OTP)
    // Step 3: Death Certificate & Claim Form
    // Step 4: Submission Confirmation & Status
    const [flowStep, setFlowStep] = useState<1 | 2 | 3 | 4>(1)
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    // OTP states
    const [otp, setOtp] = useState("")
    const [otpSent, setOtpSent] = useState(false)
    const [timer, setTimer] = useState(0)

    // Death Certificate Submission Form
    const [claimForm, setClaimForm] = useState({
        claimedByName: "",
        claimedByRelation: "",
        claimedByEmail: "",
        claimedByPhone: "",
        dateOfDeath: "",
        placeOfDeath: "",
        deathCertificateNumber: "",
        remarks: ""
    })

    const [deathDocFile, setDeathDocFile] = useState<File | null>(null)
    const [uploadedDocInfo, setUploadedDocInfo] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Countdown Timer for OTP
    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000)
            return () => clearInterval(interval)
        }
    }, [timer])

    // Load nominee & owner details
    const loadDetailsAndStatus = async () => {
        try {
            const nomineeRes = await fetch(`${BASE_URL}/nominees/verify/${token}`)
            if (!nomineeRes.ok) {
                const err = await nomineeRes.json().catch(() => ({}))
                toast.error(err.detail || "Invalid or expired access link")
                router.push("/")
                return
            }
            const nomineeData = await nomineeRes.json()
            setNomineeDetails(nomineeData)
            
            setClaimForm(prev => ({
                ...prev,
                claimedByName: nomineeData.name || "",
                claimedByEmail: nomineeData.email || "",
                claimedByRelation: nomineeData.relationship || ""
            }))

            // Check existing request status if any
            const statusRes = await fetch(`${BASE_URL}/verification/status?accessToken=${token}`)
            if (statusRes.ok) {
                const statusData = await statusRes.json()
                setRequestStatus(statusData)
                if (statusData.hasRequest && (statusData.status === "PENDING_REVIEW" || statusData.status === "APPROVED" || statusData.status === "MORE_DOCUMENTS_REQUIRED")) {
                    setFlowStep(4)
                }
            }
        } catch (error) {
            toast.error("Failed to load account details.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (token) loadDetailsAndStatus()
    }, [token])

    // Send OTP to Nominee Email
    const handleSendOTP = async () => {
        if (!nomineeDetails?.email) return
        setVerifying(true)
        try {
            const res = await fetch(`${BASE_URL}/nominees/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, email: nomineeDetails.email })
            })
            const data = await res.json()
            if (res.ok) {
                setOtpSent(true)
                setTimer(60)
                setOtp("")
                toast.success(`Authentication code sent to ${nomineeDetails.maskedEmail}`)
            } else {
                toast.error(data.detail || "Failed to send verification code.")
            }
        } catch (e) {
            toast.error("Network error sending authentication code.")
        } finally {
            setVerifying(false)
        }
    }

    // Verify Nominee OTP
    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!otp || !nomineeDetails?.email) return
        setVerifying(true)
        try {
            const res = await fetch(`${BASE_URL}/nominees/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: nomineeDetails.email, otp, token })
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Nominee authenticated successfully!")
                setIsAuthenticated(true)
                setFlowStep(3)
            } else {
                toast.error(data.detail || "Invalid code. Please check your email.")
            }
        } catch (e) {
            toast.error("Authentication failed.")
        } finally {
            setVerifying(false)
        }
    }

    // File selection handler
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error("File size exceeds 10MB limit.")
                return
            }
            setDeathDocFile(file)
            toast.success(`Selected file: ${file.name}`)
        }
    }

    // Submit Complete Form with Death Certificate
    const handleSubmitDeathCertificateForm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!claimForm.claimedByName || !claimForm.claimedByRelation || !claimForm.claimedByPhone) {
            toast.error("Please complete all required fields.")
            return
        }
        if (!deathDocFile) {
            toast.error("Please upload the official Death Certificate.")
            return
        }

        setVerifying(true)
        try {
            // Step A: Initiate Claim Request
            const claimRes = await fetch(`${BASE_URL}/verification/claim`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accessToken: token,
                    claimedByName: claimForm.claimedByName,
                    claimedByRelation: claimForm.claimedByRelation,
                    claimedByEmail: claimForm.claimedByEmail,
                    claimedByPhone: claimForm.claimedByPhone,
                    remarks: `Date of Death: ${claimForm.dateOfDeath} | Place: ${claimForm.placeOfDeath} | Reg #: ${claimForm.deathCertificateNumber} | Notes: ${claimForm.remarks}`
                })
            })

            if (!claimRes.ok) {
                const claimErr = await claimRes.json().catch(() => ({}))
                // If claim already exists, proceed to upload document
                if (!claimErr.detail?.includes("already exists")) {
                    toast.error(claimErr.detail || "Failed to initiate claim request.")
                    setVerifying(false)
                    return
                }
            }

            // Step B: Upload Death Certificate File
            const formData = new FormData()
            formData.append("accessToken", token)
            formData.append("documentType", "DEATH_CERTIFICATE")
            formData.append("file", deathDocFile)

            const uploadRes = await fetch(`${BASE_URL}/verification/upload-death-document`, {
                method: "POST",
                body: formData
            })

            if (!uploadRes.ok) {
                const uploadErr = await uploadRes.json().catch(() => ({}))
                toast.error(uploadErr.detail || "Failed to upload Death Certificate file.")
                setVerifying(false)
                return
            }

            const uploadData = await uploadRes.json()
            setUploadedDocInfo(uploadData)

            // Step C: Complete / Finalize Submission for Admin Verification
            const completeRes = await fetch(`${BASE_URL}/verification/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: token })
            })

            if (completeRes.ok) {
                toast.success("Death Certificate and verification request submitted successfully!")
                await loadDetailsAndStatus()
                setFlowStep(4)
            } else {
                const compErr = await completeRes.json().catch(() => ({}))
                toast.error(compErr.detail || "Verification submitted.")
                await loadDetailsAndStatus()
                setFlowStep(4)
            }
        } catch (e) {
            toast.error("Error submitting claim. Please try again.")
        } finally {
            setVerifying(false)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#070b11]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    if (!nomineeDetails) return null

    const ownerName = nomineeDetails.ownerName || "Account Owner"
    const ownerEmail = nomineeDetails.maskedOwnerEmail || "Registered Owner Email"

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#070b11] px-4 py-12 relative overflow-hidden text-slate-100">
            {/* Background ambient lighting */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[140px]" />
                <div className="absolute left-1/3 top-2/3 h-[500px] w-[500px] rounded-full bg-teal-500/10 blur-[120px]" />
            </div>

            <div className="relative w-full max-w-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Stepper Progress Bar */}
                <div className="mb-6 flex items-center justify-between px-2 text-xs font-semibold text-slate-400">
                    <span className={`flex items-center gap-1.5 ${flowStep >= 1 ? "text-emerald-400 font-bold" : ""}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${flowStep >= 1 ? "bg-emerald-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"}`}>1</span>
                        Owner Details
                    </span>
                    <span className="h-px flex-1 bg-slate-800 mx-2" />
                    <span className={`flex items-center gap-1.5 ${flowStep >= 2 ? "text-emerald-400 font-bold" : ""}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${flowStep >= 2 ? "bg-emerald-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"}`}>2</span>
                        Authenticate
                    </span>
                    <span className="h-px flex-1 bg-slate-800 mx-2" />
                    <span className={`flex items-center gap-1.5 ${flowStep >= 3 ? "text-emerald-400 font-bold" : ""}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${flowStep >= 3 ? "bg-emerald-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"}`}>3</span>
                        Death Certificate
                    </span>
                    <span className="h-px flex-1 bg-slate-800 mx-2" />
                    <span className={`flex items-center gap-1.5 ${flowStep >= 4 ? "text-emerald-400 font-bold" : ""}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${flowStep >= 4 ? "bg-emerald-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"}`}>4</span>
                        Verification
                    </span>
                </div>

                <Card className="border border-slate-800 bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

                    <CardContent className="p-8">
                        
                        {/* ─────────────────────────────────────────────────────────────
                            STEP 1: OWNER DETAILS & INHERITANCE NOTICE
                            ───────────────────────────────────────────────────────────── */}
                        {flowStep === 1 && (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center text-center">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10">
                                        <Shield className="h-7 w-7" />
                                    </div>
                                    <h1 className="text-2xl font-bold text-slate-100">Secure Vault Inheritance Portal</h1>
                                    <p className="mt-2 text-sm text-slate-400 max-w-md">
                                        You have been designated as a trusted nominee for a digital asset vault on SecureVault.
                                    </p>
                                </div>

                                {/* Owner Details Card */}
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
                                    <div className="flex items-center justify-between border-b border-emerald-500/15 pb-3">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Account Owner Details</span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                                            Vault Owner
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-slate-400">Owner Name</p>
                                            <p className="text-lg font-bold text-slate-100">{ownerName}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-1">
                                            <div>
                                                <p className="text-xs text-slate-400">Account Email</p>
                                                <p className="text-sm font-mono text-emerald-300">{ownerEmail}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400">Designated Nominee</p>
                                                <p className="text-sm font-medium text-slate-200">{nomineeDetails.name}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                                        ℹ️ <strong>Ownership Notice:</strong> The digital assets, credentials, and legal files inside this vault belong exclusively to <strong>{ownerName}</strong>. Following prolonged vault inactivity, you are authorized to authenticate and submit proof of death to claim inheritance.
                                    </div>
                                </div>

                                <Button
                                    onClick={() => setFlowStep(2)}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold py-6 rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-base"
                                >
                                    Proceed to Nominee Login & Authenticate <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            STEP 2: NOMINEE AUTHENTICATION / LOGIN (EMAIL OTP)
                            ───────────────────────────────────────────────────────────── */}
                        {flowStep === 2 && (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center text-center">
                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
                                        <KeyRound className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-100">Nominee Authentication</h2>
                                    <p className="mt-1 text-xs text-slate-400">
                                        Authenticate your email address to confirm identity before accessing the claim form.
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-2 text-xs">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Vault Owner:</span>
                                        <span className="font-semibold text-slate-200">{ownerName}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Nominee Email:</span>
                                        <span className="font-mono text-emerald-400">{nomineeDetails.maskedEmail}</span>
                                    </div>
                                </div>

                                {!otpSent ? (
                                    <div className="space-y-4 pt-2">
                                        <p className="text-xs text-slate-300 text-center">
                                            We will send a 6-digit authentication security code to <strong>{nomineeDetails.maskedEmail}</strong>.
                                        </p>
                                        <Button
                                            onClick={handleSendOTP}
                                            disabled={verifying}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-5 rounded-xl"
                                        >
                                            {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Mail className="h-5 w-5 mr-2" />}
                                            Send Authentication Code
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleVerifyOTP} className="space-y-4 pt-2">
                                        <div className="space-y-2 text-center">
                                            <Label htmlFor="otpCode" className="text-xs text-slate-300">Enter 6-Digit Verification Code</Label>
                                            <Input
                                                id="otpCode"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                placeholder="123456"
                                                maxLength={6}
                                                className="text-center font-mono text-2xl tracking-[10px] py-6 border-slate-700 bg-slate-950 text-emerald-400 focus:border-emerald-500"
                                                autoFocus
                                                required
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={verifying || otp.length < 6}
                                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-5 rounded-xl"
                                        >
                                            {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <UserCheck className="h-5 w-5 mr-2" />}
                                            Verify Code & Login
                                        </Button>

                                        <div className="flex justify-between items-center text-xs text-slate-400 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setFlowStep(1)}
                                                className="hover:text-slate-200 underline"
                                            >
                                                ← Back to Owner Details
                                            </button>
                                            {timer > 0 ? (
                                                <span>Resend code in {timer}s</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleSendOTP}
                                                    className="text-emerald-400 hover:underline font-medium"
                                                >
                                                    Resend Code
                                                </button>
                                            )}
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            STEP 3: DEATH CERTIFICATE & CLAIM FORM
                            ───────────────────────────────────────────────────────────── */}
                        {flowStep === 3 && (
                            <form onSubmit={handleSubmitDeathCertificateForm} className="space-y-5">
                                <div className="flex flex-col items-center text-center mb-2">
                                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                        <FileCheck className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-100">Death Certificate Submission Form</h2>
                                    <p className="text-xs text-slate-400">
                                        Submit legal proof of death for account owner <strong>{ownerName}</strong>
                                    </p>
                                </div>

                                {/* Claimant Details */}
                                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                        <UserCheck className="h-4 w-4" /> 1. Claimant Information
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="claimedByName" className="text-xs">Your Full Name *</Label>
                                            <Input
                                                id="claimedByName"
                                                value={claimForm.claimedByName}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByName: e.target.value})}
                                                placeholder="Claimant Name"
                                                className="bg-slate-900 border-slate-700 text-xs h-9"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="claimedByRelation" className="text-xs">Relationship to Owner *</Label>
                                            <Input
                                                id="claimedByRelation"
                                                value={claimForm.claimedByRelation}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByRelation: e.target.value})}
                                                placeholder="Spouse / Child / Executor"
                                                className="bg-slate-900 border-slate-700 text-xs h-9"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="claimedByEmail" className="text-xs">Contact Email *</Label>
                                            <Input
                                                id="claimedByEmail"
                                                type="email"
                                                value={claimForm.claimedByEmail}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByEmail: e.target.value})}
                                                className="bg-slate-900 border-slate-700 text-xs h-9"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="claimedByPhone" className="text-xs">Contact Phone *</Label>
                                            <Input
                                                id="claimedByPhone"
                                                value={claimForm.claimedByPhone}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByPhone: e.target.value})}
                                                placeholder="+1 555-0199"
                                                className="bg-slate-900 border-slate-700 text-xs h-9"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Death Certificate & Event Details */}
                                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                        <FileText className="h-4 w-4" /> 2. Death Event Details
                                    </h4>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="dateOfDeath" className="text-xs">Date of Death</Label>
                                            <Input
                                                id="dateOfDeath"
                                                type="date"
                                                value={claimForm.dateOfDeath}
                                                onChange={(e) => setClaimForm({...claimForm, dateOfDeath: e.target.value})}
                                                className="bg-slate-900 border-slate-700 text-xs h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="deathCertificateNumber" className="text-xs">Certificate / Reg Number</Label>
                                            <Input
                                                id="deathCertificateNumber"
                                                value={claimForm.deathCertificateNumber}
                                                onChange={(e) => setClaimForm({...claimForm, deathCertificateNumber: e.target.value})}
                                                placeholder="e.g. DC-98765432"
                                                className="bg-slate-900 border-slate-700 text-xs h-9"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="placeOfDeath" className="text-xs">Place / Location of Death</Label>
                                        <Input
                                            id="placeOfDeath"
                                            value={claimForm.placeOfDeath}
                                            onChange={(e) => setClaimForm({...claimForm, placeOfDeath: e.target.value})}
                                            placeholder="City, State / Hospital Name"
                                            className="bg-slate-900 border-slate-700 text-xs h-9"
                                        />
                                    </div>
                                </div>

                                {/* Upload Death Certificate */}
                                <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                        <Upload className="h-4 w-4" /> 3. Upload Death Certificate *
                                    </h4>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept=".pdf,.png,.jpg,.jpeg"
                                        className="hidden"
                                    />

                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-5 text-center cursor-pointer bg-slate-950/60 transition-all"
                                    >
                                        {deathDocFile ? (
                                            <div className="flex items-center justify-center gap-2 text-emerald-400 font-medium text-xs">
                                                <FileCheck className="h-5 w-5" />
                                                <span>{deathDocFile.name} ({(deathDocFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <Upload className="h-6 w-6 text-slate-400 mx-auto" />
                                                <p className="text-xs font-medium text-slate-200">Click to Browse & Upload Official Death Certificate</p>
                                                <p className="text-[11px] text-slate-400">PDF, PNG, or JPG (Max 10MB)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={verifying}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold py-5 rounded-xl shadow-lg shadow-emerald-500/20 text-sm"
                                >
                                    {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Shield className="h-5 w-5 mr-2" />}
                                    Submit Death Certificate for Verification
                                </Button>
                            </form>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            STEP 4: SUBMISSION CONFIRMATION & VERIFICATION PENDING
                            ───────────────────────────────────────────────────────────── */}
                        {flowStep === 4 && (
                            <div className="text-center py-6 space-y-6">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-xl shadow-emerald-500/10">
                                    <CheckCircle className="h-9 w-9" />
                                </div>

                                <div className="space-y-2">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/20">
                                        <Clock className="h-3.5 w-3.5 animate-spin" /> PENDING COMPLIANCE VERIFICATION
                                    </span>
                                    <h2 className="text-2xl font-bold text-slate-100">Verification Request Submitted</h2>
                                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                        Death Certificate and claim details for <strong>{ownerName}</strong> have been recorded successfully.
                                    </p>
                                </div>

                                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl text-left space-y-2.5 text-xs text-slate-300">
                                    <div className="flex justify-between border-b border-slate-800 pb-2">
                                        <span className="text-slate-400">Account Owner:</span>
                                        <span className="font-semibold text-slate-100">{ownerName}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-800 pb-2">
                                        <span className="text-slate-400">Claimant:</span>
                                        <span className="font-semibold text-slate-100">{claimForm.claimedByName || nomineeDetails.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Status:</span>
                                        <span className="font-semibold text-emerald-400">Under Review by Compliance Team</span>
                                    </div>
                                </div>

                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Once our compliance team approves the submitted Death Certificate, you will receive full secure access instructions at <strong>{nomineeDetails.maskedEmail}</strong>.
                                </p>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
