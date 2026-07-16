"use client"

import { Badge } from "@/components/ui/badge"

interface VerificationStatusBadgeProps {
  status: string
  className?: string
}

export function VerificationStatusBadge({ status, className = "" }: VerificationStatusBadgeProps) {
  let colorClass = "border-gray-500/30 text-gray-400 bg-gray-500/10"
  let label = status.replace(/_/g, " ")

  switch (status) {
    case "PENDING":
      colorClass = "border-amber-500/30 text-amber-400 bg-amber-500/10"
      break
    case "UNDER_REVIEW":
      colorClass = "border-blue-500/30 text-blue-400 bg-blue-500/10"
      break
    case "APPROVED":
      colorClass = "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
      break
    case "REJECTED":
      colorClass = "border-red-500/30 text-red-400 bg-red-500/10"
      break
    case "MORE_DOCUMENTS_REQUIRED":
      colorClass = "border-orange-500/30 text-orange-400 bg-orange-500/10"
      label = "NEEDS DOCS"
      break
  }

  return (
    <Badge variant="outline" className={`text-[10px] font-semibold capitalize ${colorClass} ${className}`}>
      {label.toLowerCase()}
    </Badge>
  )
}
