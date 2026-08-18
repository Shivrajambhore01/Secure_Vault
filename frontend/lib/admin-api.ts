import { setAdminLoggedIn } from "./admin-store"
import { toast } from "sonner"

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
export const ADMIN_BASE_URL = `${API_BASE}/api/admin`

// Prevent multiple simultaneous token refresh attempts for admin
let isAdminRefreshing = false
let adminRefreshPromise: Promise<Response> | null = null

/**
 * Extract a human-readable error message from an admin API response body.
 */
export function extractAdminErrorMessage(data: any, fallback = "Something went wrong"): string {
  if (!data) return fallback
  if (typeof data === "string") return data
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    return data.detail[0].msg || fallback
  }
  return data.detail || data.error || data.message || fallback
}

/**
 * A fetch wrapper for admin APIs that:
 * - Adds credentials automatically (for HttpOnly adminAccessToken/adminRefreshToken cookies)
 * - Handles 401 by attempting an admin token refresh
 * - Normalizes error responses
 */
export async function secureAdminFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `${ADMIN_BASE_URL}${endpoint}`

  const defaultOptions: RequestInit = {
    ...options,
    credentials: "include", // Required for HttpOnly cookies
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...options.headers,
    },
  }

  try {
    let response = await fetch(url, defaultOptions)

    // Handle 401 Unauthorized for admin access
    const isAuthEndpoint = endpoint.includes("/auth/login") || endpoint.includes("/auth/refresh")

    if (response.status === 401 && !isAuthEndpoint) {
      console.warn("Admin access token expired, attempting refresh...")

      if (!isAdminRefreshing) {
        isAdminRefreshing = true
        adminRefreshPromise = fetch(`${ADMIN_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        }).finally(() => {
          isAdminRefreshing = false
          adminRefreshPromise = null
        })
      }

      const refreshResponse = await adminRefreshPromise!

      if (refreshResponse.ok) {
        console.log("Admin token refreshed successfully")
        // Retry the original request
        response = await fetch(url, defaultOptions)
      } else {
        console.warn("Both admin access and refresh tokens expired")
        setAdminLoggedIn(false)
        toast.error("Your admin session has expired. Please login again.", { duration: 5000 })
        setTimeout(() => {
          if (typeof window !== "undefined" && !window.location.pathname.includes("/admin/login")) {
            window.location.href = "/admin/login"
          }
        }, 1000)
        throw new Error("Admin session expired")
      }
    }

    if (!response.ok) {
      const cloned = response.clone()
      const rawData = await cloned.json().catch(() => ({}))
      const normalizedData = {
        ...rawData,
        error: extractAdminErrorMessage(rawData, "Request failed"),
      }
      return new Response(JSON.stringify(normalizedData), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    }

    return response
  } catch (error) {
    console.error("Admin API Fetch Error:", error)
    throw error
  }
}
