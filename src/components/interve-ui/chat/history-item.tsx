"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════
   Interve AI — History Item Component
   Sidebar conversation list item
   Luminous Light Design System v1.0
   ═══════════════════════════════════════ */

export interface InterveHistoryItemProps {
  title: string;
  preview?: string;
  timestamp?: string;
  active?: boolean;
  pinned?: boolean;
  onClick?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  className?: string;
}

export function InterveHistoryItem({
  title,
  preview,
  timestamp,
  active = false,
  pinned = false,
  onClick,
  onRename,
  onDelete,
  onPin,
  className,
}: InterveHistoryItemProps) {
  const [showMenu, setShowMenu] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
      className={cn(
        "relative flex flex-col gap-0.5 px-3 py-2.5 rounded-[var(--radius-sm)] cursor-pointer",
        "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
        active
          ? "bg-[var(--interve-brand-surface)]"
          : "hover:bg-[var(--interve-bg-accent)]",
        className
      )}
    >
      {/* Title row */}
      <div className="flex items-center gap-1.5">
        {pinned && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[var(--interve-brand-accent)]">
            <path d="M12 2l2.09 6.26L20 9.27l-5 4.17L16.18 20 12 16.77 7.82 20 9 13.44 4 9.27l5.91-1.01L12 2z" fill="currentColor" />
          </svg>
        )}
        <span
          className={cn(
            "text-[14px] font-medium truncate flex-1",
            active
              ? "text-[var(--interve-brand-accent)]"
              : "text-[var(--interve-text-title)]"
          )}
        >
          {title}
        </span>
        {timestamp && !showMenu && (
          <span className="shrink-0 text-[11px] text-[var(--interve-text-placeholder)] tabular-nums">
            {timestamp}
          </span>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <p className="text-[12px] text-[var(--interve-text-secondary)] truncate">
          {preview}
        </p>
      )}

      {/* Quick actions — on hover */}
      {showMenu && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 animate-[interve-fade-in_var(--motion-micro)_var(--ease-primary)]">
          {onPin && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPin(); }}
              title={pinned ? "Unpin" : "Pin"}
              className="w-6 h-6 flex items-center justify-center rounded-[4px] text-[var(--interve-text-secondary)] hover:bg-white/80 hover:text-[var(--interve-text-body)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l2.09 6.26L20 9.27l-5 4.17L16.18 20 12 16.77 7.82 20 9 13.44 4 9.27l5.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" fill={pinned ? "currentColor" : "none"} />
              </svg>
            </button>
          )}
          {onRename && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRename(); }}
              title="Rename"
              className="w-6 h-6 flex items-center justify-center rounded-[4px] text-[var(--interve-text-secondary)] hover:bg-white/80 hover:text-[var(--interve-text-body)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Delete"
              className="w-6 h-6 flex items-center justify-center rounded-[4px] text-[var(--interve-text-secondary)] hover:bg-[var(--interve-danger-surface)] hover:text-[var(--interve-danger-text)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
