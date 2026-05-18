import { setLoggedIn } from "./store"
import { toast } from "sonner"

const BASE_URL = "http://localhost:5000/api"

export async function secureFetch(endpoint: string, options: RequestInit = {}) {
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
        if (response.status === 401) {
            console.warn("Access token expired, attempting refresh...")

            // Attempt to refresh token
            const refreshResponse = await fetch(`${BASE_URL}/auth/refresh-token`, {
                method: "POST",
                credentials: "include",
            })

            if (refreshResponse.ok) {
                console.log("Token refreshed successfully")
                // Retry the original request
                response = await fetch(url, defaultOptions)
            } else {
                // Refresh token ALSO expired or invalid -> Logout
                console.error("Session expired. Logging out.")
                setLoggedIn(false)
                if (typeof window !== "undefined") {
                    window.location.href = "/login"
                }
                toast.error("Your session has expired. Please login again.")
                throw new Error("Session expired")
            }
        }

        return response
    } catch (error) {
        console.error("API Fetch Error:", error)
        throw error
    }
}
