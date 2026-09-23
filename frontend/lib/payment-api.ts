import { API_BASE, BASE_URL } from "./api"

export interface PlanInfo {
    id: string
    name: string
    price: number
    currency: string
    billingPeriod: string
    storageLimit: number
    fileSizeLimit: number
    nomineeLimit: number
    assetLimit: number
    features: string[]
}

export interface PaymentRequestItem {
    _id: string
    id: string
    userId: string
    userEmail?: string
    userName?: string
    planId: string
    planName: string
    amount: number
    currency: string
    utrId: string
    status: "PENDING" | "APPROVED" | "REJECTED"
    adminRemark?: string | null
    submittedAt: string
    reviewedAt?: string | null
    reviewedByRole?: string | null
}

export interface ActiveSubscription {
    _id: string
    id: string
    userId: string
    planId: string
    status: "ACTIVE" | "EXPIRED" | "SUPERSEDED"
    startDate: string
    endDate: string
    createdAt: string
}

export interface InvoiceItem {
    _id: string
    id: string
    paymentRequestId: string
    subscriptionId: string
    userId: string
    planId: string
    planName: string
    amount: number
    currency: string
    issuedAt: string
}

export interface MySubscriptionResponse {
    subscription: ActiveSubscription | null
    invoices: InvoiceItem[]
    pendingRequest: PaymentRequestItem | null
}

/**
 * Fetch available plans from server.
 */
export async function fetchPlans(): Promise<PlanInfo[]> {
    const res = await fetch(`${BASE_URL}/payments/plans`, {
        headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
        },
    })
    if (!res.ok) {
        throw new Error("Failed to load subscription plans")
    }
    return res.json()
}

/**
 * Submit a manual UPI payment request.
 */
export async function submitPaymentRequest(
    planId: string,
    utrId: string,
    screenshot: File
): Promise<{ message: string; paymentRequest: PaymentRequestItem }> {
    const formData = new FormData()
    formData.append("planId", planId)
    formData.append("utrId", utrId)
    formData.append("screenshot", screenshot)

    const res = await fetch(`${BASE_URL}/payments/request`, {
        method: "POST",
        credentials: "include",
        headers: {
            "X-Requested-With": "XMLHttpRequest",
            "ngrok-skip-browser-warning": "true",
        },
        body: formData,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
        const errorMsg = data.detail || data.error || data.message || "Failed to submit payment request"
        throw new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg))
    }

    return data
}

/**
 * Fetch current user's payment requests.
 */
export async function fetchMyPaymentRequests(): Promise<PaymentRequestItem[]> {
    const res = await fetch(`${BASE_URL}/payments/my-requests`, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "ngrok-skip-browser-warning": "true",
        },
    })
    if (!res.ok) {
        throw new Error("Failed to fetch payment history")
    }
    return res.json()
}

/**
 * Fetch current user's active subscription status and invoices.
 */
export async function fetchMySubscription(): Promise<MySubscriptionResponse> {
    const res = await fetch(`${BASE_URL}/payments/my-subscription`, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "ngrok-skip-browser-warning": "true",
        },
    })
    if (!res.ok) {
        throw new Error("Failed to fetch subscription details")
    }
    return res.json()
}
