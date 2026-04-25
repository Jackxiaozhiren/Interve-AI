"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InterveSliderProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function InterveSlider({
  value = 0,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  label,
  showValue = true,
  className,
}: InterveSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(Number(e.target.value));
  };

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-[13px] font-medium text-[var(--interve-text-body)]">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-[13px] tabular-nums text-[var(--interve-text-secondary)]">
              {value}
            </span>
          )}
        </div>
      )}

      <div className="relative w-full h-6 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-[var(--interve-border)]" />
        {/* Track fill */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-[var(--interve-brand-accent)] transition-all duration-[var(--motion-micro)]"
          style={{ width: `${percentage}%` }}
        />
        {/* Native range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          className={cn(
            "absolute inset-0 w-full h-full opacity-0 cursor-pointer",
            disabled && "cursor-not-allowed"
          )}
        />
        {/* Thumb visual */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[var(--interve-brand-accent)]",
            "shadow-[0_2px_6px_rgba(22,93,255,0.15)]",
            "transition-all duration-[var(--motion-micro)]",
            "pointer-events-none",
            disabled && "border-[#C9CDD4] shadow-none"
          )}
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
    </div>
  );
}
