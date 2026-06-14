/**
 * Authentication utility functions
 */

/**
 * Clear all authentication state and cookies
 */
export function clearAuthState() {
    // Clear localStorage
    if (typeof window !== "undefined") {
        const keys = Object.keys(localStorage)
        keys.forEach(key => {
            if (key.startsWith('sv_')) {
                localStorage.removeItem(key)
            }
        })
    }
}

/**
 * Check if user has valid session
 */
export async function hasValidSession(): Promise<boolean> {
    try {
        const response = await fetch('http://localhost:8000/api/auth/heartbeat', {
            method: 'POST',
            credentials: 'include'
        })
        return response.ok
    } catch {
        return false
    }
}

/**
 * Force logout - clears everything and redirects
 */
export async function forceLogout() {
    try {
        // Call logout API
        await fetch('http://localhost:8000/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        })
    } catch (error) {
        console.error('Logout API failed:', error)
    }
    
    // Clear local state
    clearAuthState()
    
    // Redirect to login
    if (typeof window !== "undefined") {
        window.location.href = "/login"
    }
}
