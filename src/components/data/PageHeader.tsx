"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ─── PageHeader ───────────────────────────────────────────────
   全站统一页头：eyebrow + H1 + description + actions。
   来源：shadcn/ui Typography 规范 + TailAdmin 页头结构。
   https://ui.shadcn.com/docs/components/base/typography
   https://github.com/TailAdmin/free-nextjs-admin-dashboard
---------------------------------------------------------------- */

export interface PageHeaderProps {
  /** 步骤/分类眉题，如 "Step 3 · Review" */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = "返回",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            <span aria-hidden="true">←</span> {backLabel}
          </Link>
        )}
        {eyebrow && (
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            {eyebrow}
          </p>
        )}
        <h1 className="tracking-tight text-slate-900 text-3xl md:text-4xl font-semibold leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
