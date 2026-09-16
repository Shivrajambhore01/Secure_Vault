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
      className={`rounded-2xl border border-black/8 bg-white p-5 shadow-sm hover:border-black/15 transition-all text-left ${
        onClick ? "cursor-pointer hover:-translate-y-0.5" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-neutral-500 tracking-wider uppercase">
          {title}
        </span>
        {icon && (
          <div className="p-2 rounded-xl bg-neutral-100 border border-black/5 text-black">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2.5">
        <span className="text-2xl font-bold tracking-tight text-black">{value}</span>
        {trend && (
          <span
            className={`inline-flex items-center text-xs font-semibold gap-0.5 ${
              trend.isPositive ? "text-emerald-600" : "text-rose-600"
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
        <p className="text-xs text-neutral-500 mt-1 leading-normal">{subtitle}</p>
      )}
    </div>
  );
};
