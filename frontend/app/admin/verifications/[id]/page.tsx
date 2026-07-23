"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { 
  ArrowLeft,
  User,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  FileSearch,
  Activity,
  History,
  AlertTriangle
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

import { 
  fetchVerificationDetail,
  assignVerification,
  reviewVerification,
  getVerificationFileUrl,
  getVerificationDocumentUrl,
  VerificationDetail
} from "@/lib/verification-api"
import { VerificationStatusBadge } from "@/components/admin/verification-status-badge"
import { VerificationDocumentViewer } from "@/components/admin/verification-document-viewer"
import { VerificationActionDialog } from "@/components/admin/verification-action-dialog"

export default function VerificationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [data, setData] = useState<VerificationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  
  // Action Dialog State
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState<"APPROVE" | "REJECT" | "REQUEST_MORE_DOCS" | null>(null)

  useEffect(() => {
    loadDetail()
  }, [id])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const result = await fetchVerificationDetail(id)
      setData(result)
    } catch (error: any) {
      toast.error(error.message || "Failed to load verification detail")
      router.push("/admin/verifications")
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = async () => {
    setClaiming(true)
    try {
      await assignVerification(id)
      toast.success("Request claimed successfully")
      await loadDetail()
    } catch (error: any) {
      toast.error(error.message || "Failed to claim request")
    } finally {
      setClaiming(false)
    }
  }

  const openActionDialog = (action: "APPROVE" | "REJECT" | "REQUEST_MORE_DOCS") => {
    setCurrentAction(action)
    setActionDialogOpen(true)
  }

  const handleActionConfirm = async (remarks: string) => {
    if (!currentAction) return
    try {
      await reviewVerification(id, currentAction, remarks)
      toast.success(`Verification ${currentAction.toLowerCase()} successfully`)
      await loadDetail()
    } catch (error: any) {
      toast.error(error.message || `Failed to ${currentAction.toLowerCase()} request`)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    try {
      return format(parseISO(dateString.replace("Z", "+00:00")), "MMM d, yyyy h:mm a")
    } catch (e) {
      return dateString
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full bg-muted/50" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded bg-muted/50" />
            <Skeleton className="h-4 w-32 rounded bg-muted/50" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Skeleton className="h-64 w-full rounded-xl bg-muted/50" />
            <Skeleton className="h-64 w-full rounded-xl bg-muted/50" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[600px] w-full rounded-xl bg-muted/50" />
          </div>
        </div>
      </div>
    )
  }

  const v = data.verification
  const o = data.owner
  const n = data.nominee
  const logs = data.auditLogs

  const canClaim = v.status === "PENDING" || v.status === "MORE_DOCUMENTS_REQUIRED"
  const canReview = v.status === "UNDER_REVIEW"

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <VerificationActionDialog
        open={actionDialogOpen}
        onOpenChange={setActionDialogOpen}
        action={currentAction}
        onConfirm={handleActionConfirm}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/verifications")} className="rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
              Review Request
              <VerificationStatusBadge status={v.status} className="text-sm px-2 py-0.5" />
            </h2>
            <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
              <span className="font-mono">{v.id}</span>
              <span>•</span>
              Submitted {formatDate(v.createdAt)}
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {canClaim && (
            <Button onClick={handleClaim} disabled={claiming} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white">
              {claiming ? "Claiming..." : "Claim for Review"}
            </Button>
          )}
          {canReview && (
            <>
              <Button variant="outline" onClick={() => openActionDialog("REQUEST_MORE_DOCS")} className="w-full md:w-auto border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                Request Docs
              </Button>
              <Button variant="outline" onClick={() => openActionDialog("REJECT")} className="w-full md:w-auto border-red-500/30 text-red-500 hover:bg-red-500/10">
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
              <Button onClick={() => openActionDialog("APPROVE")} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle className="w-4 h-4 mr-2" /> Approve Transfer
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Profiles & Context */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Owner Profile */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Account Owner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 font-bold">
                  {o?.fullName?.[0] || "?"}
                </div>
                <div>
                  <p className="font-medium text-foreground">{o?.fullName || "Unknown User"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {o?.email || "No email"}
                  </p>
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="text-xs space-y-2 text-muted-foreground">
                <div className="flex justify-between"><span>User ID</span> <span className="font-mono">{v.userId}</span></div>
                <div className="flex justify-between"><span>Plan</span> <span className="uppercase text-foreground">{o?.subscriptionPlan || "FREE"}</span></div>
                <div className="flex justify-between"><span>Joined</span> <span>{formatDate(o?.createdAt)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Nominee Profile */}
          <Card className="border-border bg-card relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <User className="w-24 h-24" />
            </div>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <User className="w-4 h-4 text-blue-500" />
                Submitting Nominee
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold">
                  {n?.name?.[0] || "?"}
                </div>
                <div>
                  <p className="font-medium text-foreground">{n?.name || "Unknown Nominee"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {n?.email || "No email"}
                  </p>
                </div>
              </div>
              <Separator className="bg-border" />
              <div className="text-xs space-y-2 text-muted-foreground">
                <div className="flex justify-between"><span>Nominee ID</span> <span className="font-mono">{v.nomineeId}</span></div>
                <div className="flex justify-between"><span>Relation</span> <span className="text-foreground uppercase font-semibold">{n?.relation || "N/A"}</span></div>
              </div>
              
              {v.remarks && (
                <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/50 text-sm italic text-muted-foreground">
                  "{v.remarks}"
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Analysis Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Activity className="w-4 h-4 text-violet-400" />
                Risk Analysis & Fraud Scoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center bg-background/40 p-3 rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">Calculated Risk Score</span>
                <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${
                  (v.riskScore || 0) > 60 
                    ? "bg-red-500/10 text-red-400" 
                    : (v.riskScore || 0) > 30 
                      ? "bg-amber-500/10 text-amber-400" 
                      : "bg-emerald-500/10 text-emerald-400"
                }`}>
                  {v.riskScore !== null ? `${v.riskScore} / 100` : "PENDING"}
                </span>
              </div>
              {v.riskScore !== null && v.riskScore !== undefined && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {v.riskScore > 60 
                    ? "⚠️ High discrepancy detected. Verify extracted document details match user record name exactly."
                    : v.riskScore > 30 
                      ? "⚡ Medium risk warning. Check document validity and obituary notice match."
                      : "✅ Low risk match profile. ID details align with nomination parameters."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* OCR Extracted Data Card */}
          {v.ocrData && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <User className="w-4 h-4 text-primary" />
                  ID Document OCR Results
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 text-muted-foreground">
                <div className="flex justify-between pb-1 border-b border-border/40">
                  <span>Document Type</span> 
                  <span className="text-foreground uppercase">{v.ocrData.documentType?.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-border/40">
                  <span>Extracted Name</span> 
                  <span className="text-foreground font-semibold">{v.ocrData.fullName}</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-border/40">
                  <span>DOB</span> 
                  <span className="text-foreground font-mono">{v.ocrData.dateOfBirth}</span>
                </div>
                <div className="flex justify-between">
                  <span>Document Number</span> 
                  <span className="text-foreground font-mono">{v.ocrData.documentNumber}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit Timeline */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <History className="w-4 h-4 text-muted-foreground" />
                Review History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No actions recorded yet.</p>
                ) : (
                  <div className="relative border-l border-border ml-2 pl-4 space-y-4">
                    {logs.map((log: any, idx: number) => (
                      <div key={log._id} className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-border ring-4 ring-card" />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-foreground">
                            {log.action.replace(/_/g, " ")}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                            <span>{formatDate(log.timestamp)}</span>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{log.adminEmail}</span>
                          </p>
                          {log.reason && (
                            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded mt-1 border border-border/50">
                              {log.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Documents */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card h-full flex flex-col">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-blue-500" />
                Submitted Documents
              </CardTitle>
              <CardDescription>
                Review the provided documents carefully. Ensure names and dates match the account records.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-6 space-y-8">
              
              {/* Death Evidence Collection */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Death evidence Documents</h3>
                
                {v.deathEvidence && v.deathEvidence.length > 0 ? (
                  <div className="space-y-6">
                    {v.deathEvidence.map((doc: any, idx: number) => (
                      <div key={idx} className="space-y-2.5">
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${doc.isPreferred ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {doc.documentType.replace(/_/g, " ")} {doc.isPreferred ? "(Preferred)" : "(Alternative)"}
                        </h4>
                        <VerificationDocumentViewer
                          label={doc.documentType.replace(/_/g, " ")}
                          url={getVerificationDocumentUrl(v.id, doc.documentId)}
                          fileName={doc.fileName}
                          mimeType={doc.mimeType || "application/pdf"}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  // Fallback for legacy requests
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Death Certificate (Legacy Submission)
                    </h3>
                    <VerificationDocumentViewer
                      label="Death Certificate"
                      url={v.certificateFile ? getVerificationFileUrl(v.id, "certificate") : null}
                      fileName={v.certificateFile?.fileName}
                      mimeType={v.certificateFile?.mimeType}
                    />
                  </div>
                )}
              </div>

              {/* Govt ID */}
              {v.governmentIdFile && (
                <>
                  <Separator className="bg-border my-8" />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      Government-Issued ID
                    </h3>
                    <VerificationDocumentViewer
                      label="Government ID"
                      url={getVerificationDocumentUrl(v.id, v.governmentIdFile.id || v.governmentIdFile._id)}
                      fileName={v.governmentIdFile.fileName}
                      mimeType={v.governmentIdFile.mimeType}
                    />
                  </div>
                </>
              )}

              {/* Selfie File */}
              {v.selfieFile && (
                <>
                  <Separator className="bg-border my-8" />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      Biometric Selfie
                    </h3>
                    <VerificationDocumentViewer
                      label="Biometric Selfie"
                      url={getVerificationDocumentUrl(v.id, v.selfieFile.id || v.selfieFile._id)}
                      fileName={v.selfieFile.fileName}
                      mimeType={v.selfieFile.mimeType}
                    />
                  </div>
                </>
              )}

              {/* Relationship Proof (Legacy) */}
              {v.relationshipProofFile && (
                <>
                  <Separator className="bg-border my-8" />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      Relationship Proof
                    </h3>
                    <VerificationDocumentViewer
                      label="Relationship Proof"
                      url={getVerificationDocumentUrl(v.id, v.relationshipProofFile.id || v.relationshipProofFile._id)}
                      fileName={v.relationshipProofFile.fileName}
                      mimeType={v.relationshipProofFile.mimeType}
                    />
                  </div>
                </>
              )}
              
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
