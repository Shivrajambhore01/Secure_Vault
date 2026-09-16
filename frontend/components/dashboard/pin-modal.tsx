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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div
        id="pin-modal-container"
        className="relative w-full max-w-sm rounded-3xl border border-black/10 bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-black"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 border border-black/5 text-black shadow-2xs">
            <ShieldAlert className="h-7 w-7 text-black" />
          </div>
          <h2 className="text-2xl font-bold text-black tracking-tight">PIN Verification</h2>
          <p className="text-center text-sm text-neutral-500">
            Enter your 4-digit security PIN to access your digital assets.
          </p>

          <div className="flex gap-2.5 my-2">
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
                className={`h-14 w-12 rounded-2xl border text-center text-2xl font-bold outline-none transition-all ${
                  error
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-black/15 bg-neutral-50 text-black focus:bg-white focus:border-black focus:ring-4 focus:ring-black/5"
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium animate-in fade-in duration-200">
              Incorrect PIN. Please try again.
            </p>
          )}

          <Button
            onClick={handleVerify}
            disabled={loading}
            className="w-full h-12 rounded-full font-bold bg-black text-white hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-sm gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify PIN"}
          </Button>

          <Link
            href="/forgot-pin"
            className="text-xs text-neutral-500 hover:text-black font-semibold underline-offset-4 hover:underline transition-colors"
          >
            Forgot your PIN?
          </Link>
        </div>
      </div>
    </div>
  )
}
