"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TagColor = "default" | "blue" | "green" | "orange" | "red";

export interface InterveTagProps {
  children: React.ReactNode;
  color?: TagColor;
  size?: "lg" | "md" | "sm";
  closable?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onClose?: () => void;
  onSelect?: (selected: boolean) => void;
  icon?: React.ReactNode;
  className?: string;
}

const colorMap: Record<TagColor, { bg: string; text: string; border: string }> = {
  default: {
    bg: "bg-[var(--interve-bg-secondary)]",
    text: "text-[var(--interve-text-body)]",
    border: "border-[var(--interve-border)]",
  },
  blue: {
    bg: "bg-[var(--interve-brand-surface)]",
    text: "text-[var(--interve-brand-accent)]",
    border: "border-[var(--interve-brand-accent)]/10",
  },
  green: {
    bg: "bg-[var(--interve-success-surface)]",
    text: "text-[var(--interve-success-text)]",
    border: "border-[var(--interve-success-text)]/10",
  },
  orange: {
    bg: "bg-[var(--interve-warning-surface)]",
    text: "text-[var(--interve-warning-text)]",
    border: "border-[var(--interve-warning-text)]/10",
  },
  red: {
    bg: "bg-[var(--interve-danger-surface)]",
    text: "text-[var(--interve-danger-text)]",
    border: "border-[var(--interve-danger-text)]/10",
  },
};

const sizeMap = {
  lg: "h-7 px-3 text-[13px] gap-1.5 rounded-[var(--radius-sm)]",
  md: "h-6 px-2.5 text-[12px] gap-1 rounded-[6px]",
  sm: "h-5 px-2 text-[11px] gap-1 rounded-[4px]",
};

export function InterveTag({
  children,
  color = "default",
  size = "md",
  closable = false,
  selectable = false,
  selected = false,
  onClose,
  onSelect,
  icon,
  className,
}: InterveTagProps) {
  const colors = colorMap[color];
  const isInteractive = selectable || closable;

  const handleClick = () => {
    if (selectable) onSelect?.(!selected);
  };

  return (
    <span
      onClick={isInteractive ? handleClick : undefined}
      className={cn(
        "inline-flex items-center font-medium border whitespace-nowrap",
        "transition-all duration-[var(--motion-micro)] ease-[var(--ease-primary)]",
        colors.bg,
        colors.text,
        colors.border,
        sizeMap[size],
        selectable && "cursor-pointer",
        selectable &&
          selected &&
          "ring-1 ring-[var(--interve-brand-accent)]/30 shadow-sm",
        selectable && !selected && "hover:opacity-80",
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {closable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          className="shrink-0 hover:opacity-60 transition-opacity ml-0.5"
          aria-label="Remove tag"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </span>
  );
}

/* ─── Badge (dot indicator variant) ─── */
export interface InterveBadgeProps {
  count?: number;
  dot?: boolean;
  color?: TagColor;
  children?: React.ReactNode;
  className?: string;
}

export function InterveBadge({
  count,
  dot = false,
  color = "red",
  children,
  className,
}: InterveBadgeProps) {
  const colors = colorMap[color];
  const showBadge = dot || (count !== undefined && count > 0);
  const displayCount = count !== undefined && count > 99 ? "99+" : count;

  return (
    <span className={cn("relative inline-flex", className)}>
      {children}
      {showBadge && (
        <span
          className={cn(
            "absolute -top-1 -right-1 flex items-center justify-center",
            "font-medium border border-white",
            colors.bg,
            colors.text,
            dot
              ? "w-2 h-2 rounded-full"
              : "min-w-[18px] h-[18px] px-1 text-[10px] rounded-full"
          )}
        >
          {!dot && displayCount}
        </span>
      )}
    </span>
  );
}
