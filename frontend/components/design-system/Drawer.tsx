"use client";

import * as React from "react";
import { X } from "lucide-react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left";
  width?: "sm" | "md" | "lg";
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  side = "right",
  width = "md",
}) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthStyles = {
    sm: "max-w-xs",
    md: "max-w-md",
    lg: "max-w-lg",
  };

  const sideStyles = {
    right: "right-0 inset-y-0 animate-in slide-in-from-right duration-300",
    left: "left-0 inset-y-0 animate-in slide-in-from-left duration-300",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div
        className={`fixed ${sideStyles[side]} w-full ${widthStyles[width]} bg-[#161b22] border-l border-zinc-800 shadow-2xl flex flex-col z-10 text-white`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 text-zinc-200">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/60">{footer}</div>
        )}
      </div>
    </div>
  );
};
