"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════
   Interve AI — Model Selector Component
   Card mode + Compact dropdown mode
   Luminous Light Design System v1.0
   ═══════════════════════════════════════ */

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
}

export interface InterveModelSelectorProps {
  models: ModelOption[];
  value?: string;
  onChange?: (modelId: string) => void;
  mode?: "card" | "compact";
  className?: string;
}

export function InterveModelSelector({
  models,
  value,
  onChange,
  mode = "compact",
  className,
}: InterveModelSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selectedModel = models.find((m) => m.id === value);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Card mode ── */
  if (mode === "card") {
    return (
      <div className={cn("grid grid-cols-2 gap-3", className)}>
        {models.map((model) => {
          const isSelected = model.id === value;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onChange?.(model.id)}
              className={cn(
                "flex flex-col items-start gap-2 p-4 rounded-[var(--radius-lg)]",
                "border transition-all duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
                isSelected
                  ? "bg-[var(--interve-brand-surface)] border-[var(--interve-brand-accent)]/20 shadow-[var(--interve-shadow-button)]"
                  : "bg-white border-[var(--interve-border)] hover:border-[var(--interve-border-hover)] hover:shadow-[var(--interve-shadow-xs)]"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                {model.icon && (
                  <span className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--interve-bg-accent)] flex items-center justify-center">
                    {model.icon}
                  </span>
                )}
                <span
                  className={cn(
                    "text-[14px] font-medium",
                    isSelected ? "text-[var(--interve-brand-accent)]" : "text-[var(--interve-text-title)]"
                  )}
                >
                  {model.name}
                </span>
                {model.badge && (
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] rounded-[4px]">
                    {model.badge}
                  </span>
                )}
              </div>
              {model.description && (
                <p className="text-[12px] text-[var(--interve-text-secondary)] text-left leading-relaxed">
                  {model.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  /* ── Compact dropdown mode ── */
  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 h-8 px-3 rounded-[var(--radius-sm)]",
          "text-[13px] font-medium text-[var(--interve-text-body)]",
          "border border-[var(--interve-border)] bg-white/90",
          "transition-all duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
          "hover:bg-white hover:border-[var(--interve-border-hover)]",
          isOpen && "border-[var(--interve-border-focus)] shadow-[var(--interve-shadow-focus)]",
          className
        )}
      >
        {selectedModel?.icon && <span className="w-4 h-4">{selectedModel.icon}</span>}
        <span>{selectedModel?.name ?? "Select model"}</span>
        <svg className={cn("w-3.5 h-3.5 text-[var(--interve-text-secondary)] transition-transform duration-[var(--motion-fast)]", isOpen && "rotate-180")} viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] z-50 interve-glass-heavy rounded-[var(--radius-md)] shadow-[var(--interve-shadow-hover)] p-1 animate-[interve-fade-slide-up_var(--motion-fast)_var(--ease-primary)]">
          {models.map((model) => {
            const isSelected = model.id === value;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => { onChange?.(model.id); setIsOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] text-left",
                  "transition-colors duration-[var(--motion-micro)]",
                  isSelected
                    ? "bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)]"
                    : "text-[var(--interve-text-body)] hover:bg-[var(--interve-bg-accent)]"
                )}
              >
                {model.icon && <span className="w-5 h-5 shrink-0">{model.icon}</span>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate">{model.name}</span>
                    {model.badge && (
                      <span className="px-1 py-0.5 text-[9px] font-medium bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] rounded-[3px]">
                        {model.badge}
                      </span>
                    )}
                  </div>
                  {model.description && (
                    <p className="text-[11px] text-[var(--interve-text-secondary)] truncate">{model.description}</p>
                  )}
                </div>
                {isSelected && (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
