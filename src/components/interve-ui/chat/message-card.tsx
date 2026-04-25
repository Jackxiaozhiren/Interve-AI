"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { InterveDotsLoader } from "../loading";

/* ═══════════════════════════════════════
   Interve AI — Message Card Component
   User + AI message cards with streaming
   Luminous Light Design System v1.0
   ═══════════════════════════════════════ */

export type MessageRole = "user" | "assistant";

export interface MessageAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

export interface InterveMessageCardProps {
  role: MessageRole;
  content: React.ReactNode;
  timestamp?: string;
  streaming?: boolean;
  actions?: MessageAction[];
  className?: string;
}

export function InterveMessageCard({
  role,
  content,
  timestamp,
  streaming = false,
  actions = [],
  className,
}: InterveMessageCardProps) {
  const [showActions, setShowActions] = React.useState(false);
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex w-full group",
        isUser ? "justify-end" : "justify-start",
        "animate-[interve-fade-slide-up_var(--motion-normal)_var(--ease-primary)]",
        className
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={cn(
          "relative max-w-[60%] min-w-[80px]",
          isUser
            ? "bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] rounded-[16px] rounded-br-[4px]"
            : "bg-white interve-shadow-xs border border-[var(--interve-border)] rounded-[16px] rounded-bl-[4px] text-[var(--interve-text-title)]"
        )}
      >
        {/* Message content */}
        <div
          className={cn(
            "px-[18px] py-[14px] text-[14px] leading-relaxed",
            isUser ? "font-normal" : "prose-sm"
          )}
        >
          {content}

          {/* Streaming cursor */}
          {streaming && !isUser && (
            <span
              className="inline-block w-[2px] h-[16px] ml-0.5 bg-[var(--interve-brand-accent)] align-text-bottom"
              style={{ animation: "interve-cursor-blink var(--motion-cursor-blink) step-end infinite" }}
            />
          )}
        </div>

        {/* AI thinking indicator */}
        {streaming && !content && !isUser && (
          <div className="px-4 py-3">
            <InterveDotsLoader size="sm" />
          </div>
        )}

        {/* Timestamp */}
        {timestamp && !streaming && (
          <div
            className={cn(
              "px-4 pb-2 text-[11px]",
              isUser
                ? "text-[var(--interve-brand-accent)]/50 text-right"
                : "text-[var(--interve-text-placeholder)]"
            )}
          >
            {timestamp}
          </div>
        )}

        {/* Action bar — appears on hover for AI messages */}
        {!isUser && actions.length > 0 && showActions && !streaming && (
          <div className="absolute -bottom-8 left-0 flex items-center gap-1 animate-[interve-fade-in_var(--motion-micro)_var(--ease-primary)]">
            {actions.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                title={action.label}
                className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--interve-text-secondary)] hover:bg-[var(--interve-bg-accent)] hover:text-[var(--interve-text-body)] interve-hoverable transition-colors duration-[var(--motion-micro)]"
              >
                {action.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── AI Response with rich content support ─── */
export interface InterveAIResponseProps {
  content: string;
  streaming?: boolean;
  timestamp?: string;
  actions?: MessageAction[];
  className?: string;
}

export function InterveAIResponse({
  content,
  streaming = false,
  timestamp,
  actions,
  className,
}: InterveAIResponseProps) {
  return (
    <InterveMessageCard
      role="assistant"
      streaming={streaming}
      timestamp={timestamp}
      actions={actions}
      className={className}
      content={
        <div
          className="interve-ai-prose [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-[var(--interve-bg-accent)] [&_code]:rounded-[4px] [&_code]:text-[13px] [&_code]:font-mono [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      }
    />
  );
}
