"use client";

import * as React from "react";

export type StatusVariant =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected"
  | "halted"
  | "cooling"
  | "warning";

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  className = "",
}) => {
  // Infer variant from status string if not explicitly passed
  const resolvedVariant: StatusVariant =
    variant ||
    (() => {
      const s = (status || "").toLowerCase();
      if (s.includes("active") || s.includes("verified") || s.includes("encrypt")) return "active";
      if (s.includes("approved") || s.includes("success")) return "approved";
      if (s.includes("cooling")) return "cooling";
      if (s.includes("halt") || s.includes("frozen")) return "halted";
      if (s.includes("reject") || s.includes("fail") || s.includes("error")) return "rejected";
      if (s.includes("warning") || s.includes("review")) return "warning";
      if (s.includes("pending") || s.includes("queued") || s.includes("invited")) return "pending";
      return "inactive";
    })();

  const variantStyles = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cooling: "bg-cyan-50 text-cyan-700 border-cyan-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    halted: "bg-rose-50 text-rose-700 border-rose-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    inactive: "bg-neutral-100 text-neutral-700 border-neutral-200",
  };

  const dotStyles = {
    active: "bg-emerald-500",
    approved: "bg-emerald-500",
    cooling: "bg-cyan-500",
    pending: "bg-amber-500",
    warning: "bg-amber-500",
    halted: "bg-rose-500",
    rejected: "bg-red-500",
    inactive: "bg-neutral-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${variantStyles[resolvedVariant]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[resolvedVariant]}`} />
      <span className="capitalize">{status || "Active"}</span>
    </span>
  );
};
