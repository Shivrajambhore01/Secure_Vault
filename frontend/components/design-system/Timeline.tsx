"use client";

import * as React from "react";
import { CheckCircle2, Circle, Clock, AlertTriangle } from "lucide-react";

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  status: "completed" | "active" | "pending" | "error";
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, className = "" }) => {
  return (
    <div className={`relative pl-6 space-y-6 ${className}`}>
      {/* Vertical Track Line */}
      <div className="absolute left-2.5 top-3 bottom-3 w-0.5 bg-zinc-800" />

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        const iconMap = {
          completed: <CheckCircle2 className="w-5 h-5 text-emerald-400 bg-zinc-900 rounded-full" />,
          active: <Clock className="w-5 h-5 text-purple-400 bg-zinc-900 rounded-full animate-pulse" />,
          pending: <Circle className="w-5 h-5 text-zinc-600 bg-zinc-900 rounded-full" />,
          error: <AlertTriangle className="w-5 h-5 text-red-400 bg-zinc-900 rounded-full" />,
        };

        return (
          <div key={item.id} className="relative flex items-start gap-4">
            {/* Step Icon Node */}
            <div className="absolute -left-6 top-0.5 z-10 flex items-center justify-center">
              {iconMap[item.status]}
            </div>

            {/* Step Details */}
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between gap-2">
                <h4
                  className={`text-sm font-medium ${
                    item.status === "completed"
                      ? "text-zinc-100"
                      : item.status === "active"
                      ? "text-purple-300 font-semibold"
                      : "text-zinc-400"
                  }`}
                >
                  {item.title}
                </h4>
                {item.timestamp && (
                  <span className="text-xs text-zinc-500">{item.timestamp}</span>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
