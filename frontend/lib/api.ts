import { setLoggedIn } from "./store"
import { toast } from "sonner"

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
export const BASE_URL = `${API_BASE}/api`

// Prevent multiple simultaneous token refresh attempts
let isRefreshing = false
let refreshPromise: Promise<Response> | null = null

/**
 * Extract a human-readable error message from a FastAPI (or legacy) API response body.
 * FastAPI returns errors as { "detail": "..." } or { "detail": [{ "msg": "..." }] }
 * Legacy code may use { "error": "..." } or { "message": "..." }
 */
export function extractErrorMessage(data: any, fallback = "Something went wrong"): string {
    if (!data) return fallback
    if (typeof data === "string") return data
    // FastAPI validation errors are arrays
    if (Array.isArray(data.detail) && data.detail.length > 0) {
        return data.detail[0].msg || fallback
    }
    return data.detail || data.error || data.message || fallback
}

/**
 * A wrapper around fetch that:
 * - Adds credentials and CSRF headers automatically
 * - Handles 401 by attempting a token refresh
 * - Normalizes FastAPI "detail" error responses to "error" key
 *   so all pages can use `data.error` uniformly
 */
export async function secureFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`

    const defaultOptions: RequestInit = {
        ...options,
        credentials: "include", // Required for HttpOnly cookies
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest", // CSRF protection hint
            ...options.headers,
        },
    }

    try {
        let response = await fetch(url, defaultOptions)

        // Handle 401 Unauthorized (Expired Access Token)
        // BUT: Don't try to refresh on auth endpoints
        const isAuthEndpoint =
            endpoint.includes("/auth/login") ||
            endpoint.includes("/auth/signup") ||
            endpoint.includes("/auth/google-auth") ||
            endpoint.includes("/auth/refresh-token")

        if (response.status === 401 && !isAuthEndpoint) {
            console.warn("Access token expired, attempting refresh...")

            // Prevent race condition: Only one refresh at a time
            if (!isRefreshing) {
                isRefreshing = true
                refreshPromise = fetch(`${BASE_URL}/auth/refresh-token`, {
                    method: "POST",
                    credentials: "include",
                }).finally(() => {
                    isRefreshing = false
                    refreshPromise = null
                })
            }

            const refreshResponse = await refreshPromise!

            if (refreshResponse.ok) {
                console.log("Token refreshed successfully")
                // Retry the original request
                response = await fetch(url, defaultOptions)
            } else {
                // Refresh token ALSO expired or invalid
                console.warn("Both access and refresh tokens expired")
                setLoggedIn(false)
                toast.error("Your session has expired. Please login again.", { duration: 5000 })
                setTimeout(() => {
                    if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
                        window.location.href = "/login"
                    }
                }, 1000)
                throw new Error("Session expired")
            }
        }

        // Normalize FastAPI error responses so pages can use data.error uniformly.
        // FastAPI uses { "detail": "..." } — we patch the response's json() method
        // to remap "detail" → "error" transparently.
        if (!response.ok) {
            // Clone and read the error body, then return a patched Response
            const cloned = response.clone()
            const rawData = await cloned.json().catch(() => ({}))
            const normalizedData = {
                ...rawData,
                // Always expose error key for pages that use data.error
                error: extractErrorMessage(rawData, "Request failed"),
            }
            // Return a synthetic Response with the normalized body
            return new Response(JSON.stringify(normalizedData), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            })
        }

        return response
    } catch (error) {
        console.error("API Fetch Error:", error)
        throw error
    }
}
