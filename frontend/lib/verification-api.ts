import { secureAdminFetch, ADMIN_BASE_URL } from "./admin-api"

export interface AIVerificationResult {
  id?: string
  verificationRequestId?: string
  status?: "completed" | "pending" | "failed"
  ocrEngine?: string
  ocrEngineVersion?: string
  extractedFields?: {
    deceased_name?: string | null
    date_of_birth?: string | null
    date_of_death?: string | null
    place_of_death?: string | null
    certificate_number?: string | null
    registration_number?: string | null
    registration_date?: string | null
    issuing_authority?: string | null
    father_name?: string | null
    mother_name?: string | null
    spouse_name?: string | null
    ocr_confidence?: number
  }
  ocrConfidence?: number
  ocrRawText?: string
  validationResults?: {
    overall_score?: number
    checks?: Array<{
      name: string
      field: string
      extracted?: string | null
      expected?: string | null
      status: "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "FOUND" | "NOT_FOUND" | "PASSED" | "GOOD" | "INCOMPLETE"
      score: number
      details: string
    }>
    summary?: {
      name_match?: string
      dob_match?: string
      death_date_valid?: string
      completeness?: string
      authority_found?: string
    }
  }
  anomalyIndicators?: Array<{
    name: string
    detected: boolean
    severity: "low" | "medium" | "high"
    message: string
  }>
  anomalySummary?: string
  aiVerificationConfidence: number
  recommendation: "likely_valid" | "requires_review" | "potential_issues_detected" | "requires_manual_verification"
  recommendationLabel?: string
  riskLevel: "low" | "medium" | "high"
  processingTimeMs?: number
  analyzedAt?: string
  analyzedBy?: string
  errorMessage?: string
  isAdvisoryOnly?: boolean
  disclaimer?: string
}

export interface VerificationRequest {
  _id: string
  id: string
  userId: string
  nomineeId: string
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "MORE_DOCUMENTS_REQUIRED"
  priority: "HIGH" | "MEDIUM" | "LOW"
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
  ownerName: string
  ownerEmail?: string
  nomineeName: string
  nomineeEmail?: string
  nomineeRelation: string
  remarks?: string
  certificateFile?: any
  governmentIdFile?: any
  relationshipProofFile?: any
  riskScore?: number
  ocrData?: any
  deathEvidence?: any
  selfieFile?: any
  aiVerification?: AIVerificationResult
  aiVerificationScore?: number
  aiVerificationFull?: AIVerificationResult
}

export interface VerificationDetail {
  verification: VerificationRequest
  owner: any
  nominee: any
  reviewer: any
  auditLogs: any[]
  aiVerification?: AIVerificationResult | null
}

export async function fetchVerificationStats() {
  const res = await secureAdminFetch("/verification/stats")
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchVerificationRequests(params: {
  status?: string
  search?: string
  skip?: number
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params.status) query.append("status", params.status)
  if (params.search) query.append("search", params.search)
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())

  const res = await secureAdminFetch(`/verification/requests?${query.toString()}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchVerificationDetail(id: string): Promise<VerificationDetail> {
  const res = await secureAdminFetch(`/verification/requests/${id}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function assignVerification(id: string) {
  const res = await secureAdminFetch(`/verification/requests/${id}/assign`, {
    method: "POST",
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function reviewVerification(id: string, action: "APPROVE" | "REJECT" | "REQUEST_MORE_DOCS", remarks: string) {
  const res = await secureAdminFetch(`/verification/requests/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ action, remarks }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function getVerificationFileUrl(id: string, fileType: "certificate" | "governmentId" | "relationshipProof") {
  // Using the absolute API base url
  return `${ADMIN_BASE_URL}/verification/requests/${id}/file/${fileType}`
}

export function getVerificationDocumentUrl(requestId: string, documentId?: string) {
  if (!documentId || documentId === "undefined") {
    return `${ADMIN_BASE_URL}/verification/requests/${requestId}/file/certificate`
  }
  return `${ADMIN_BASE_URL}/verification/requests/${requestId}/document/${documentId}`
}

export async function triggerAIAnalysis(id: string) {
  const res = await secureAdminFetch(`/verification/requests/${id}/analyze`, {
    method: "POST",
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function fetchAIResult(id: string) {
  const res = await secureAdminFetch(`/verification/requests/${id}/ai-result`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

