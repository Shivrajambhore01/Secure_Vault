"use client";

import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = "",
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-zinc-800 bg-[#161b22] p-5 shadow-lg hover:border-zinc-700 transition-all text-left ${
        onClick ? "cursor-pointer hover:-translate-y-0.5" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-zinc-400 tracking-wider uppercase">
          {title}
        </span>
        {icon && (
          <div className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-cyan-400">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2.5">
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        {trend && (
          <span
            className={`inline-flex items-center text-xs font-semibold gap-0.5 ${
              trend.isPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-zinc-400 mt-1 leading-normal">{subtitle}</p>
      )}
    </div>
  );
};
