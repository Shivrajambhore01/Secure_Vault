"use client"

import { useState } from "react"
import { ShieldAlert, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getUser } from "@/lib/store"
import { secureFetch } from "@/lib/api"
import Link from "next/link"

interface PinModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PinModal({ open, onClose, onSuccess }: PinModalProps) {
  const [pin, setPin] = useState(["", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return
    const newPin = [...pin]
    newPin[index] = value
    setPin(newPin)
    setError(false)

    if (value && index < 3) {
      const next = document.getElementById(`pin-modal-${index + 1}`)
      next?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      const prev = document.getElementById(`pin-modal-${index - 1}`)
      prev?.focus()
    }
  }

  const handleVerify = async () => {
    const entered = pin.join("")
    const user = getUser()
    if (!user || entered.length !== 4) {
      setError(true)
      return
    }

    setLoading(true)

    try {
      const response = await secureFetch("/auth/verify-pin", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, pin: entered }),
      })

      if (response.ok) {
        setLoading(false)
        onSuccess()
      } else {
        throw new Error("Invalid PIN")
      }
    } catch (error) {
      setLoading(false)
      setError(true)
      setPin(["", "", "", ""])
      // Shake animation via CSS class
      const container = document.getElementById("pin-modal-container")
      container?.classList.add("animate-shake")
      setTimeout(() => container?.classList.remove("animate-shake"), 500)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="pin-modal-container"
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ShieldAlert className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">PIN Verification</h2>
          <p className="text-center text-sm text-muted-foreground">
            Enter your 4-digit security PIN to access your digital assets.
          </p>

          <div className="flex gap-2.5">
            {pin.map((digit, i) => (
              <input
                key={i}
                id={`pin-modal-${i}`}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value.replace(/\D/, ""))}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`h-12 w-12 rounded-lg border text-center text-xl font-bold outline-none transition-all ${error
                  ? "border-destructive bg-destructive/10 text-destructive"
                  : "border-border bg-input text-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
                  }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive animate-in fade-in duration-200">
              Incorrect PIN. Please try again.
            </p>
          )}

          <Button
            onClick={handleVerify}
            disabled={loading}
            className="w-full gap-2 bg-primary text-primary-foreground py-5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify PIN"}
          </Button>

          <Link
            href="/forgot-pin"
            className="text-xs text-primary hover:underline font-medium"
          >
            Forgot your PIN?
          </Link>
        </div>
      </div>
    </div>
  )
}
