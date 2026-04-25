"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

import { motion, AnimatePresence } from "framer-motion";

export interface InterveDrawerProps {
  open: boolean;
  onClose: () => void;
  position?: "left" | "right" | "top" | "bottom";
  title?: string;
  children?: React.ReactNode;
  width?: string;
  height?: string;
  showCloseButton?: boolean;
  className?: string;
}

const positionStyles: Record<string, string> = {
  left: "inset-y-0 left-0",
  right: "inset-y-0 right-0",
  top: "inset-x-0 top-0",
  bottom: "inset-x-0 bottom-0",
};

const slideVariants: Record<string, { initial: Record<string, string | number>; animate: Record<string, string | number>; exit: Record<string, string | number> }> = {
  left: {
    initial: { x: "-100%" },
    animate: { x: 0 },
    exit: { x: "-100%" },
  },
  right: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
  },
  top: {
    initial: { y: "-100%" },
    animate: { y: 0 },
    exit: { y: "-100%" },
  },
  bottom: {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
  },
};

export function InterveDrawer({
  open,
  onClose,
  position = "right",
  title,
  children,
  width = "360px",
  height = "360px",
  showCloseButton = true,
  className,
}: InterveDrawerProps) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const sizeStyle =
    position === "left" || position === "right"
      ? { width }
      : { height };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="absolute inset-0 bg-black/5 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={sizeStyle}
            initial={slideVariants[position].initial}
            animate={slideVariants[position].animate}
            exit={slideVariants[position].exit}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
            className={cn(
              "absolute z-10",
              "interve-glass-heavy",
              "shadow-[var(--interve-shadow-modal)]",
              "flex flex-col",
              positionStyles[position],
              className
            )}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--interve-divider)]">
                {title && (
                  <h2 className="text-[16px] font-semibold text-[var(--interve-text-title)]">
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--interve-text-secondary)] hover:bg-[var(--interve-bg-accent)] hover:text-[var(--interve-text-body)] transition-colors duration-[var(--motion-micro)]"
                    aria-label="Close"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
