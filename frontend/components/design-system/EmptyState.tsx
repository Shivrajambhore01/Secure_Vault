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
      className={`flex flex-col items-center justify-center text-center p-10 rounded-3xl border border-dashed border-black/15 bg-white shadow-sm ${className}`}
    >
      <div className="p-4 rounded-2xl bg-neutral-100 border border-black/5 text-black mb-3.5 shadow-2xs">
        {icon || <FolderOpen className="w-6 h-6 text-black" />}
      </div>

      <h3 className="text-base font-bold text-black">{title}</h3>
      <p className="text-xs text-neutral-500 mt-1 max-w-sm leading-relaxed">{description}</p>

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
