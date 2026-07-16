import { secureAdminFetch, ADMIN_BASE_URL } from "./admin-api"

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
}

export interface VerificationDetail {
  verification: VerificationRequest
  owner: any
  nominee: any
  reviewer: any
  auditLogs: any[]
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

export function getVerificationDocumentUrl(requestId: string, documentId: string) {
  return `${ADMIN_BASE_URL}/verification/requests/${requestId}/document/${documentId}`
}
