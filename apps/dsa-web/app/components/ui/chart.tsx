"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Source: https://ui.shadcn.com/docs/components/base/chart (minimal ChartContainer for Recharts v3, Tailwind v3)
export function ChartContainer({
  className,
  children,
  ariaLabel,
}: {
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div role="img" aria-label={ariaLabel ?? "Chart"} className={cn("w-full overflow-x-auto", className)}>
      <div className="h-[280px] w-full min-w-[320px]">{children}</div>
    </div>
  );
}

export function ChartLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
