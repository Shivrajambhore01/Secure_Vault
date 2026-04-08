"use client"

import { GoogleOAuthProvider } from "@react-oauth/google"

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
    // If the client ID is missing, just render children without Google OAuth
    // This prevents showing an error screen on every page load
    if (!GOOGLE_CLIENT_ID) {
        console.warn("GoogleAuthProvider: NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google login will not work.")
        return <>{children}</>
    }

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            {children}
        </GoogleOAuthProvider>
    )
}
