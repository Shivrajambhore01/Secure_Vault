"use client"

import { Shield } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">SecureVault</span>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Secure Blockchain-Based Digital Asset Management & Inheritance Platform
        </p>
        <p className="text-sm text-muted-foreground">
          {new Date().getFullYear()} SecureVault
        </p>
      </div>
    </footer>
  )
}
