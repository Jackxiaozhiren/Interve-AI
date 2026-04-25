"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { InterveButton } from "./button";

/* ═══════════════════════════════════════
   Interve AI — Empty State Component
   Luminous Light Design System v1.0
   
   Standardized spacing:
   - Icon: 64x64, bg #E6F0FF
   - Title: 18px, #1D2129, mt-24px
   - Desc: 14px, #86909C, mt-12px, max 2 lines
   - Button: mt-32px
   - Container: py-120px
   ═══════════════════════════════════════ */

/* ─── Default icons ─── */
function DefaultEmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#86909C" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ChatEmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#86909C" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function DocEmptyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#86909C" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export const EMPTY_ICONS = {
  default: <DefaultEmptyIcon />,
  chat: <ChatEmptyIcon />,
  document: <DocEmptyIcon />,
} as const;

/* ─── Component ─── */

export interface InterveEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  size?: "default" | "mini";
  className?: string;
}

export function InterveEmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: InterveEmptyStateProps) {
  if (size === "mini") {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6", className)}>
        {icon && (
          <span className="text-[#86909C] mb-2">{icon}</span>
        )}
        <p className="text-[13px] text-[#86909C]">{title}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-[120px]", className)}>
      {/* Icon container — 64x64, #E6F0FF background */}
      <div className="w-16 h-16 rounded-full bg-[#E6F0FF] flex items-center justify-center">
        {icon || <DefaultEmptyIcon />}
      </div>

      {/* Title — 18px, 500, #1D2129, mt-24px */}
      <h3 className="text-[18px] font-medium text-[#1D2129] mt-6">
        {title}
      </h3>

      {/* Description — 14px, #86909C, mt-12px, max 2 lines */}
      {description && (
        <p className="text-[14px] text-[#86909C] mt-3 max-w-xs text-center line-clamp-2">
          {description}
        </p>
      )}

      {/* Action button — mt-32px */}
      {action && (
        <div className="mt-8">
          <InterveButton variant="primary" size="md" onClick={action.onClick}>
            {action.label}
          </InterveButton>
        </div>
      )}
    </div>
  );
}
