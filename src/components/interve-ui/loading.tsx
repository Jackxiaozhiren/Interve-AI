"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ─── Breathing Dots ─── */
export interface InterveDotsLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const dotSizes = { sm: "w-1.5 h-1.5", md: "w-2 h-2", lg: "w-2.5 h-2.5" };

export function InterveDotsLoader({ size = "md", className }: InterveDotsLoaderProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "rounded-full",
            dotSizes[size]
          )}
          style={{
            backgroundColor: "#E6F0FF",
            animation: `interve-dot-breathe 1500ms cubic-bezier(0.2, 0, 0, 1) ${i * 200}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Full-page loading state (standardized) ─── */
export interface IntervePageLoaderProps {
  className?: string;
}

export function IntervePageLoader({ className }: IntervePageLoaderProps) {
  return (
    <div className={cn("flex items-center justify-center py-[120px]", className)}>
      <InterveDotsLoader size="md" />
    </div>
  );
}

/* ─── Spinner ─── */
export interface InterveSpinnerProps {
  size?: number;
  className?: string;
}

export function InterveSpinner({ size = 20, className }: InterveSpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("animate-[interve-spin_1s_linear_infinite]", className)}
    >
      <circle cx="12" cy="12" r="10" stroke="var(--interve-border)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--interve-brand-accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Skeleton ─── */
export interface InterveSkeletonProps {
  width?: string;
  height?: string;
  rounded?: boolean;
  className?: string;
}

export function InterveSkeleton({
  width = "100%",
  height = "16px",
  rounded = false,
  className,
}: InterveSkeletonProps) {
  return (
    <div
      style={{ width, height }}
      className={cn(
        "bg-gradient-to-r from-[var(--interve-bg-secondary)] via-[#EEEEF0] to-[var(--interve-bg-secondary)]",
        "bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]",
        rounded ? "rounded-full" : "rounded-[var(--radius-sm)]",
        className
      )}
    />
  );
}

/* ─── Progress Bar ─── */
export interface InterveProgressProps {
  value: number;
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

export function InterveProgress({
  value,
  max = 100,
  size = "md",
  className,
}: InterveProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        "w-full bg-[var(--interve-bg-secondary)] rounded-full overflow-hidden",
        size === "sm" ? "h-1" : "h-1.5",
        className
      )}
    >
      <div
        className="h-full bg-[var(--interve-brand-accent)] rounded-full transition-[width] duration-[var(--motion-normal)] ease-[var(--ease-primary)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
