"use client";

import * as React from "react";
import { ShieldCheck, AlertCircle, ShieldAlert, ShieldX } from "lucide-react";

export type RiskLevelType = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskBadgeProps {
  level: RiskLevelType | string;
  score?: number;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  className = "",
}) => {
  const safeLevel = typeof level === "string" ? level : "LOW";
  const normLevel = (safeLevel.toUpperCase() as RiskLevelType) || "LOW";

  const config = {
    LOW: {
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      label: "LOW RISK",
    },
    MEDIUM: {
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      label: "MEDIUM RISK",
    },
    HIGH: {
      color: "bg-orange-50 text-orange-700 border-orange-200",
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      label: "HIGH RISK",
    },
    CRITICAL: {
      color: "bg-rose-50 text-rose-700 border-rose-200",
      icon: <ShieldX className="w-3.5 h-3.5" />,
      label: "CRITICAL RISK",
    },
  }[normLevel] || {
    color: "bg-neutral-100 text-neutral-700 border-neutral-200",
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    label: normLevel,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.color} ${className}`}
    >
      {config.icon}
      <span>{config.label}</span>
      {score !== undefined && (
        <span className="ml-0.5 px-1 py-0.2 rounded bg-black/30 font-mono text-[10px]">
          {score}/100
        </span>
      )}
    </span>
  );
};
