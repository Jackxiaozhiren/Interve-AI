"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════
   Interve AI — Button Component
   4 variants × 3 sizes × 5 states
   Luminous Light Design System v1.0
   ═══════════════════════════════════════ */

export interface InterveButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "text" | "danger";
  size?: "lg" | "md" | "sm";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const variantStyles: Record<string, string> = {
  primary: [
    "bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)]",
    "hover:bg-[#D6E4FF] hover:shadow-[var(--interve-shadow-button)]",
    "active:bg-[#BFDBFF] active:scale-[0.97]",
    "disabled:bg-[#F2F3F5] disabled:text-[var(--interve-text-disabled)] disabled:shadow-none disabled:cursor-not-allowed",
  ].join(" "),

  secondary: [
    "interve-glass-light text-[var(--interve-text-body)]",
    "hover:bg-white/95 hover:border-[var(--interve-border-hover)] hover:shadow-[var(--interve-shadow-xs)]",
    "active:bg-[var(--interve-bg-secondary)] active:scale-[0.97]",
    "disabled:bg-[#F7F8FA] disabled:text-[var(--interve-text-disabled)] disabled:shadow-none disabled:cursor-not-allowed",
  ].join(" "),

  text: [
    "bg-transparent text-[var(--interve-brand-accent)]",
    "hover:bg-[var(--interve-brand-surface)]",
    "active:bg-[#D6E4FF] active:scale-[0.97]",
    "disabled:text-[var(--interve-text-disabled)] disabled:bg-transparent disabled:cursor-not-allowed",
  ].join(" "),

  danger: [
    "bg-[var(--interve-danger-surface)] text-[var(--interve-danger-text)]",
    "hover:bg-[#FFD6D6] hover:shadow-[0_4px_16px_rgba(245,63,63,0.1)]",
    "active:bg-[#FFC2C2] active:scale-[0.97]",
    "disabled:bg-[#F2F3F5] disabled:text-[var(--interve-text-disabled)] disabled:shadow-none disabled:cursor-not-allowed",
  ].join(" "),
};

const sizeStyles: Record<string, string> = {
  lg: "h-11 px-6 text-[15px] gap-2.5 rounded-[var(--radius-md)]",
  md: "h-9 px-4 text-[14px] gap-2 rounded-[var(--radius-md)]",
  sm: "h-7 px-3 text-[12px] gap-1.5 rounded-[var(--radius-sm)]",
};

export const InterveButton = React.forwardRef<
  HTMLButtonElement,
  InterveButtonProps
>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-medium select-none",
          variant === "primary" ? "interve-hoverable-primary" : "interve-hoverable",
          "interve-focus-glow",
          "will-change-transform",
          "focus-visible:ring-2 focus-visible:ring-[var(--interve-brand-accent)]/20 focus-visible:outline-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin shrink-0"
            width={size === "sm" ? 12 : 14}
            height={size === "sm" ? 12 : 14}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="opacity-20"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        )}
        {!loading && icon && iconPosition === "left" && (
          <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === "right" && (
          <span className="shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);

InterveButton.displayName = "InterveButton";
