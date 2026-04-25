"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InterveSwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "lg" | "md" | "sm";
  label?: string;
  className?: string;
}

const trackSize = {
  lg: "w-12 h-7",
  md: "w-10 h-6",
  sm: "w-8 h-5",
};

const thumbSize = {
  lg: "w-5 h-5",
  md: "w-4 h-4",
  sm: "w-3.5 h-3.5",
};

const thumbTranslate = {
  lg: "translate-x-[22px]",
  md: "translate-x-[18px]",
  sm: "translate-x-[14px]",
};

export function InterveSwitch({
  checked = false,
  onChange,
  disabled = false,
  size = "md",
  label,
  className,
}: InterveSwitchProps) {
  const handleToggle = () => {
    if (!disabled) onChange?.(!checked);
  };

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2.5 select-none",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          "relative inline-flex items-center shrink-0 rounded-full",
          "transition-colors duration-[var(--motion-normal)] ease-[var(--ease-primary)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--interve-brand-accent)]/20 focus-visible:outline-none",
          checked
            ? "bg-[var(--interve-brand-accent)]"
            : "bg-[#C9CDD4]",
          trackSize[size]
        )}
      >
        <span
          className={cn(
            "absolute left-1 rounded-full bg-white shadow-sm",
            "transition-transform duration-[var(--motion-normal)] ease-[var(--ease-primary)]",
            "will-change-transform",
            checked && thumbTranslate[size],
            thumbSize[size]
          )}
        />
      </button>
      {label && (
        <span className="text-[14px] text-[var(--interve-text-body)]">
          {label}
        </span>
      )}
    </label>
  );
}
