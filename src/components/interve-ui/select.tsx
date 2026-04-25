"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface InterveSelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  size?: "lg" | "md" | "sm";
  label?: string;
  className?: string;
}

const sizeStyles = {
  lg: "h-12 px-4 text-[15px]",
  md: "h-10 px-3.5 text-[14px]",
  sm: "h-8 px-3 text-[13px]",
};

export function InterveSelect({
  options, value, onChange, placeholder = "Please select...",
  disabled = false, multiple = false, searchable = false,
  size = "md", label, className,
}: InterveSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedValues = React.useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !search) return options;
    return options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search, searchable]);

  const selectedLabels = React.useMemo(
    () => selectedValues.map((v) => options.find((o) => o.value === v)?.label).filter(Boolean),
    [selectedValues, options]
  );

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (v: string) => {
    if (multiple) {
      const next = selectedValues.includes(v) ? selectedValues.filter((x) => x !== v) : [...selectedValues, v];
      onChange?.(next);
    } else {
      onChange?.(v);
      setIsOpen(false);
      setSearch("");
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full" ref={containerRef}>
      {label && <label className="text-[13px] font-medium text-[var(--interve-text-body)]">{label}</label>}
      <div className="relative">
        <button type="button" disabled={disabled} onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn("w-full flex items-center justify-between border outline-none rounded-[var(--radius-md)] bg-white/90 border-[var(--interve-border)] transition-all duration-[var(--motion-fast)] ease-[var(--ease-primary)] hover:border-[var(--interve-border-hover)] hover:bg-white", isOpen && "border-[var(--interve-border-focus)] shadow-[var(--interve-shadow-focus)] scale-[1.01]", disabled && "bg-[#F7F8FA] text-[var(--interve-text-disabled)] cursor-not-allowed", sizeStyles[size], className)}>
          <span className="flex-1 text-left truncate">
            {multiple && selectedLabels.length > 0 ? (
              <span className="flex items-center gap-1 flex-wrap">
                {selectedLabels.map((lbl, i) => (
                  <span key={selectedValues[i]} className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)] rounded-[6px]">
                    {lbl}
                    <button type="button" onClick={(e) => { e.stopPropagation(); onChange?.(selectedValues.filter((x) => x !== selectedValues[i])); }} className="hover:text-[var(--interve-danger-text)]">×</button>
                  </span>
                ))}
              </span>
            ) : selectedLabels.length === 1 ? (
              <span className="text-[var(--interve-text-title)]">{selectedLabels[0]}</span>
            ) : (
              <span className="text-[var(--interve-text-placeholder)]">{placeholder}</span>
            )}
          </span>
          <svg className={cn("w-4 h-4 shrink-0 ml-2 text-[var(--interve-text-secondary)] transition-transform duration-[var(--motion-fast)]", isOpen && "rotate-180")} viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 interve-glass-heavy rounded-[var(--radius-md)] shadow-[var(--interve-shadow-hover)] max-h-[240px] overflow-y-auto animate-[interve-fade-slide-up_var(--motion-fast)_var(--ease-primary)]">
            {searchable && (
              <div className="p-2 border-b border-[var(--interve-divider)]">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." autoFocus className="w-full h-8 px-3 text-[13px] bg-[var(--interve-bg-secondary)] border border-[var(--interve-border)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--interve-border-focus)] placeholder:text-[var(--interve-text-placeholder)]" />
              </div>
            )}
            <div className="p-1">
              {filteredOptions.length === 0 && <div className="px-3 py-4 text-center text-[13px] text-[var(--interve-text-secondary)]">No results found</div>}
              {filteredOptions.map((opt) => {
                const sel = selectedValues.includes(opt.value);
                return (
                  <button type="button" key={opt.value} disabled={opt.disabled} onClick={() => handleSelect(opt.value)}
                    className={cn("w-full flex items-center gap-2 px-3 py-2 text-left rounded-[var(--radius-sm)] text-[14px] transition-colors duration-[var(--motion-micro)]", sel ? "bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)]" : "text-[var(--interve-text-body)] hover:bg-[var(--interve-bg-accent)]", opt.disabled && "opacity-40 cursor-not-allowed")}>
                    {opt.icon && <span className="shrink-0 w-4 h-4">{opt.icon}</span>}
                    <span className="flex-1 truncate">{opt.label}</span>
                    {sel && <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
