"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    Shield,
    Mail,
    Phone,
    FileText,
    Camera,
    Loader2,
    CheckCircle,
    XCircle,
    AlertCircle,
    Upload,
    ArrowRight,
    Lock,
    Trash2,
    Clock,
    UserCheck,
    FileCheck
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
    const [nomineeDetails, setNomineeDetails] = useState<{ name: string; maskedEmail: string; email: string } | null>(null)
    const [requestStatus, setRequestStatus] = useState<any>(null)

    // Form inputs / step state
    const [claimForm, setClaimForm] = useState({
        claimedByName: "",
        claimedByRelation: "",
        claimedByEmail: "",
        claimedByPhone: "",
        remarks: ""
    })

    // Stepper / Sub-step inside NOMINEE_NOTIFIED
    const [activeWizardStep, setActiveWizardStep] = useState(2) // Start from Step 2 (Email OTP)

    // OTP states
    const [otp, setOtp] = useState("")
    const [otpSent, setOtpSent] = useState(false)
    const [timer, setTimer] = useState(0)

    // Government ID verification
    const [idType, setIdType] = useState("AADHAAR")
    const [idFile, setIdFile] = useState<File | null>(null)
    const [ocrProgress, setOcrProgress] = useState(0)
    const [ocrResult, setOcrResult] = useState<any>(null)

    // Selfie verification
    const [selfieFile, setSelfieFile] = useState<File | null>(null)
    const [selfieProgress, setSelfieProgress] = useState(0)
    const [selfieResult, setSelfieResult] = useState<any>(null)

    // Death evidence uploads
    const [deathDocType, setDeathDocType] = useState("DEATH_CERTIFICATE")
    const [uploadedDeathDocs, setUploadedDeathDocs] = useState<any[]>([])
    const [uploadingDeathDoc, setUploadingDeathDoc] = useState(false)
    const [activeUploadType, setActiveUploadType] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Additional doc upload (Step 8: MORE_DOCUMENTS_REQUIRED)
    const [additionalDocFile, setAdditionalDocFile] = useState<File | null>(null)
    const [additionalDocType, setAdditionalDocType] = useState("SUPPORTING_EVIDENCE")
    const [uploadingAdditional, setUploadingAdditional] = useState(false)

    // Countdown Timer logic for OTP
    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000)
            return () => clearInterval(interval)
        }
    }, [timer])

    // Load initial nominee details and check current status
    const loadDetailsAndStatus = async () => {
        try {
            // 1. Fetch masked details
            const nomineeRes = await fetch(`${BASE_URL}/nominees/verify/${token}`)
            if (!nomineeRes.ok) {
                const err = await nomineeRes.json()
                toast.error(err.detail || "Invalid access link")
                router.push("/")
                return
            }
            const nomineeData = await nomineeRes.json()
            setNomineeDetails(nomineeData)
            setClaimForm(prev => ({
                ...prev,
                claimedByName: nomineeData.name,
                claimedByEmail: nomineeData.email
            }))

            // 2. Fetch workflow status
            const statusRes = await fetch(`${BASE_URL}/verification/status?accessToken=${token}`)
            if (statusRes.ok) {
                const statusData = await statusRes.json()
                setRequestStatus(statusData)
                if (statusData.deathEvidence) {
                    setUploadedDeathDocs(statusData.deathEvidence)
                }

                // Route automatically to active wizard sub-step based on checked list
                if (statusData.hasRequest && statusData.status === "NOMINEE_NOTIFIED") {
                    const chk = statusData.checklist
                    if (!chk.emailVerified) setActiveWizardStep(2)
                    else if (!chk.mobileVerified) setActiveWizardStep(3)
                    else if (!chk.govtIdVerified) setActiveWizardStep(4)
                    else if (!chk.faceVerified) setActiveWizardStep(5)
                    else if (chk.deathEvidenceCount === 0) setActiveWizardStep(6)
                    else setActiveWizardStep(7) // Go to final checklist
                }
            }
        } catch (error) {
            toast.error("Failed to load platform settings.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadDetailsAndStatus()
    }, [token])

    // Step 1: Submit initial claim
    const handleClaimSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!claimForm.claimedByName || !claimForm.claimedByRelation || !claimForm.claimedByEmail || !claimForm.claimedByPhone) {
            toast.error("Please fill in all claiming fields.")
            return
        }
        setVerifying(true)
        try {
            const res = await fetch(`${BASE_URL}/verification/claim`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    accessToken: token,
                    ...claimForm
                })
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Death claim submitted successfully.")
                loadDetailsAndStatus()
            } else {
                toast.error(data.detail || "Failed to submit claim.")
            }
        } catch (e) {
            toast.error("Network error submitting claim.")
        } finally {
            setVerifying(false)
        }
    }

    // Step 2 & 3: Send OTP
    const handleSendOTP = async (type: "email" | "mobile") => {
        setVerifying(true)
        try {
            const res = await fetch(`${BASE_URL}/verification/${type}/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: token })
            })
            const data = await res.json()
            if (res.ok) {
                setOtpSent(true)
                setTimer(60)
                setOtp("")
                toast.success(`Verification code sent to your registered ${type}.`)
            } else {
                toast.error(data.detail || "Failed to send verification code.")
            }
        } catch (e) {
            toast.error("Network error sending OTP.")
        } finally {
            setVerifying(false)
        }
    }

    // Step 2 & 3: Verify OTP
    const handleVerifyOTP = async (e: React.FormEvent, type: "email" | "mobile") => {
        e.preventDefault()
        if (!otp) return
        setVerifying(true)
        try {
            const res = await fetch(`${BASE_URL}/verification/${type}/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: token, otp })
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(`${type === "email" ? "Email" : "Mobile"} verified successfully.`)
                setOtpSent(false)
                setOtp("")
                loadDetailsAndStatus()
            } else {
                toast.error(data.detail || "Invalid code. Please try again.")
            }
        } catch (e) {
            toast.error("Verification failed.")
        } finally {
            setVerifying(false)
        }
    }

    // Step 4: Government ID Upload
    const handleIdUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!idFile) return
        setVerifying(true)

        // Simulated OCR progress bar animation
        setOcrProgress(10)
        const progressInterval = setInterval(() => {
            setOcrProgress(p => {
                if (p >= 90) {
                    clearInterval(progressInterval)
                    return 90
                }
                return p + 20
            })
        }, 300)

        try {
            const formData = new FormData()
            formData.append("accessToken", token)
            formData.append("documentType", idType)
            formData.append("file", idFile)

            const res = await fetch(`${BASE_URL}/verification/upload-id`, {
                method: "POST",
                body: formData
            })
            const data = await res.json()
            clearInterval(progressInterval)
            setOcrProgress(100)

            if (res.ok) {
                setOcrResult(data.ocrData)
                toast.success("ID verified successfully via OCR.")
                setTimeout(() => {
                    setIdFile(null)
                    setOcrProgress(0)
                    setOcrResult(null)
                    loadDetailsAndStatus()
                }, 2000)
            } else {
                toast.error(data.detail || "OCR extraction failed.")
                setOcrProgress(0)
            }
        } catch (e) {
            clearInterval(progressInterval)
            setOcrProgress(0)
            toast.error("ID upload failed.")
        } finally {
            setVerifying(false)
        }
    }

    // Step 5: Selfie Upload
    const handleSelfieUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selfieFile) return
        setVerifying(true)

        setSelfieProgress(20)
        const progressInterval = setInterval(() => {
            setSelfieProgress(p => {
                if (p >= 90) {
                    clearInterval(progressInterval)
                    return 90
                }
                return p + 20
            })
        }, 200)

        try {
            const formData = new FormData()
            formData.append("accessToken", token)
            formData.append("file", selfieFile)

            const res = await fetch(`${BASE_URL}/verification/upload-selfie`, {
                method: "POST",
                body: formData
            })
            const data = await res.json()
            clearInterval(progressInterval)
            setSelfieProgress(100)

            if (res.ok) {
                setSelfieResult(data.faceResult)
                toast.success("Selfie verified successfully.")
                setTimeout(() => {
                    setSelfieFile(null)
                    setSelfieProgress(0)
                    setSelfieResult(null)
                    loadDetailsAndStatus()
                }, 2000)
            } else {
                toast.error(data.detail || "Selfie matching failed.")
                setSelfieProgress(0)
            }
        } catch (e) {
            clearInterval(progressInterval)
            setSelfieProgress(0)
            toast.error("Selfie upload failed.")
        } finally {
            setVerifying(false)
        }
    }

    // Step 6: Trigger programmatically
    const triggerUpload = (type: string) => {
        setActiveUploadType(type)
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !activeUploadType) return
        setUploadingDeathDoc(true)

        try {
            const formData = new FormData()
            formData.append("accessToken", token)
            formData.append("documentType", activeUploadType)
            formData.append("file", file)

            const res = await fetch(`${BASE_URL}/verification/upload-death-document`, {
                method: "POST",
                body: formData
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(`${activeUploadType.replace(/_/g, " ")} uploaded successfully.`)
                setUploadedDeathDocs(prev => [...prev, {
                    documentId: data.documentId,
                    documentType: data.documentType,
                    fileName: file.name,
                    isPreferred: data.isPreferred
                }])
            } else {
                toast.error(data.detail || "Upload failed.")
            }
        } catch (e) {
            toast.error("Upload failed.")
        } finally {
            setUploadingDeathDoc(false)
            e.target.value = "" // Reset
        }
    }

    const handleRemoveDoc = async (documentId: string) => {
        setUploadingDeathDoc(true)
        try {
            const res = await fetch(`${BASE_URL}/verification/document/${documentId}?accessToken=${token}`, {
                method: "DELETE"
            })
            if (res.ok) {
                toast.success("Document removed successfully.")
                setUploadedDeathDocs(prev => prev.filter(d => d.documentId !== documentId))
            } else {
                const data = await res.json()
                toast.error(data.detail || "Failed to remove document.")
            }
        } catch (e) {
            toast.error("Delete failed.")
        } finally {
            setUploadingDeathDoc(false)
        }
    }

    // Finalize submission
    const handleCompleteVerification = async () => {
        setVerifying(true)
        try {
            const res = await fetch(`${BASE_URL}/verification/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken: token })
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Verification request submitted for admin review.")
                loadDetailsAndStatus()
            } else {
                toast.error(data.detail || "Failed to finalize verification.")
            }
        } catch (e) {
            toast.error("Submission failed.")
        } finally {
            setVerifying(false)
        }
    }

    // Additional document upload (Step 8: MORE_DOCUMENTS_REQUIRED)
    const handleAdditionalUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!additionalDocFile) return
        setUploadingAdditional(true)

        try {
            const formData = new FormData()
            formData.append("accessToken", token)
            formData.append("documentType", additionalDocType)
            formData.append("file", additionalDocFile)

            const res = await fetch(`${BASE_URL}/verification/additional-document`, {
                method: "POST",
                body: formData
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Additional document uploaded and request re-submitted.")
                setAdditionalDocFile(null)
                loadDetailsAndStatus()
            } else {
                toast.error(data.detail || "Failed to upload document.")
            }
        } catch (e) {
            toast.error("Upload failed.")
        } finally {
            setUploadingAdditional(false)
        }
    }

    // Continue to vault (Step 9: APPROVED)
    const handleContinueToVault = () => {
        sessionStorage.setItem(`sv_nominee_token_${token}`, token)
        router.push(`/nominee/vault/${token}`)
    }

    // Render loading state
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!nomineeDetails) return null

    const hasRequest = requestStatus?.hasRequest
    const status = requestStatus?.status

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#070b11] px-4 py-12 relative overflow-hidden">
            {/* Background glows */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/5 blur-[120px]" />
                <div className="absolute left-1/3 top-2/3 h-[500px] w-[500px] rounded-full bg-indigo-500/5 blur-[100px]" />
            </div>

            <div className="relative w-full max-w-xl z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border border-border bg-card/60 backdrop-blur-xl rounded-2xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600" />
                    
                    <CardContent className="p-8">
                        {/* ─────────────────────────────────────────────────────────────
                            SCENARIO A: No Claim Submitted Yet (Step 1)
                            ───────────────────────────────────────────────────────────── */}
                        {!hasRequest && (
                            <div>
                                <div className="mb-8 flex flex-col items-center text-center">
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shadow-lg shadow-violet-500/10">
                                        <Shield className="h-7 w-7" />
                                    </div>
                                    <h1 className="text-2xl font-bold text-foreground">Secure Access Portal</h1>
                                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                                        You have been nominated to access the digital assets of an account owner in the event of their passing.
                                    </p>
                                </div>

                                <div className="rounded-xl border border-primary/10 bg-primary/5 p-5 mb-6 text-center space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Owner</p>
                                    <h3 className="text-lg font-bold text-foreground">{nomineeDetails.name}</h3>
                                    <div className="flex justify-center items-center gap-1.5 text-xs text-muted-foreground font-mono">
                                        <span>Registered to:</span>
                                        <span className="text-violet-400">{nomineeDetails.maskedEmail}</span>
                                    </div>
                                </div>

                                <form onSubmit={handleClaimSubmit} className="space-y-4">
                                    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-2">Submit Verification Claim</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="claimedByName">Your Full Name</Label>
                                            <Input
                                                id="claimedByName"
                                                value={claimForm.claimedByName}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByName: e.target.value})}
                                                placeholder="John Doe"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="claimedByRelation">Relation to Owner</Label>
                                            <Input
                                                id="claimedByRelation"
                                                value={claimForm.claimedByRelation}
                                                onChange={(e) => setClaimForm({...claimForm, claimedByRelation: e.target.value})}
                                                placeholder="Child / Spouse / Executor"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="claimedByEmail">Contact Email</Label>
                                        <Input
                                            id="claimedByEmail"
                                            type="email"
                                            value={claimForm.claimedByEmail}
                                            onChange={(e) => setClaimForm({...claimForm, claimedByEmail: e.target.value})}
                                            placeholder="your-email@example.com"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="claimedByPhone">Contact Phone Number</Label>
                                        <Input
                                            id="claimedByPhone"
                                            value={claimForm.claimedByPhone}
                                            onChange={(e) => setClaimForm({...claimForm, claimedByPhone: e.target.value})}
                                            placeholder="+1 555-0199"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="remarks">Additional Notes (Optional)</Label>
                                        <Input
                                            id="remarks"
                                            value={claimForm.remarks}
                                            onChange={(e) => setClaimForm({...claimForm, remarks: e.target.value})}
                                            placeholder="Provide any context here..."
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={verifying}
                                        className="w-full mt-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-5 rounded-xl font-medium shadow-lg shadow-violet-500/25"
                                    >
                                        {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                        Initiate Death Claim & Notify Owner
                                    </Button>
                                </form>
                            </div>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            SCENARIO B: Cooling Period Wait Active (Step 8)
                            ───────────────────────────────────────────────────────────── */}
                        {hasRequest && status === "COOLING_PERIOD" && (
                            <div className="text-center py-6 space-y-6">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                    <Clock className="h-7 w-7 animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-foreground">30-Day Cooling Period Active</h2>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        A death claim was filed. As a critical security measure, a notification has been sent to the owner's registered contacts.
                                    </p>
                                </div>

                                <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl max-w-md mx-auto text-xs text-amber-400/90 leading-relaxed">
                                    If this request is legitimate and the owner does not halt the claim, you will receive full instructions to verify your identity and access the vault.
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    Estimated access link release: <span className="font-mono text-foreground font-semibold">{new Date(requestStatus.coolingPeriodEnd).toLocaleDateString()}</span>
                                </div>
                            </div>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            SCENARIO C: Request Halted/Cancelled by Owner
                            ───────────────────────────────────────────────────────────── */}
                        {hasRequest && status === "HALTED" && (
                            <div className="text-center py-6 space-y-6 animate-in fade-in">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                                    <Lock className="h-7 w-7" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-foreground">Access Link Halted</h2>
                                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                        The account owner has confirmed they are active and has cancelled this claim. Access has been locked for security.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            SCENARIO D: Active Verification Wizard (Steps 2 to 7)
                            ───────────────────────────────────────────────────────────── */}
                        {hasRequest && status === "NOMINEE_NOTIFIED" && (
                            <div>
                                {/* Stepper Header */}
                                <div className="mb-8 border-b border-border pb-4">
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>INHERITANCE VERIFICATION STEP {activeWizardStep - 1} OF 6</span>
                                        <span className="font-semibold text-primary">{Math.round(((activeWizardStep - 2) / 5) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-muted h-1 rounded-full mt-2 overflow-hidden">
                                        <div 
                                            className="bg-gradient-to-r from-violet-600 to-indigo-600 h-full transition-all duration-500" 
                                            style={{ width: `${((activeWizardStep - 2) / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Step 2: Email OTP */}
                                {activeWizardStep === 2 && (
                                    <div className="space-y-6">
                                        <div className="text-center space-y-2">
                                            <h2 className="text-xl font-bold text-foreground">Verify Nominee Email</h2>
                                            <p className="text-xs text-muted-foreground">
                                                We need to verify access to the email linked to this nomination.
                                            </p>
                                        </div>

                                        {!otpSent ? (
                                            <div className="space-y-4">
                                                <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-center">
                                                    <p className="text-xs text-muted-foreground font-mono">Registered Email</p>
                                                    <p className="text-base font-bold text-foreground">{nomineeDetails.maskedEmail}</p>
                                                </div>
                                                <Button
                                                    onClick={() => handleSendOTP("email")}
                                                    disabled={verifying}
                                                    className="w-full py-6 text-base font-semibold"
                                                >
                                                    {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                                    Request Verification Code
                                                </Button>
                                            </div>
                                        ) : (
                                            <form onSubmit={(e) => handleVerifyOTP(e, "email")} className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="emailOtp">Enter 6-Digit Code</Label>
                                                    <Input
                                                        id="emailOtp"
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value)}
                                                        className="text-center font-bold tracking-[0.5em] text-xl py-6"
                                                        placeholder="000000"
                                                        maxLength={6}
                                                        required
                                                    />
                                                </div>

                                                <Button
                                                    type="submit"
                                                    disabled={verifying || otp.length < 6}
                                                    className="w-full py-6 text-base"
                                                >
                                                    {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                                    Verify Email Address
                                                </Button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleSendOTP("email")}
                                                    disabled={timer > 0}
                                                    className="w-full text-center text-xs text-primary hover:underline mt-2 disabled:opacity-50"
                                                >
                                                    {timer > 0 ? `Resend code in ${timer}s` : "Resend code"}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                )}

                                {/* Step 3: Mobile OTP */}
                                {activeWizardStep === 3 && (
                                    <div className="space-y-6">
                                        <div className="text-center space-y-2">
                                            <h2 className="text-xl font-bold text-foreground">Verify Nominee Mobile</h2>
                                            <p className="text-xs text-muted-foreground">
                                                Confirm your mobile number is active to set up secure alerts.
                                            </p>
                                        </div>

                                        {!otpSent ? (
                                            <div className="space-y-4">
                                                <Button
                                                    onClick={() => handleSendOTP("mobile")}
                                                    disabled={verifying}
                                                    className="w-full py-6 text-base font-semibold"
                                                >
                                                    {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                                    Request Verification SMS Code
                                                </Button>
                                            </div>
                                        ) : (
                                            <form onSubmit={(e) => handleVerifyOTP(e, "mobile")} className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="mobileOtp">Enter 6-Digit SMS Code</Label>
                                                    <Input
                                                        id="mobileOtp"
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value)}
                                                        className="text-center font-bold tracking-[0.5em] text-xl py-6"
                                                        placeholder="000000"
                                                        maxLength={6}
                                                        required
                                                    />
                                                </div>

                                                <Button
                                                    type="submit"
                                                    disabled={verifying || otp.length < 6}
                                                    className="w-full py-6 text-base"
                                                >
                                                    {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                                    Verify Mobile Number
                                                </Button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleSendOTP("mobile")}
                                                    disabled={timer > 0}
                                                    className="w-full text-center text-xs text-primary hover:underline mt-2 disabled:opacity-50"
                                                >
                                                    {timer > 0 ? `Resend SMS in ${timer}s` : "Resend SMS code"}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                )}

                                {/* Step 4: Government ID Verification */}
                                {activeWizardStep === 4 && (
                                    <form onSubmit={handleIdUpload} className="space-y-6">
                                        <div className="text-center space-y-2">
                                            <h2 className="text-xl font-bold text-foreground">Upload Government ID</h2>
                                            <p className="text-xs text-muted-foreground">
                                                Provide a legal identification document. Details will be extracted securely using automated OCR.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            {["AADHAAR", "PASSPORT", "DRIVING_LICENSE"].map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setIdType(type)}
                                                    className={`py-3 px-1 rounded-xl text-xs font-semibold border transition-all ${
                                                        idType === type
                                                            ? "bg-violet-500/10 border-violet-500 text-violet-400"
                                                            : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    {type.replace("_", " ")}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="border border-dashed border-border rounded-xl p-8 text-center bg-background/20 relative group hover:border-violet-500/40 transition-colors">
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                required={!idFile}
                                            />
                                            <div className="space-y-2">
                                                <Upload className="mx-auto h-8 w-8 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                                                <div className="text-sm font-medium text-foreground">
                                                    {idFile ? idFile.name : "Click or drag & drop to upload ID"}
                                                </div>
                                                <p className="text-xs text-muted-foreground">PDF, PNG, or JPG (max 10MB)</p>
                                            </div>
                                        </div>

                                        {ocrProgress > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span>Simulating Secure OCR Extraction...</span>
                                                    <span>{ocrProgress}%</span>
                                                </div>
                                                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-violet-500 h-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
                                                </div>
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            disabled={verifying || !idFile}
                                            className="w-full py-6 text-base font-semibold"
                                        >
                                            {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                            Process ID Verification
                                        </Button>
                                    </form>
                                )}

                                {/* Step 5: Selfie Verification */}
                                {activeWizardStep === 5 && (
                                    <form onSubmit={handleSelfieUpload} className="space-y-6">
                                        <div className="text-center space-y-2">
                                            <h2 className="text-xl font-bold text-foreground">Take a Selfie</h2>
                                            <p className="text-xs text-muted-foreground">
                                                Upload or capture a clear photo of your face. We use biometric liveness detection to match this with your government ID.
                                            </p>
                                        </div>

                                        <div className="border border-dashed border-border rounded-xl p-8 text-center bg-background/20 relative group hover:border-violet-500/40 transition-colors">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="user"
                                                onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                required={!selfieFile}
                                            />
                                            <div className="space-y-2">
                                                <Camera className="mx-auto h-8 w-8 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                                                <div className="text-sm font-medium text-foreground">
                                                    {selfieFile ? selfieFile.name : "Capture using Camera / Upload Photo"}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Biometric face match verification</p>
                                            </div>
                                        </div>

                                        {selfieProgress > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span>Performing Liveness Matching...</span>
                                                    <span>{selfieProgress}%</span>
                                                </div>
                                                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-violet-500 h-full transition-all duration-300" style={{ width: `${selfieProgress}%` }} />
                                                </div>
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            disabled={verifying || !selfieFile}
                                            className="w-full py-6 text-base font-semibold"
                                        >
                                            {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                            Submit & Verify Face
                                        </Button>
                                    </form>
                                )}

                                {/* Step 6: Death evidence uploads */}
                                {activeWizardStep === 6 && (
                                    <div className="space-y-6">
                                        <div className="text-center space-y-2">
                                            <h2 className="text-xl font-bold text-foreground">Upload Death Evidence</h2>
                                            <p className="text-xs text-muted-foreground">
                                                Please submit documents verifying the account owner's passing.
                                            </p>
                                        </div>

                                        {/* Hidden file input */}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            className="hidden"
                                            accept="image/*,application/pdf"
                                        />

                                        {/* Primary/Preferred section */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider text-left">Preferred Evidence (Recommended)</h3>
                                            <div className="space-y-2">
                                                {[
                                                    { type: "DEATH_CERTIFICATE", label: "Official Death Certificate", desc: "Preferred primary proof" },
                                                    { type: "DEATH_REGISTRATION", label: "Govt Death Registration Document", desc: "Official government registration copy" }
                                                ].map(item => {
                                                    const uploaded = uploadedDeathDocs.find(d => d.documentType === item.type)
                                                    return (
                                                        <div key={item.type} className="flex items-center justify-between p-4 rounded-xl border border-border bg-background/20 hover:border-violet-500/20 transition-colors">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <FileText className={`h-5 w-5 shrink-0 ${uploaded ? "text-emerald-400" : "text-muted-foreground"}`} />
                                                                <div className="text-left truncate pr-2">
                                                                    <p className="text-sm font-semibold text-foreground leading-none">{item.label}</p>
                                                                    {uploaded ? (
                                                                        <p className="text-xs text-emerald-400 font-medium truncate flex items-center gap-1 mt-1 font-mono">
                                                                            <CheckCircle className="h-3.5 w-3.5" />
                                                                            {uploaded.fileName}
                                                                        </p>
                                                                    ) : (
                                                                        <p className="text-[10px] text-muted-foreground mt-1">{item.desc}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {uploaded ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleRemoveDoc(uploaded.documentId)}
                                                                    disabled={uploadingDeathDoc}
                                                                    className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => triggerUpload(item.type)}
                                                                    disabled={uploadingDeathDoc}
                                                                    className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 shrink-0"
                                                                >
                                                                    {uploadingDeathDoc && activeUploadType === item.type ? (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <>
                                                                            <Upload className="h-3.5 w-3.5 mr-1" />
                                                                            Upload
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Alternative Evidence Section */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider text-left">Alternative Supporting Evidence</h3>
                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                                {[
                                                    { type: "HOSPITAL_RECORD", label: "Hospital Death Record", desc: "Medical report / cause of death" },
                                                    { type: "CREMATION_CERTIFICATE", label: "Cremation/Burial Certificate", desc: "Official copy from crematorium / cemetery" },
                                                    { type: "FUNERAL_CERTIFICATE", label: "Funeral Home Receipt", desc: "Receipt or service card" },
                                                    { type: "OBITUARY", label: "Obituary Document", desc: "Published obituary scan or pdf" },
                                                    { type: "PROBATE_DOC", label: "Probate Document", desc: "Validated probate court copy" },
                                                    { type: "EXECUTOR_LETTER", label: "Letter of Executorship", desc: "Legal executor certificate" },
                                                    { type: "COURT_ORDER", label: "Court Order", desc: "Judicial order regarding succession" },
                                                    { type: "AFFIDAVIT", label: "Sworn Lawyer Affidavit", desc: "Notarized affidavit copy" },
                                                    { type: "NEWSPAPER_NOTICE", label: "Newspaper Notice", desc: "Clipping / publication scan" },
                                                    { type: "SUPPORTING_EVIDENCE", label: "Other Supporting Evidence", desc: "Any other relevant document" }
                                                ].map(item => {
                                                    const uploaded = uploadedDeathDocs.find(d => d.documentType === item.type)
                                                    return (
                                                        <div key={item.type} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/20 hover:border-violet-500/20 transition-colors">
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <FileText className={`h-4 w-4 shrink-0 ${uploaded ? "text-emerald-400" : "text-muted-foreground"}`} />
                                                                <div className="text-left truncate pr-2">
                                                                    <p className="text-xs font-semibold text-foreground leading-none">{item.label}</p>
                                                                    {uploaded ? (
                                                                        <p className="text-[10px] text-emerald-400 font-medium truncate flex items-center gap-1 mt-1 font-mono">
                                                                            <CheckCircle className="h-3 w-3" />
                                                                            {uploaded.fileName}
                                                                        </p>
                                                                    ) : (
                                                                        <p className="text-[9px] text-muted-foreground mt-1">{item.desc}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {uploaded ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleRemoveDoc(uploaded.documentId)}
                                                                    disabled={uploadingDeathDoc}
                                                                    className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0 h-7 w-7"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => triggerUpload(item.type)}
                                                                    disabled={uploadingDeathDoc}
                                                                    className="border-violet-500/20 text-violet-400 hover:bg-violet-500/10 shrink-0 h-8 text-[11px]"
                                                                >
                                                                    {uploadingDeathDoc && activeUploadType === item.type ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        <>
                                                                            <Upload className="h-3 w-3 mr-1" />
                                                                            Upload
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <Button
                                            onClick={() => {
                                                if (uploadedDeathDocs.length === 0) {
                                                    toast.error("Please upload at least one piece of death evidence.")
                                                    return
                                                }
                                                loadDetailsAndStatus()
                                            }}
                                            className="w-full py-6 text-base font-semibold"
                                        >
                                            Next Step — Review Submission <ArrowRight className="h-4 w-4 ml-2" />
                                        </Button>
                                    </div>
                                )}

                                {/* Step 7: Review checklist and finalize */}
                                {activeWizardStep === 7 && (
                                    <div className="space-y-6 animate-in fade-in">
                                        <div className="text-center space-y-2">
                                            <h2 className="text-xl font-bold text-foreground">Review & Submit</h2>
                                            <p className="text-xs text-muted-foreground">
                                                Verify that all verification requirements are met before final submission.
                                            </p>
                                        </div>

                                        <div className="space-y-3 bg-background/40 border border-border rounded-xl p-5">
                                            <div className="flex justify-between items-center py-2 border-b border-border/40">
                                                <span className="text-sm font-medium text-foreground">Email Verified</span>
                                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-border/40">
                                                <span className="text-sm font-medium text-foreground">Mobile Verified</span>
                                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-border/40">
                                                <span className="text-sm font-medium text-foreground">Government ID Verified</span>
                                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-border/40">
                                                <span className="text-sm font-medium text-foreground">Biometric Face Match Verified</span>
                                                <CheckCircle className="h-5 w-5 text-emerald-400" />
                                            </div>
                                            <div className="flex justify-between items-center py-2">
                                                <span className="text-sm font-medium text-foreground">Death Evidence Documents</span>
                                                <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
                                                    <span>{requestStatus?.checklist?.deathEvidenceCount || uploadedDeathDocs.length} Uploaded</span>
                                                    <CheckCircle className="h-5 w-5" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 flex gap-3 text-xs text-muted-foreground items-start">
                                            <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                            <p>
                                                <strong>Estimated Manual Review Time:</strong> SecureVault security officers typically review and approve inheritance access requests within <strong>3 business days</strong>.
                                            </p>
                                        </div>

                                        <Button
                                            onClick={handleCompleteVerification}
                                            disabled={verifying}
                                            className="w-full py-6 text-base font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                                        >
                                            {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                            Submit Request for Administrative Review
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            SCENARIO E: Request Pending Review (Step 8)
                            ───────────────────────────────────────────────────────────── */}
                        {hasRequest && status === "PENDING_REVIEW" && (
                            <div className="text-center py-6 space-y-6 animate-in fade-in">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 shadow-lg shadow-violet-500/10">
                                    <Clock className="h-7 w-7 animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-foreground">Verification Under Review</h2>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        Your submitted checklist is currently being manually reviewed by our compliance administrators.
                                    </p>
                                </div>

                                <div className="space-y-3 max-w-md mx-auto bg-background/30 border border-border p-4 rounded-xl text-left text-xs space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Request ID:</span>
                                        <span className="font-mono text-foreground">{requestStatus.requestId}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Estimated response:</span>
                                        <span className="text-primary font-semibold">1-3 Business Days</span>
                                    </div>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    You will receive a notification via email once this review is complete.
                                </p>
                            </div>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            SCENARIO F: Additional Documents Required (Step 8)
                            ───────────────────────────────────────────────────────────── */}
                        {hasRequest && status === "MORE_DOCUMENTS_REQUIRED" && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="text-center space-y-2">
                                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/10">
                                        <AlertCircle className="h-7 w-7" />
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">Additional Evidence Required</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Our administrative review team requires additional supporting documentation to process this inheritance claim.
                                    </p>
                                </div>

                                {requestStatus.reviewHistory?.length > 0 && (
                                    <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl text-xs text-amber-400">
                                        <strong>Admin comments:</strong>
                                        <p className="mt-1 leading-relaxed">
                                            "{requestStatus.reviewHistory[requestStatus.reviewHistory.length - 1].remarks}"
                                        </p>
                                    </div>
                                )}

                                <form onSubmit={handleAdditionalUpload} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="addDocType">Document Type</Label>
                                        <select
                                            id="addDocType"
                                            value={additionalDocType}
                                            onChange={(e) => setAdditionalDocType(e.target.value)}
                                            className="w-full bg-input border border-border text-foreground text-sm rounded-lg p-2.5 outline-none focus:border-violet-500"
                                        >
                                            <option value="DEATH_CERTIFICATE">Official Death Certificate</option>
                                            <option value="DEATH_REGISTRATION">Govt Death Registration Document</option>
                                            <option value="HOSPITAL_RECORD">Hospital Death Record</option>
                                            <option value="CREMATION_CERTIFICATE">Cremation/Burial Certificate</option>
                                            <option value="OBITUARY">Obituary Document</option>
                                            <option value="PROBATE_DOC">Probate Document</option>
                                            <option value="SUPPORTING_EVIDENCE">Other Supporting Evidence</option>
                                        </select>
                                    </div>

                                    <div className="border border-dashed border-border rounded-xl p-8 text-center bg-background/20 relative group hover:border-violet-500/40 transition-colors">
                                        <input
                                            type="file"
                                            accept="image/*,application/pdf"
                                            onChange={(e) => setAdditionalDocFile(e.target.files?.[0] || null)}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            required
                                        />
                                        <div className="space-y-2">
                                            <Upload className="mx-auto h-8 w-8 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                                            <div className="text-sm font-medium text-foreground">
                                                {additionalDocFile ? additionalDocFile.name : "Click or drag to upload additional doc"}
                                            </div>
                                            <p className="text-xs text-muted-foreground">PDF, PNG, or JPG (max 10MB)</p>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={uploadingAdditional || !additionalDocFile}
                                        className="w-full py-6 text-base font-semibold"
                                    >
                                        {uploadingAdditional ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                                        Re-Submit Request for Review
                                    </Button>
                                </form>
                            </div>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            SCENARIO G: Request Rejected by Reviewers
                            ───────────────────────────────────────────────────────────── */}
                        {hasRequest && status === "REJECTED" && (
                            <div className="text-center py-6 space-y-6 animate-in fade-in">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400 shadow-lg shadow-red-500/10">
                                    <XCircle className="h-7 w-7" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-foreground">Verification Rejected</h2>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        Your request for inheritance access was declined during compliance verification.
                                    </p>
                                </div>

                                {requestStatus.reviewHistory?.length > 0 && (
                                    <div className="bg-red-500/5 border border-red-500/15 p-4 rounded-xl max-w-md mx-auto text-left text-xs text-red-400">
                                        <strong>Rejection Reason:</strong>
                                        <p className="mt-1 leading-relaxed">
                                            "{requestStatus.reviewHistory[requestStatus.reviewHistory.length - 1].remarks}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ─────────────────────────────────────────────────────────────
                            SCENARIO H: Request Approved (Step 9)
                            ───────────────────────────────────────────────────────────── */}
                        {hasRequest && status === "APPROVED" && (
                            <div className="text-center py-6 space-y-6 animate-in fade-in">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10">
                                    <UserCheck className="h-9 w-9 animate-bounce" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-foreground">Verification Successful</h2>
                                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                        Your inheritance access has been verified and authorized by our security officers.
                                    </p>
                                </div>

                                <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-xl max-w-md mx-auto text-xs text-emerald-400 leading-relaxed flex gap-2.5 items-start text-left">
                                    <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                                    <div>
                                        <strong>Decryption Session Active:</strong> A secure access link has been generated. Press the button below to view the released assets in your nominee dashboard.
                                    </div>
                                </div>

                                <Button
                                    onClick={handleContinueToVault}
                                    className="w-full py-6 text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all"
                                >
                                    Continue to SecureVault <ArrowRight className="h-5 w-5 ml-2" />
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
