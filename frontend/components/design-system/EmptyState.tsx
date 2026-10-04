"use client";

import * as React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No data available",
  description = "There are currently no items to display.",
  icon,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-10 rounded-3xl border border-dashed border-zinc-700/80 bg-zinc-900/60 shadow-lg ${className}`}
    >
      <div className="p-4 rounded-2xl bg-zinc-800 border border-zinc-700 text-cyan-400 mb-3.5 shadow-inner">
        {icon || <FolderOpen className="w-6 h-6" />}
      </div>

      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">{description}</p>

      {actionLabel && onAction && (
        <div className="mt-5">
          <Button size="sm" variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
