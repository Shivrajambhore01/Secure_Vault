"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface VerificationActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: "APPROVE" | "REJECT" | "REQUEST_MORE_DOCS" | null
  onConfirm: (remarks: string) => Promise<void>
}

export function VerificationActionDialog({
  open,
  onOpenChange,
  action,
  onConfirm,
}: VerificationActionDialogProps) {
  const [remarks, setRemarks] = useState("")
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm(remarks)
      setRemarks("")
    } finally {
      setLoading(false)
      onOpenChange(false)
    }
  }

  let title = ""
  let description = ""
  let confirmText = ""
  let confirmColor = ""

  switch (action) {
    case "APPROVE":
      title = "Approve Verification Request"
      description = "Are you sure you want to approve this death verification? This will initiate the transfer of assets to the nominee. This action cannot be undone."
      confirmText = "Approve Transfer"
      confirmColor = "bg-emerald-600 hover:bg-emerald-700 text-white"
      break
    case "REJECT":
      title = "Reject Verification Request"
      description = "Rejecting this request means the submitted documents are invalid or fraudulent. Please provide a clear reason for the nominee."
      confirmText = "Reject Request"
      confirmColor = "bg-red-600 hover:bg-red-700 text-white"
      break
    case "REQUEST_MORE_DOCS":
      title = "Request Additional Documents"
      description = "Use this if the provided documents are illegible or incomplete. The nominee will be notified to submit further proof."
      confirmText = "Request Documents"
      confirmColor = "bg-amber-600 hover:bg-amber-700 text-white"
      break
  }

  const isRemarksRequired = action === "REJECT" || action === "REQUEST_MORE_DOCS"
  const isConfirmDisabled = isRemarksRequired && remarks.trim() === ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl text-foreground">{title}</DialogTitle>
          <DialogDescription className="pt-2 text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
          <Label htmlFor="remarks" className="text-foreground">
            {isRemarksRequired ? "Reason / Remarks (Required)" : "Remarks (Optional)"}
          </Label>
          <Textarea
            id="remarks"
            placeholder={
              action === "APPROVE"
                ? "e.g., Verified death certificate via national registry..."
                : "e.g., The provided death certificate is blurry and unreadable..."
            }
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="h-28 resize-none bg-background border-border text-foreground focus-visible:ring-violet-500"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-border text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirmDisabled || loading}
            className={confirmColor}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                Processing...
              </div>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
