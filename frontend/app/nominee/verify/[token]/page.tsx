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
    Clock,
    XCircle,
    AlertTriangle,
    FolderKey,
    ShieldAlert,
    RefreshCw
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
                if (statusData.hasRequest && statusData.status) {
                    const statusStr = statusData.status;
                    if (["PENDING", "PENDING_REVIEW", "UNDER_REVIEW", "APPROVED", "COOLING_PERIOD", "CLAIMED", "NOMINEE_NOTIFIED"].includes(statusStr)) {
                        router.push(`/nominee/status/${token}`)
                        return
                    } else {
                        setFlowStep(3)
                    }
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
                router.push(`/nominee/status/${token}`)
            } else {
                const compErr = await completeRes.json().catch(() => ({}))
                toast.error(compErr.detail || "Verification submitted.")
                router.push(`/nominee/status/${token}`)
            }
        } catch (e) {
            toast.error("Error submitting claim. Please try again.")
        } finally {
            setVerifying(false)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]">
                <Loader2 className="h-8 w-8 animate-spin text-black" />
            </div>
        )
    }

    if (!nomineeDetails) return null

    const ownerName = nomineeDetails.ownerName || "Account Owner"
    const ownerEmail = nomineeDetails.maskedOwnerEmail || "Registered Owner Email"

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4 py-12 relative overflow-hidden text-black font-tt-norms font-sans">
            <div className="relative w-full max-w-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Stepper Progress Bar */}
                <div className="mb-6 flex items-center justify-between px-2 text-xs font-semibold text-neutral-400">
                    <span className={`flex items-center gap-1.5 ${flowStep >= 1 ? "text-black font-bold" : ""}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${flowStep >= 1 ? "bg-black text-white font-bold" : "bg-neutral-200 text-neutral-500"}`}>1</span>
                        Owner Details
                    </span>
                    <span className="h-px flex-1 bg-neutral-200 mx-2" />
                    <span className={`flex items-center gap-1.5 ${flowStep >= 2 ? "text-black font-bold" : ""}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${flowStep >= 2 ? "bg-black text-white font-bold" : "bg-neutral-200 text-neutral-500"}`}>2</span>
                        Authenticate
                    </span>
                    <span className="h-px flex-1 bg-neutral-200 mx-2" />
                    <span className={`flex items-center gap-1.5 ${flowStep >= 3 ? "text-black font-bold" : ""}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${flowStep >= 3 ? "bg-black text-white font-bold" : "bg-neutral-200 text-neutral-500"}`}>3</span>
                        Death Certificate
                    </span>
                    <span className="h-px flex-1 bg-neutral-200 mx-2" />
                    <span className={`flex items-center gap-1.5 ${flowStep >= 4 ? "text-black font-bold" : ""}`}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${flowStep >= 4 ? "bg-black text-white font-bold" : "bg-neutral-200 text-neutral-500"}`}>4</span>
                        Verification
                    </span>
                </div>

                <Card className="border border-black/8 bg-white rounded-3xl shadow-xl relative overflow-hidden">
                    <CardContent className="p-8">
                        
                        {/* ─────────────────────────────────────────────────────────────
                            STEP 1: OWNER DETAILS & INHERITANCE NOTICE
                            ───────────────────────────────────────────────────────────── */}
                        {flowStep === 1 && (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center text-center">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-black/8 text-black shadow-xs">
                                        <Shield className="h-7 w-7" />
                                    </div>
                                    <h1 className="text-2xl font-bold text-black">Secure Vault Inheritance Portal</h1>
                                    <p className="mt-2 text-sm text-neutral-500 max-w-md">
                                        You have been designated as a trusted nominee for a digital asset vault on SecureVault.
                                    </p>
                                </div>

                                {/* Owner Details Card */}
                                <div className="rounded-2xl border border-black/8 bg-neutral-50 p-6 space-y-4">
                                    <div className="flex items-center justify-between border-b border-black/8 pb-3">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Account Owner Details</span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                                            Vault Owner
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-neutral-500">Owner Name</p>
                                            <p className="text-lg font-bold text-black">{ownerName}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-1">
                                            <div>
                                                <p className="text-xs text-neutral-500">Account Email</p>
                                                <p className="text-sm font-mono text-black font-medium">{ownerEmail}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-neutral-500">Designated Nominee</p>
                                                <p className="text-sm font-medium text-black">{nomineeDetails.name}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl bg-white p-3.5 border border-black/8 text-xs text-neutral-600 leading-relaxed shadow-2xs">
                                        ℹ️ <strong>Ownership Notice:</strong> The digital assets, credentials, and legal files inside this vault belong exclusively to <strong>{ownerName}</strong>. Following prolonged vault inactivity, you are authorized to authenticate and submit proof of death to claim inheritance.
                                    </div>
                                </div>

                                <Button
                                    onClick={() => setFlowStep(2)}
                                    className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full shadow-sm transition-all text-base"
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
                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 border border-black/8 text-black">
                                        <KeyRound className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-black">Nominee Authentication</h2>
                                    <p className="mt-1 text-xs text-neutral-500">
                                        Authenticate your email address to confirm identity before accessing the claim form.
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-black/8 bg-neutral-50 p-4 space-y-2 text-xs">
                                    <div className="flex justify-between text-neutral-500">
                                        <span>Vault Owner:</span>
                                        <span className="font-semibold text-black">{ownerName}</span>
                                    </div>
                                    <div className="flex justify-between text-neutral-500">
                                        <span>Nominee Email:</span>
                                        <span className="font-mono text-black font-semibold">{nomineeDetails.maskedEmail}</span>
                                    </div>
                                </div>

                                {!otpSent ? (
                                    <div className="space-y-4 pt-2">
                                        <p className="text-xs text-neutral-600 text-center">
                                            We will send a 6-digit authentication security code to <strong>{nomineeDetails.maskedEmail}</strong>.
                                        </p>
                                        <Button
                                            onClick={handleSendOTP}
                                            disabled={verifying}
                                            className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full"
                                        >
                                            {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Mail className="h-5 w-5 mr-2" />}
                                            Send Authentication Code
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleVerifyOTP} className="space-y-4 pt-2">
                                        <div className="space-y-2 text-center">
                                            <Label htmlFor="otpCode" className="text-xs text-neutral-600">Enter 6-Digit Verification Code</Label>
                                            <Input
                                                id="otpCode"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                placeholder="123456"
                                                maxLength={6}
                                                className="text-center font-mono text-2xl tracking-[10px] py-4 rounded-full border-black/15 bg-white text-black focus:border-black"
                                                autoFocus
                                                required
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={verifying || otp.length < 6}
                                            className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full"
                                        >
                                            {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <UserCheck className="h-5 w-5 mr-2" />}
                                            Verify Code & Login
                                        </Button>

                                        <div className="flex justify-between items-center text-xs text-neutral-500 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setFlowStep(1)}
                                                className="hover:text-black underline"
                                            >
                                                ← Back to Owner Details
                                            </button>
                                            {timer > 0 ? (
                                                <span>Resend code in {timer}s</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleSendOTP}
                                                    className="text-black hover:underline font-semibold"
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
                                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 border border-black/8 text-black">
                                        <FileCheck className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-black">Death Certificate Submission Form</h2>
                                    <p className="text-xs text-neutral-500">
                                        Submit legal proof of death for account owner <strong>{ownerName}</strong>
                                    </p>
                                </div>

                                {/* Claimant Details */}
                                <div className="space-y-3 rounded-2xl border border-black/8 bg-neutral-50 p-5">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <UserCheck className="h-4 w-4" /> 1. Claimant Information
                                    </h4>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="claimedByName" className="text-xs text-neutral-600">Your Full Name *</Label>
                                            <Input
                                                id="claimedByName"
                                                value={claimForm.claimedByName}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByName: e.target.value})}
                                                placeholder="Claimant Name"
                                                className="bg-white border-black/15 text-xs h-10 rounded-full text-black"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="claimedByRelation" className="text-xs text-neutral-600">Relationship to Owner *</Label>
                                            <Input
                                                id="claimedByRelation"
                                                value={claimForm.claimedByRelation}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByRelation: e.target.value})}
                                                placeholder="Spouse / Child / Executor"
                                                className="bg-white border-black/15 text-xs h-10 rounded-full text-black"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="claimedByEmail" className="text-xs text-neutral-600">Contact Email *</Label>
                                            <Input
                                                id="claimedByEmail"
                                                type="email"
                                                value={claimForm.claimedByEmail}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByEmail: e.target.value})}
                                                className="bg-white border-black/15 text-xs h-10 rounded-full text-black"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="claimedByPhone" className="text-xs text-neutral-600">Contact Phone *</Label>
                                            <Input
                                                id="claimedByPhone"
                                                value={claimForm.claimedByPhone}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByPhone: e.target.value})}
                                                placeholder="+1 555-0199"
                                                className="bg-white border-black/15 text-xs h-10 rounded-full text-black"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Death Certificate & Event Details */}
                                <div className="space-y-3 rounded-2xl border border-black/8 bg-neutral-50 p-5">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <FileText className="h-4 w-4" /> 2. Death Event Details
                                    </h4>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="dateOfDeath" className="text-xs text-neutral-600">Date of Death</Label>
                                            <Input
                                                id="dateOfDeath"
                                                type="date"
                                                value={claimForm.dateOfDeath}
                                                onChange={(e) => setClaimForm({...claimForm, dateOfDeath: e.target.value})}
                                                className="bg-white border-black/15 text-xs h-10 rounded-full text-black"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="deathCertificateNumber" className="text-xs text-neutral-600">Certificate / Reg Number</Label>
                                            <Input
                                                id="deathCertificateNumber"
                                                value={claimForm.deathCertificateNumber}
                                                onChange={(e) => setClaimForm({...claimForm, deathCertificateNumber: e.target.value})}
                                                placeholder="e.g. DC-98765432"
                                                className="bg-white border-black/15 text-xs h-10 rounded-full text-black"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label htmlFor="placeOfDeath" className="text-xs text-neutral-600">Place / Location of Death</Label>
                                        <Input
                                            id="placeOfDeath"
                                            value={claimForm.placeOfDeath}
                                            onChange={(e) => setClaimForm({...claimForm, placeOfDeath: e.target.value})}
                                            placeholder="City, State / Hospital Name"
                                            className="bg-white border-black/15 text-xs h-10 rounded-full text-black"
                                        />
                                    </div>
                                </div>

                                {/* Upload Death Certificate */}
                                <div className="space-y-3 rounded-2xl border border-black/8 bg-neutral-50 p-5">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-black flex items-center gap-1.5">
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
                                        className="border-2 border-dashed border-black/20 hover:border-black rounded-2xl p-6 text-center cursor-pointer bg-white transition-all shadow-2xs"
                                    >
                                        {deathDocFile ? (
                                            <div className="flex items-center justify-center gap-2 text-black font-medium text-xs">
                                                <FileCheck className="h-5 w-5 text-emerald-600" />
                                                <span>{deathDocFile.name} ({(deathDocFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <Upload className="h-6 w-6 text-neutral-400 mx-auto" />
                                                <p className="text-xs font-medium text-black">Click to Browse & Upload Official Death Certificate</p>
                                                <p className="text-[11px] text-neutral-500">PDF, PNG, or JPG (Max 10MB)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={verifying}
                                    className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full shadow-sm text-sm"
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
                                {requestStatus?.status === "APPROVED" && (
                                    <>
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm">
                                            <CheckCircle className="h-9 w-9" />
                                        </div>
                                        <div className="space-y-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                                CLAIM APPROVED ✅
                                            </span>
                                            <h2 className="text-2xl font-bold text-black">Verification Approved</h2>
                                            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                                                Your death verification request for <strong>{ownerName}</strong> has been approved by the compliance team.
                                            </p>
                                        </div>
                                        <div className="bg-neutral-50 border border-black/8 p-5 rounded-2xl text-left space-y-2.5 text-xs text-neutral-700">
                                            <p className="text-neutral-500 leading-relaxed mb-2">
                                                Access to your assigned inherited digital assets has been unlocked.
                                            </p>
                                            <div className="flex justify-between border-t border-black/8 pt-2">
                                                <span className="text-neutral-500">Owner Name:</span>
                                                <span className="font-semibold text-black">{ownerName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-500">Access Mode:</span>
                                                <span className="font-semibold text-black font-mono">View-Only (No Download)</span>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => {
                                                sessionStorage.setItem(`sv_nominee_token_${token}`, token);
                                                router.push(`/nominee/vault/${token}`);
                                            }}
                                            className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full shadow-sm text-sm"
                                        >
                                            <FolderKey className="h-5 w-5 mr-2" /> Access Approved Inherited Assets
                                        </Button>
                                    </>
                                )}

                                {requestStatus?.status === "REJECTED" && (
                                    <>
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 border border-red-200 text-red-600 shadow-sm">
                                            <XCircle className="h-9 w-9" />
                                        </div>
                                        <div className="space-y-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 border border-red-200">
                                                CLAIM REJECTED ❌
                                            </span>
                                            <h2 className="text-2xl font-bold text-black">Verification Rejected</h2>
                                            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                                                Your death verification request for <strong>{ownerName}</strong> could not be approved by compliance.
                                            </p>
                                        </div>
                                        <div className="bg-red-50 border border-red-200 p-5 rounded-2xl text-left space-y-2.5 text-xs text-red-800">
                                            <p className="font-bold text-red-700">Rejection Reason / Guidance:</p>
                                            <p className="italic leading-relaxed">{requestStatus?.remarks || "The uploaded death certificate details could not be verified. Please ensure the uploaded file is legible and correct."}</p>
                                        </div>
                                        <Button
                                            onClick={() => {
                                                setFlowStep(3); // Reset to Step 3 for resubmission
                                                setDeathDocFile(null);
                                            }}
                                            className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full shadow-sm text-sm"
                                        >
                                            <RefreshCw className="h-5 w-5 mr-2" /> Resubmit Claim & Upload Documents
                                        </Button>
                                    </>
                                )}

                                {requestStatus?.status === "MORE_DOCUMENTS_REQUIRED" && (
                                    <>
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 shadow-sm">
                                            <AlertTriangle className="h-9 w-9" />
                                        </div>
                                        <div className="space-y-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                                                ADDITIONAL EVIDENCE REQUESTED
                                            </span>
                                            <h2 className="text-2xl font-bold text-black">Documents Required</h2>
                                            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                                                Compliance requires further evidence to verify the claim.
                                            </p>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-left space-y-2.5 text-xs text-amber-800">
                                            <p className="font-bold text-amber-700">Message from Compliance:</p>
                                            <p className="italic leading-relaxed">{requestStatus?.remarks || "Please upload relationship proof or matching official ID."}</p>
                                        </div>
                                        <Button
                                            onClick={() => {
                                                setFlowStep(3); // Route to upload area
                                                setDeathDocFile(null);
                                            }}
                                            className="w-full bg-black hover:bg-neutral-800 text-white font-bold py-4 rounded-full shadow-sm text-sm"
                                        >
                                            <Upload className="h-5 w-5 mr-2" /> Upload Supporting Documents
                                        </Button>
                                    </>
                                )}

                                {requestStatus?.status !== "APPROVED" && requestStatus?.status !== "REJECTED" && requestStatus?.status !== "MORE_DOCUMENTS_REQUIRED" && (
                                    <>
                                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 border border-black/8 text-black shadow-sm">
                                            <CheckCircle className="h-9 w-9" />
                                        </div>

                                        <div className="space-y-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                                                <Clock className="h-3.5 w-3.5 animate-spin" /> PENDING COMPLIANCE VERIFICATION
                                            </span>
                                            <h2 className="text-2xl font-bold text-black">Verification Request Submitted</h2>
                                            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                                                Death Certificate and claim details for <strong>{ownerName}</strong> have been recorded successfully.
                                            </p>
                                        </div>

                                        <div className="bg-neutral-50 border border-black/8 p-5 rounded-2xl text-left space-y-2.5 text-xs text-neutral-700">
                                            <div className="flex justify-between border-b border-black/8 pb-2">
                                                <span className="text-neutral-500">Account Owner:</span>
                                                <span className="font-semibold text-black">{ownerName}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-black/8 pb-2">
                                                <span className="text-neutral-500">Claimant:</span>
                                                <span className="font-semibold text-black">{claimForm.claimedByName || nomineeDetails.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-500">Status:</span>
                                                <span className="font-semibold text-emerald-700">
                                                    {requestStatus?.status === "UNDER_REVIEW" ? "Under Active Review by Compliance Team" : "Pending Review by Compliance Team"}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-xs text-neutral-500 leading-relaxed">
                                            Once our compliance team approves the submitted Death Certificate, you will receive full secure access instructions at <strong>{nomineeDetails.maskedEmail}</strong>.
                                        </p>
                                    </>
                                )}
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
