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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div
        className={`fixed ${sideStyles[side]} w-full ${widthStyles[width]} bg-white border-l border-black/10 shadow-2xl flex flex-col z-10 text-black`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/5">
          <h3 className="text-xl font-bold text-black">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 text-black">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-black/5 bg-neutral-50/50">{footer}</div>
        )}
      </div>
    </div>
  );
};
