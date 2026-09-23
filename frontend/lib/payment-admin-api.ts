import { secureAdminFetch, ADMIN_BASE_URL, API_BASE, extractAdminErrorMessage } from "./admin-api"

export interface AdminPaymentRequest {
    _id: string
    id: string
    userId: string
    userEmail: string
    userName: string
    planId: string
    planName: string
    amount: number
    currency: string
    utrId: string
    status: "PENDING" | "APPROVED" | "REJECTED"
    adminRemark?: string | null
    reviewedBy?: string | null
    reviewedByRole?: string | null
    submittedAt: string
    reviewedAt?: string | null
    invoice?: {
        id: string
        amount: number
        issuedAt: string
    }
}

export interface PaymentStats {
    pending: number
    approved: number
    rejected: number
    total: number
    totalRevenue: number
}

/**
 * Fetch payment stats for Support & Super Admin dashboards.
 */
export async function fetchAdminPaymentStats(): Promise<PaymentStats> {
    const res = await secureAdminFetch("/support/payments/stats")
    if (!res.ok) {
        throw new Error("Failed to fetch payment stats")
    }
    return res.json()
}

/**
 * List payment requests with optional status filter and pagination.
 */
export async function fetchAdminPaymentRequests(
    status?: string,
    skip: number = 0,
    limit: number = 50
): Promise<{ items: AdminPaymentRequest[]; total: number; skip: number; limit: number }> {
    const query = new URLSearchParams()
    if (status && status !== "ALL") query.set("status", status)
    query.set("skip", skip.toString())
    query.set("limit", limit.toString())

    const res = await secureAdminFetch(`/support/payments?${query.toString()}`)
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(extractAdminErrorMessage(data, "Failed to load payment requests"))
    }
    return res.json()
}

/**
 * Fetch single payment request detail.
 */
export async function fetchAdminPaymentDetail(requestId: string): Promise<AdminPaymentRequest> {
    const res = await secureAdminFetch(`/support/payments/${requestId}`)
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(extractAdminErrorMessage(data, "Failed to load payment request detail"))
    }
    return res.json()
}

/**
 * Get the screenshot URL for a payment request.
 */
export function getPaymentScreenshotUrl(requestId: string): string {
    return `${ADMIN_BASE_URL}/support/payments/${requestId}/screenshot`
}

/**
 * Fetch decrypted screenshot as a Blob for modal preview.
 */
export async function fetchPaymentScreenshotBlob(requestId: string): Promise<string> {
    const res = await secureAdminFetch(`/support/payments/${requestId}/screenshot`)
    if (!res.ok) {
        throw new Error("Failed to load payment screenshot")
    }
    const blob = await res.blob()
    return URL.createObjectURL(blob)
}

/**
 * Approve payment request (Support Admin ONLY).
 */
export async function approvePaymentRequest(requestId: string): Promise<{ message: string }> {
    const res = await secureAdminFetch(`/support/payments/${requestId}/approve`, {
        method: "POST",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(extractAdminErrorMessage(data, "Failed to approve payment request"))
    }
    return data
}

/**
 * Reject payment request (Support Admin ONLY).
 */
export async function rejectPaymentRequest(
    requestId: string,
    remark: string
): Promise<{ message: string }> {
    const res = await secureAdminFetch(`/support/payments/${requestId}/reject`, {
        method: "POST",
        body: JSON.stringify({ remark }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        throw new Error(extractAdminErrorMessage(data, "Failed to reject payment request"))
    }
    return data
}
