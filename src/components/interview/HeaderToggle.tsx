"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const IDLE =
  "bg-white/80 text-slate-700 hover:bg-white hover:text-slate-800 shadow-sm border border-white";

/**
 * One shape for the interview header's toggles. They were seven copies of a
 * <Button> before, five of which carried `aria-pressed` and two of which did
 * not — a drift a shared component cannot reproduce, since the attribute is
 * emitted here once for every toggle.
 */
export function HeaderToggle({
  active,
  activeClass,
  onClick,
  title,
  label,
  extraClassName = "",
  withLabel = false,
  children,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  title: string;
  label: string;
  extraClassName?: string;
  /** In the phone menu a bare icon is a guess; the row carries its name. */
  withLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size={withLabel ? "default" : "icon-sm"}
      onClick={onClick}
      className={`transition-all duration-300 ${withLabel ? "h-auto w-full justify-start gap-2 rounded-2xl px-3 py-2 text-sm" : "rounded-full"} ${extraClassName} ${active ? activeClass : IDLE}`}
      title={title}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
      {withLabel && <span className="truncate text-left">{label}</span>}
    </Button>
  );
}
