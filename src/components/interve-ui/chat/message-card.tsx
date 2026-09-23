"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { escapeHtml } from "@/lib/message-text";
import { InterveDotsLoader } from "../loading";

/* ═══════════════════════════════════════
   Interve AI — Message Card Component
   User + AI message cards with streaming
   Luminous Light Design System v1.0
   ═══════════════════════════════════════ */

export type MessageSender = "user" | "assistant";

export interface MessageAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

export interface InterveMessageCardProps {
  sender: MessageSender;
  content: React.ReactNode;
  timestamp?: string;
  streaming?: boolean;
  actions?: MessageAction[];
  className?: string;
}

export function InterveMessageCard({
  sender,
  content,
  timestamp,
  streaming = false,
  actions = [],
  className,
}: InterveMessageCardProps) {
  const [showActions, setShowActions] = React.useState(false);
  // NOTE: prop is `sender`, not ARIA `role` — chat participant is styling
  // input only and never reaches the DOM (jsx-a11y/aria-role clean).
  const isUser = sender === "user";

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
          // Phase 14: user-bubble text darkened for 4.5:1 on the tint
          // (brand-accent measured 3.85:1 here).
          isUser
            ? "bg-[var(--interve-brand-surface)] text-blue-700 rounded-[16px] rounded-br-[4px]"
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

        {/* Timestamp (Phase 13: secondary meets 4.5:1; Phase 14: slate-600
            for tinted demo bubbles where secondary measured 4.14) */}
        {timestamp && !streaming && (
          <div
            className={cn(
              "px-4 pb-2 text-[11px] text-slate-600",
              isUser && "text-right"
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
  // Phase B2 (LLM10): content is LLM/echoed-user text, NOT trusted HTML.
  // Escape at the sink so <script>/<img onerror>/event-handler payloads
  // render as inert text even if this (currently uncalled) component is
  // wired to model output later. No markdown pipeline exists in src/, so
  // nothing legitimate needs raw HTML here.
  return (
    <InterveMessageCard
      sender="assistant"
      streaming={streaming}
      timestamp={timestamp}
      actions={actions}
      className={className}
      content={
        <div
          className="interve-ai-prose [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-[var(--interve-bg-accent)] [&_code]:rounded-[4px] [&_code]:text-[13px] [&_code]:font-mono [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: escapeHtml(content) }}
        />
      }
    />
  );
}
