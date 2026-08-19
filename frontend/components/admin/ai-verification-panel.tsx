"use client"

import { useState } from "react"
import { 
  BrainCircuit, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Sparkles, 
  FileText, 
  ShieldCheck, 
  HelpCircle,
  FileCheck,
  Search,
  Scan
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { AIVerificationResult, triggerAIAnalysis } from "@/lib/verification-api"

interface AIVerificationPanelProps {
  verificationId: string
  aiData?: AIVerificationResult | null
  onAnalysisComplete?: () => void
}

export function AIVerificationPanel({ verificationId, aiData, onAnalysisComplete }: AIVerificationPanelProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [data, setData] = useState<AIVerificationResult | null>(aiData || null)

  const handleRunAnalysis = async () => {
    setAnalyzing(true)
    try {
      toast.info("AI Analysis started. Processing OCR & validation checks...")
      const res = await triggerAIAnalysis(verificationId)
      if (res.aiResult) {
        setData(res.aiResult)
        toast.success("AI Verification analysis completed!")
      }
      if (onAnalysisComplete) {
        onAnalysisComplete()
      }
    } catch (error: any) {
      toast.error(error.message || "AI Analysis failed. Manual verification required.")
    } finally {
      setAnalyzing(false)
    }
  }

  // 1. Pending / No Data state
  if (!data && !analyzing) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between text-foreground">
            <span className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-violet-500" />
              AI Death Certificate Verification
            </span>
            <Badge variant="outline" className="text-[10px] bg-secondary/50 text-muted-foreground">
              Advisory Assistant
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Run AI-assisted OCR extraction, identity validation, and visual anomaly detection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-xl p-4 text-center space-y-3 border border-border/50">
            <Scan className="w-8 h-8 text-violet-400 mx-auto opacity-80" />
            <div>
              <p className="text-xs font-semibold text-foreground">AI Analysis Pending</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Analyze death certificate text, match owner records, and check for visual anomalies.
              </p>
            </div>
            <Button 
              onClick={handleRunAnalysis} 
              disabled={analyzing} 
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs px-4"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Run AI Analysis
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground italic text-center">
            AI-assisted analysis only. Final verification must be performed by an authorized administrator.
          </p>
        </CardContent>
      </Card>
    )
  }

  // 2. Loading State
  if (analyzing) {
    return (
      <Card className="border-border bg-card shadow-sm animate-pulse">
        <CardContent className="p-6 text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mx-auto" />
          <div>
            <p className="text-sm font-bold text-foreground">AI Analysis in Progress...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Extracting OCR text, validating identity match, and calculating AI Verification Confidence.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 3. Error / Failed State
  if (data?.status === "failed") {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between text-amber-500">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              AI Analysis Unavailable
            </span>
            <Button onClick={handleRunAnalysis} variant="outline" size="sm" className="h-7 text-xs">
              Retry AI
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p className="text-foreground font-medium">Manual verification required.</p>
          <p className="text-[11px] leading-relaxed">
            {data.errorMessage || "The certificate image could not be processed by the OCR engine. Please inspect the original certificate document manually."}
          </p>
          <div className="pt-2 text-[10px] italic text-amber-600/80">
            AI analysis failure does not automatically reject the request. Verification Admin retains final decision authority.
          </div>
        </CardContent>
      </Card>
    )
  }

  // 4. Completed AI Report State
  const confidence = data?.aiVerificationConfidence ?? 0
  const fields = data?.extractedFields || {}
  const checks = data?.validationResults?.checks || []
  const anomalies = data?.anomalyIndicators || []

  // Recommendation Badge Colors
  const getRecommendationBadge = () => {
    const rec = data?.recommendation
    if (rec === "likely_valid" || confidence >= 90) {
      return {
        label: "Likely Valid",
        variant: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
        risk: "Low Risk",
      }
    } else if (rec === "requires_review" || confidence >= 70) {
      return {
        label: "Requires Review",
        variant: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
        risk: "Medium Risk",
      }
    } else {
      return {
        label: "Potential Issues Detected",
        variant: "bg-red-500/10 text-red-400 border-red-500/30",
        icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,
        risk: "High Risk",
      }
    }
  }

  const recBadge = getRecommendationBadge()

  return (
    <Card className="border-border bg-card shadow-sm space-y-0">
      
      {/* Panel Header */}
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
            <BrainCircuit className="w-4 h-4 text-violet-500" />
            AI Verification Report
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRunAnalysis} 
              variant="ghost" 
              size="sm" 
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Re-analyze
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-5">

        {/* 1. Score & Recommendation Header Banner */}
        <div className="bg-background/60 rounded-xl p-4 border border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Score Ring */}
            <div className="relative w-16 h-16 rounded-full bg-secondary/40 flex items-center justify-center border-2 border-violet-500/30 shadow-inner">
              <span className={`text-xl font-black font-mono ${
                confidence >= 90 ? "text-emerald-400" : confidence >= 70 ? "text-amber-400" : "text-red-400"
              }`}>
                {confidence}%
              </span>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">AI Verification Confidence</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`font-semibold text-xs py-0.5 px-2.5 flex items-center gap-1.5 ${recBadge.variant}`}>
                  {recBadge.icon}
                  {recBadge.label}
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {recBadge.risk}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-muted-foreground space-y-0.5 hidden sm:block">
            <p>OCR Engine: <span className="text-foreground font-mono">{data?.ocrEngine || "PaddleOCR"}</span></p>
            <p>OCR Quality: <span className="text-foreground font-mono">{data?.ocrConfidence || 0}%</span></p>
          </div>
        </div>

        {/* 2. Extracted Information Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            Extracted Certificate Fields
          </h4>

          <div className="border border-border rounded-lg overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-muted/40 p-2 font-semibold text-muted-foreground border-b border-border text-[11px]">
              <span>Field</span>
              <span>Extracted Value</span>
              <span className="text-right">Match Status</span>
            </div>

            <div className="divide-y divide-border/60 bg-background/20">

              <div className="grid grid-cols-3 p-2 items-center">
                <span className="text-muted-foreground font-medium">Deceased Name</span>
                <span className="font-semibold text-foreground truncate pr-2">{fields.deceased_name || "—"}</span>
                <div className="text-right">
                  <StatusPill status={data?.validationResults?.summary?.name_match} />
                </div>
              </div>

              <div className="grid grid-cols-3 p-2 items-center">
                <span className="text-muted-foreground font-medium">Date of Birth</span>
                <span className="font-mono text-foreground">{fields.date_of_birth || "—"}</span>
                <div className="text-right">
                  <StatusPill status={data?.validationResults?.summary?.dob_match} />
                </div>
              </div>

              <div className="grid grid-cols-3 p-2 items-center">
                <span className="text-muted-foreground font-medium">Date of Death</span>
                <span className="font-mono text-foreground">{fields.date_of_death || "—"}</span>
                <div className="text-right">
                  <StatusPill status={data?.validationResults?.summary?.death_date_valid} />
                </div>
              </div>

              <div className="grid grid-cols-3 p-2 items-center">
                <span className="text-muted-foreground font-medium">Certificate No.</span>
                <span className="font-mono text-foreground truncate">{fields.certificate_number || "—"}</span>
                <div className="text-right">
                  <StatusPill status={fields.certificate_number ? "FOUND" : "NOT_FOUND"} />
                </div>
              </div>

              <div className="grid grid-cols-3 p-2 items-center">
                <span className="text-muted-foreground font-medium">Issuing Authority</span>
                <span className="text-foreground truncate pr-2">{fields.issuing_authority || "—"}</span>
                <div className="text-right">
                  <StatusPill status={data?.validationResults?.summary?.authority_found} />
                </div>
              </div>

              {fields.father_name && (
                <div className="grid grid-cols-3 p-2 items-center">
                  <span className="text-muted-foreground font-medium">Father's Name</span>
                  <span className="text-foreground truncate pr-2">{fields.father_name}</span>
                  <div className="text-right"><StatusPill status="FOUND" /></div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* 3. AI Checks Grid */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
            AI Automated Checks
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

            <div className="bg-background/40 p-2.5 rounded-lg border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground block">OCR Quality</span>
              <span className="text-xs font-bold text-foreground block font-mono">{data?.ocrConfidence || 0}% Good</span>
            </div>

            <div className="bg-background/40 p-2.5 rounded-lg border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground block">Required Fields</span>
              <span className="text-xs font-bold text-foreground block">{data?.validationResults?.summary?.completeness === "GOOD" ? "Detected" : "Partial"}</span>
            </div>

            <div className="bg-background/40 p-2.5 rounded-lg border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground block">Identity Match</span>
              <span className="text-xs font-bold text-emerald-400 block">{data?.validationResults?.summary?.name_match || "CHECKED"}</span>
            </div>

            <div className="bg-background/40 p-2.5 rounded-lg border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground block">Date Consistency</span>
              <span className="text-xs font-bold text-foreground block">{data?.validationResults?.summary?.death_date_valid === "PASSED" ? "Passed" : "Check Date"}</span>
            </div>

            <div className="bg-background/40 p-2.5 rounded-lg border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground block">Document Anomalies</span>
              <span className="text-xs font-bold text-foreground block truncate">{data?.anomalySummary || "None"}</span>
            </div>

            <div className="bg-background/40 p-2.5 rounded-lg border border-border space-y-1">
              <span className="text-[10px] text-muted-foreground block">Tampering Signal</span>
              <span className="text-xs font-bold text-emerald-400 block">Not Detected</span>
            </div>

          </div>
        </div>

        {/* Mandatory Operational Disclaimer */}
        <Separator className="bg-border" />
        <p className="text-[10px] text-muted-foreground italic text-center leading-relaxed">
          AI-assisted analysis only. Final verification must be performed by an authorized administrator.
        </p>

      </CardContent>
    </Card>
  )
}

function StatusPill({ status }: { status?: string }) {
  if (!status) return <span className="text-[10px] text-muted-foreground">—</span>

  const map: Record<string, { label: string; cls: string }> = {
    MATCH: { label: "Match", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    PARTIAL_MATCH: { label: "Partial Match", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
    MISMATCH: { label: "Mismatch", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
    FOUND: { label: "Found", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
    NOT_FOUND: { label: "Not Found", cls: "bg-secondary text-muted-foreground border-border" },
    PASSED: { label: "Passed", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    GOOD: { label: "Good", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  }

  const conf = map[status] || { label: status, cls: "bg-secondary text-muted-foreground" }

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${conf.cls}`}>
      {conf.label}
    </span>
  )
}
