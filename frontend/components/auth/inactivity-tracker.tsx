"use client"

import { useEffect, useState } from "react"
import { isLoggedIn } from "@/lib/store"

/**
 * InactivityTracker — Read-Only Awareness Indicator
 * 
 * The actual inactivity monitoring and notification (emails, calls)
 * is handled by the backend cron scheduler (lib/scheduler.ts).
 * This component only shows a subtle UI indicator when the user
 * is logged out and inactivity data exists (for awareness).
 */
export function InactivityTracker() {
    const [showIndicator, setShowIndicator] = useState(false)

    useEffect(() => {
        const checkStatus = () => {
            if (isLoggedIn()) {
                localStorage.removeItem("sv_inactivity_data")
                setShowIndicator(false)
                return
            }

            const dataStr = localStorage.getItem("sv_inactivity_data")
            setShowIndicator(!!dataStr)
        }

        checkStatus()
        const interval = setInterval(checkStatus, 5000)
        return () => clearInterval(interval)
    }, [])

    if (!showIndicator) return null

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 rounded-full border border-primary/20 bg-background/80 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur-md shadow-lg">
                <div className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </div>
                Vault inactivity monitoring active
            </div>
        </div>
    )
}

