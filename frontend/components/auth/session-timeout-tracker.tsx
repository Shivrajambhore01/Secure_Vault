"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { isLoggedIn, setLoggedIn, setCurrentUserId, saveUser, getUser } from "@/lib/store"
import { secureFetch } from "@/lib/api"

const SESSION_TIMEOUT_MS = 60 * 60 * 1000 // 60 minutes (1 hour)

export function SessionTimeoutTracker() {
    const router = useRouter()
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const logout = async (reason: string) => {
        try {
            await secureFetch("/auth/logout", { method: "POST" })
        } catch (error) {
            console.error("Logout failed during session timeout:", error)
        }

        // Clear local state
        setLoggedIn(false)
        setCurrentUserId("")

        toast.info("Session Timeout", {
            description: `You have been logged out due to ${reason}.`
        })

        router.push("/login")
    }

    const resetTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        if (isLoggedIn()) {
            timeoutRef.current = setTimeout(() => {
                logout("inactivity")
            }, SESSION_TIMEOUT_MS)
        }
    }

    useEffect(() => {
        const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"]

        const handleActivity = () => {
            resetTimeout()
        }

        let heartbeatInterval: NodeJS.Timeout | null = null;
        let lastLoggedUserId: string | null = null;

        const startHeartbeat = () => {
            const currentUserId = getUser()?.id;
            if (!currentUserId) return;
            lastLoggedUserId = currentUserId;

            if (heartbeatInterval) clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(async () => {
                try {
                    // Only fetch if still logged in AND it's the same user we started with
                    const currentUser = getUser();
                    if (isLoggedIn() && currentUser?.id === lastLoggedUserId) {
                        await secureFetch("/auth/heartbeat", { method: "POST" });
                    } else {
                        // If user changed or logged out, stop this "zombie" heartbeat
                        if (heartbeatInterval) {
                            clearInterval(heartbeatInterval);
                            heartbeatInterval = null;
                        }
                    }
                } catch (e) {
                    console.error("Heartbeat failed", e);
                }
            }, 30000); // 30 seconds

            // Trigger one immediately to set isOnline
            secureFetch("/auth/heartbeat", { method: "POST" }).catch(e => console.error("Initial heartbeat failed", e));
        }

        // Monitoring function to detect login/logout without page refresh
        const checkAuthAndStart = () => {
            const currentIsLoggedIn = isLoggedIn();
            const currentUserId = getUser()?.id;

            if (currentIsLoggedIn && currentUserId) {
                // If user changed, restart heartbeat
                if (currentUserId !== lastLoggedUserId) {
                    resetTimeout()
                    startHeartbeat()
                    events.forEach(event => window.addEventListener(event, handleActivity))
                }
            } else {
                // Logged out
                if (timeoutRef.current) clearTimeout(timeoutRef.current)
                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                    heartbeatInterval = null;
                }
                lastLoggedUserId = null;
                events.forEach(event => window.removeEventListener(event, handleActivity))
            }
        }

        checkAuthAndStart();

        // Polling or event listener for store changes if lib/store doesn't support listeners
        const storageInterval = setInterval(checkAuthAndStart, 2000); // Check more frequently (2s)

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            if (heartbeatInterval) clearInterval(heartbeatInterval)
            clearInterval(storageInterval)
            events.forEach(event => window.removeEventListener(event, handleActivity))
        }
    }, [])

    return null // This component doesn't render anything
}
