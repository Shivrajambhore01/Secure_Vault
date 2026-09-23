"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

export interface LoadingStateProps {
  label?: string;
  variant?: "spinner" | "skeleton" | "card";
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = "Loading SecureVault...",
  variant = "spinner",
  className = "",
}) => {
  if (variant === "skeleton") {
    return (
      <div className={`space-y-3 w-full animate-pulse ${className}`}>
        <div className="h-5 bg-neutral-200 rounded-md w-1/3" />
        <div className="h-10 bg-neutral-100 rounded-xl w-full" />
        <div className="h-24 bg-neutral-100 rounded-xl w-full" />
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`p-6 rounded-3xl border border-black/8 bg-white shadow-sm animate-pulse space-y-4 ${className}`}
      >
        <div className="h-4 bg-neutral-200 rounded w-1/4" />
        <div className="h-8 bg-neutral-100 rounded w-1/2" />
        <div className="h-3 bg-neutral-100 rounded w-3/4" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center space-y-3 ${className}`}
    >
      <Loader2 className="w-6 h-6 animate-spin text-black" />
      <p className="text-xs text-neutral-500 font-medium tracking-wide">{label}</p>
    </div>
  );
};
