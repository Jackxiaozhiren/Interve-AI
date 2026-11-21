"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Compatibility facade (S2, 2026-11-21).
 *
 * §12.10's merge rule: `ui/button` is the single button implementation, and
 * InterveButton's visual differences live there as variants (primary / text;
 * danger maps onto destructive). This file used to carry a second 130-line
 * native-<button> implementation with its own hover/focus/disabled styling —
 * two buttons claiming one name. It is now a thin adapter over the one
 * implementation, so the 11 call sites keep their props (loading / icon /
 * iconPosition / legacy size names) without forking the styling.
 */
export interface InterveButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "text" | "danger";
  size?: "lg" | "md" | "sm";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const VARIANT_MAP = {
  primary: "primary",
  secondary: "secondary",
  text: "text",
  danger: "destructive",
} as const;

const SIZE_MAP = {
  lg: "lg",
  md: "default",
  sm: "sm",
} as const;

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
    const spinnerSize = size === "sm" ? 12 : 14;

    return (
      <Button
        ref={ref}
        disabled={isDisabled}
        variant={VARIANT_MAP[variant]}
        size={SIZE_MAP[size]}
        className={cn(
          "inline-flex items-center justify-center font-medium select-none",
          "interve-focus-glow will-change-transform",
          variant === "primary" ? "interve-hoverable-primary" : "interve-hoverable",
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin shrink-0"
            width={spinnerSize}
            height={spinnerSize}
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
      </Button>
    );
  }
);

InterveButton.displayName = "InterveButton";
