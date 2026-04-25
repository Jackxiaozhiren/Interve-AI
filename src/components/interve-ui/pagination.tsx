"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface IntervePaginationProps {
  current: number;
  total: number;
  pageSize?: number;
  onChange?: (page: number) => void;
  mode?: "standard" | "simple" | "mini";
  className?: string;
}

export function IntervePagination({
  current,
  total,
  pageSize = 10,
  onChange,
  mode = "standard",
  className,
}: IntervePaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const handlePrev = () => { if (current > 1) onChange?.(current - 1); };
  const handleNext = () => { if (current < totalPages) onChange?.(current + 1); };

  const btnBase = cn(
    "inline-flex items-center justify-center rounded-[var(--radius-sm)]",
    "transition-all duration-[var(--motion-micro)] ease-[var(--ease-primary)]",
    "text-[13px] font-medium select-none"
  );
  const btnSize = mode === "mini" ? "w-7 h-7" : "w-8 h-8";

  const pageBtn = (page: number) => (
    <button
      key={page}
      type="button"
      onClick={() => onChange?.(page)}
      className={cn(
        btnBase,
        btnSize,
        page === current
          ? "bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)]"
          : "text-[var(--interve-text-body)] hover:bg-[var(--interve-bg-accent)]"
      )}
    >
      {page}
    </button>
  );

  const chevronLeft = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const chevronRight = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  // Generate page numbers with ellipsis
  const getPages = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (current > 3) pages.push("...");
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  if (mode === "simple") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <button type="button" onClick={handlePrev} disabled={current <= 1} className={cn(btnBase, btnSize, "text-[var(--interve-text-body)] hover:bg-[var(--interve-bg-accent)] disabled:opacity-30 disabled:cursor-not-allowed")}>{chevronLeft}</button>
        <span className="text-[13px] text-[var(--interve-text-body)] tabular-nums">{current} / {totalPages}</span>
        <button type="button" onClick={handleNext} disabled={current >= totalPages} className={cn(btnBase, btnSize, "text-[var(--interve-text-body)] hover:bg-[var(--interve-bg-accent)] disabled:opacity-30 disabled:cursor-not-allowed")}>{chevronRight}</button>
      </div>
    );
  }

  if (mode === "mini") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <button type="button" onClick={handlePrev} disabled={current <= 1} className={cn(btnBase, btnSize, "text-[var(--interve-text-secondary)] disabled:opacity-30")}>{chevronLeft}</button>
        <button type="button" onClick={handleNext} disabled={current >= totalPages} className={cn(btnBase, btnSize, "text-[var(--interve-text-secondary)] disabled:opacity-30")}>{chevronRight}</button>
      </div>
    );
  }

  return (
    <nav className={cn("flex items-center gap-1", className)} aria-label="Pagination">
      <button type="button" onClick={handlePrev} disabled={current <= 1} className={cn(btnBase, btnSize, "text-[var(--interve-text-body)] hover:bg-[var(--interve-bg-accent)] disabled:opacity-30 disabled:cursor-not-allowed")}>{chevronLeft}</button>
      {getPages().map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} className="w-8 text-center text-[var(--interve-text-placeholder)]">…</span>
        ) : (
          pageBtn(p)
        )
      )}
      <button type="button" onClick={handleNext} disabled={current >= totalPages} className={cn(btnBase, btnSize, "text-[var(--interve-text-body)] hover:bg-[var(--interve-bg-accent)] disabled:opacity-30 disabled:cursor-not-allowed")}>{chevronRight}</button>
    </nav>
  );
}
