"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { InterveButton } from "./button";
import { motion, AnimatePresence } from "framer-motion";

export interface InterveModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  closeOnOverlay?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function InterveModal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  showCloseButton = true,
  closeOnOverlay = true,
  className,
}: InterveModalProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="absolute inset-0 bg-black/5 backdrop-blur-sm"
            onClick={closeOnOverlay ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
            className={cn(
              "relative z-10 w-full mx-4",
              "interve-glass-heavy rounded-[var(--radius-xl)]",
              "shadow-[var(--interve-shadow-modal)]",
              sizeMap[size],
              className
            )}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between p-6 pb-0">
                <div className="flex flex-col gap-1.5">
                  {title && (
                    <h2 className="text-[16px] font-semibold text-[var(--interve-text-title)] leading-tight">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-[13px] text-[var(--interve-text-secondary)] leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
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
            <div className="p-6">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--interve-divider)] bg-[var(--interve-bg-secondary)]/50 rounded-b-[var(--radius-xl)]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ─── Confirm Modal shorthand ─── */
export interface InterveConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
  loading?: boolean;
}

export function InterveConfirm({
  open, onClose, onConfirm, title, description,
  confirmText = "Confirm", cancelText = "Cancel",
  variant = "default", loading = false,
}: InterveConfirmProps) {
  return (
    <InterveModal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <InterveButton variant="secondary" onClick={onClose}>
            {cancelText}
          </InterveButton>
          <InterveButton
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </InterveButton>
        </>
      }
    />
  );
}
