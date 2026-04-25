"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════
   Interve AI — Prompt Input Component
   Auto-resize + Send/Attach/Clear
   Luminous Light Design System v1.0
   ═══════════════════════════════════════ */

export interface IntervePromptInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSend?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  maxLength?: number;
  showAttach?: boolean;
  onAttach?: () => void;
  className?: string;
}

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 300;

export function IntervePromptInput({
  value: controlledValue,
  onChange,
  onSend,
  placeholder = "Send a message...",
  disabled = false,
  loading = false,
  maxLength,
  showAttach = false,
  onAttach,
  className,
}: IntervePromptInputProps) {
  const [internalValue, setInternalValue] = React.useState("");
  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : internalValue;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, []);

  React.useEffect(() => { adjustHeight(); }, [currentValue, adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  };

  const handleSend = () => {
    const trimmed = currentValue.trim();
    if (!trimmed || disabled || loading) return;
    onSend?.(trimmed);
    if (!isControlled) setInternalValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = currentValue.trim().length > 0 && !disabled && !loading;

  return (
    <div
      className={cn(
        "relative flex items-end gap-2 w-full",
        "interve-glass-light rounded-[var(--radius-lg)] px-4 py-2.5",
        "shadow-[var(--interve-shadow-card)]",
        "transition-shadow duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
        "focus-within:shadow-[var(--interve-shadow-hover)]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Attach button */}
      {showAttach && (
        <button
          type="button"
          onClick={onAttach}
          disabled={disabled}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--interve-text-secondary)] hover:bg-[var(--interve-bg-accent)] hover:text-[var(--interve-text-body)] transition-colors duration-[var(--motion-micro)] mb-0.5"
          aria-label="Attach file"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        rows={1}
        className={cn(
          "flex-1 resize-none bg-transparent text-[14px] text-[var(--interve-text-title)]",
          "placeholder:text-[var(--interve-text-placeholder)]",
          "outline-none leading-relaxed py-1.5",
          "disabled:cursor-not-allowed"
        )}
        style={{ minHeight: `${MIN_HEIGHT - 20}px`, maxHeight: `${MAX_HEIGHT - 20}px` }}
      />

      {/* Character count */}
      {maxLength && (
        <span className="shrink-0 text-[11px] text-[var(--interve-text-placeholder)] tabular-nums mb-1.5">
          {currentValue.length}/{maxLength}
        </span>
      )}

      {/* Send button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className={cn(
          "shrink-0 w-8 h-8 flex items-center justify-center rounded-full mb-0.5",
          "transition-all duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
          canSend
            ? "bg-[var(--interve-brand-accent)] text-white shadow-[var(--interve-shadow-button)] hover:scale-105 active:scale-95"
            : "bg-[var(--interve-bg-secondary)] text-[var(--interve-text-placeholder)]"
        )}
        aria-label="Send message"
      >
        {loading ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
