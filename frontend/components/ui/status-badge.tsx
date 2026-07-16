import * as React from "react"
import { 
  Lock, 
  Check, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldAlert 
} from "lucide-react"
import { cn } from "@/lib/utils"

export type StatusType = 
  | "encrypted" 
  | "verified" 
  | "pending" 
  | "processing" 
  | "approved" 
  | "rejected" 
  | "expired" 
  | "released"
  | "more_documents_required"

const statusConfigs: Record<StatusType, { label: string; icon: React.ElementType; classes: string }> = {
  encrypted: {
    label: "Encrypted",
    icon: Lock,
    classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]",
  },
  verified: {
    label: "Verified",
    icon: Check,
    classes: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.05)]",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.05)]",
  },
  processing: {
    label: "Processing",
    icon: RefreshCw,
    classes: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.05)] animate-pulse",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    classes: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.05)]",
  },
  expired: {
    label: "Expired",
    icon: AlertTriangle,
    classes: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  },
  released: {
    label: "Released",
    icon: ShieldAlert,
    classes: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 shadow-[0_0_10px_rgba(139,92,246,0.05)]",
  },
  more_documents_required: {
    label: "Needs Docs",
    icon: AlertTriangle,
    classes: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.05)] animate-pulse",
  },
}

export function StatusBadge({ status, className }: { status: StatusType | string; className?: string }) {
  const normalized = status.toLowerCase() as StatusType
  const config = statusConfigs[normalized] || {
    label: status,
    icon: ShieldAlert,
    classes: "bg-secondary text-secondary-foreground border-border",
  }

  const Icon = config.icon

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wider select-none backdrop-blur-md",
      config.classes,
      className
    )}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {config.label}
    </span>
  )
}
