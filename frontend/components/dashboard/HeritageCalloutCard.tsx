"use client";

import React, { useState } from "react";
import { ShieldCheck, Heart, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export function HeritageCalloutCard() {
  const [checkedIn, setCheckedIn] = useState(false);

  const handleCheckIn = () => {
    setCheckedIn(true);
    toast.success("Heartbeat confirmed. Inactivity timer reset to 90 days.");
  };

  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#F0F7FF] to-[#EBF3FE] border border-blue-100/80 p-5 space-y-4">
      {/* Decorative icon stack */}
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-2xl bg-white text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
          <ShieldCheck className="w-6 h-6 text-[#2563EB]" />
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-blue-200/60 text-[10px] font-mono font-bold text-blue-700">
          <Heart className="w-3 h-3 text-red-500 fill-red-500 animate-pulse" />
          <span>32 DAYS LEFT</span>
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-bold text-black tracking-tight">
          Dead-Man Switch Active
        </h4>
        <p className="text-xs text-neutral-600 leading-relaxed">
          Verify your heartbeat regularly. If timer expires, your cryptographic keys transfer to designated beneficiaries.
        </p>
      </div>

      <div className="pt-1">
        {checkedIn ? (
          <div className="w-full py-2.5 rounded-full bg-emerald-600 text-white text-center text-xs font-bold shadow-xs">
            ✓ Heartbeat Recorded
          </div>
        ) : (
          <button
            onClick={handleCheckIn}
            className="w-full h-10 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <span>CONFIRM HEARTBEAT</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="text-center">
        <Link
          href="/dashboard/settings"
          className="text-[11px] font-semibold text-neutral-500 hover:text-black underline-offset-4 hover:underline"
        >
          Adjust safety protocols →
        </Link>
      </div>
    </div>
  );
}
