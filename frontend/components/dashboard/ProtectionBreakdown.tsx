"use client";

import React from "react";
import type { DigitalAsset } from "@/lib/store";

interface ProtectionBreakdownProps {
  assets: DigitalAsset[];
}

interface CategoryMetric {
  id: string;
  name: string;
  count: number;
  sizeLabel: string;
  color: string;
  percentage: number;
}

export function ProtectionBreakdown({ assets }: ProtectionBreakdownProps) {
  const totalAssets = Math.max(assets.length, 1);

  // Group assets into core heritage categories
  const categories: CategoryMetric[] = [
    {
      id: "passwords",
      name: "Passwords & Keys",
      count: assets.filter((a) => (a.type as string) === "password" || (a.type as string) === "crypto-key").length,
      sizeLabel: `${assets.filter((a) => (a.type as string) === "password" || (a.type as string) === "crypto-key").length * 24} keys`,
      color: "bg-emerald-500",
      percentage: Math.round(
        (assets.filter((a) => (a.type as string) === "password" || (a.type as string) === "crypto-key").length / totalAssets) * 100
      ) || 35,
    },
    {
      id: "documents",
      name: "Legal & Directives",
      count: assets.filter((a) => (a.type as string) === "legal-file" || (a.type as string) === "document").length,
      sizeLabel: `${assets.filter((a) => (a.type as string) === "legal-file" || (a.type as string) === "document").length} files`,
      color: "bg-teal-500",
      percentage: Math.round(
        (assets.filter((a) => (a.type as string) === "legal-file" || (a.type as string) === "document").length / totalAssets) * 100
      ) || 55,
    },
    {
      id: "media",
      name: "Identity & Media",
      count: assets.filter((a) => (a.type as string) === "image" || (a.type as string) === "video").length,
      sizeLabel: `${assets.filter((a) => (a.type as string) === "image" || (a.type as string) === "video").length} items`,
      color: "bg-indigo-500",
      percentage: Math.round(
        (assets.filter((a) => (a.type as string) === "image" || (a.type as string) === "video").length / totalAssets) * 100
      ) || 20,
    },
    {
      id: "notes",
      name: "Encrypted Notes",
      count: assets.filter((a) => (a.type as string) === "note").length,
      sizeLabel: `${assets.filter((a) => (a.type as string) === "note").length} notes`,
      color: "bg-amber-500",
      percentage: Math.round(
        (assets.filter((a) => (a.type as string) === "note").length / totalAssets) * 100
      ) || 15,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-black tracking-tight">Where is your data protected?</h3>
      </div>

      <div className="space-y-4 pt-1">
        {categories.map((cat) => (
          <div key={cat.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-800">{cat.name}</span>
              <span className="font-mono font-bold text-neutral-500">{cat.sizeLabel}</span>
            </div>
            {/* Progress bar line */}
            <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
              <div
                style={{ width: `${Math.max(8, cat.percentage)}%` }}
                className={`h-full rounded-full ${cat.color} transition-all duration-500`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
