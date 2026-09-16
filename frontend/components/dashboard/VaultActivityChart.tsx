"use client";

import React, { useState } from "react";

interface ActivityDay {
  day: number;
  count: number;
  isPeak?: boolean;
}

export function VaultActivityChart() {
  // 24-day rolling activity log
  const data: ActivityDay[] = [
    { day: 1, count: 24 },
    { day: 2, count: 48 },
    { day: 3, count: 18 },
    { day: 4, count: 62 },
    { day: 5, count: 35 },
    { day: 6, count: 28 },
    { day: 7, count: 50 },
    { day: 8, count: 32 },
    { day: 9, count: 70 },
    { day: 10, count: 45 },
    { day: 11, count: 20 },
    { day: 12, count: 55 },
    { day: 13, count: 38 },
    { day: 14, count: 42 },
    { day: 15, count: 65 },
    { day: 16, count: 88, isPeak: true },
    { day: 17, count: 30 },
    { day: 18, count: 40 },
    { day: 19, count: 52 },
    { day: 20, count: 60 },
    { day: 21, count: 48 },
    { day: 22, count: 34 },
    { day: 23, count: 58 },
    { day: 24, count: 42 },
  ];

  const maxCount = Math.max(...data.map((d) => d.count));
  const [hoveredDay, setHoveredDay] = useState<ActivityDay | null>(null);

  return (
    <div className="relative w-full pt-2 pb-1">
      {/* Tooltip display */}
      <div className="h-5 mb-1 flex items-center justify-between text-xs text-neutral-400 font-medium">
        <span>Cryptographic Operations Timeline</span>
        {hoveredDay ? (
          <span className="text-black font-semibold animate-in fade-in">
            Day {hoveredDay.day}: <span className="font-mono">{hoveredDay.count} ops</span>
          </span>
        ) : (
          <span className="font-mono text-[11px] text-neutral-400">Hover bars to inspect</span>
        )}
      </div>

      {/* Micro-bar chart container */}
      <div className="h-16 flex items-end gap-1.5 sm:gap-2 pt-2">
        {data.map((item) => {
          const heightPercent = Math.max(15, (item.count / maxCount) * 100);
          const isPeak = item.isPeak;

          return (
            <div
              key={item.day}
              onMouseEnter={() => setHoveredDay(item)}
              onMouseLeave={() => setHoveredDay(null)}
              className="group relative flex-1 h-full flex items-end cursor-pointer"
            >
              <div
                style={{ height: `${heightPercent}%` }}
                className={`w-full rounded-sm sm:rounded-md transition-all duration-200 ${
                  isPeak
                    ? "bg-[#2563EB] shadow-md shadow-blue-500/20 group-hover:scale-y-105"
                    : "bg-[#DBEAFE] hover:bg-[#93C5FD]"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
