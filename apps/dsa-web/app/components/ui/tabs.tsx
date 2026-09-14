"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Source: https://ui.shadcn.com/docs/components/tabs (lightweight, no radix dep)
interface TabsProps {
  tabs: { value: string; label: string }[];
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onValueChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={cn("inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1", className)}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onValueChange(t.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === t.value
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-800"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
