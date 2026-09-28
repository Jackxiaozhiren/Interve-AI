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
  children,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  title: string;
  label: string;
  extraClassName?: string;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      className={`rounded-full transition-all duration-300 ${extraClassName} ${active ? activeClass : IDLE}`}
      title={title}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}
