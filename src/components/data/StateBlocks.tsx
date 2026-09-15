"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ─── StateBlocks ──────────────────────────────────────────────
   全站统一空态 / 错误态：图标 + 标题 + 描述 + CTA。
   空态视觉沿用 InterveEmptyState 规范（64px 图标容器）。
---------------------------------------------------------------- */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

function DefaultIcon({ label }: { label: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#86909C"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-20 text-center", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F0FF]">
        {icon ?? <DefaultIcon label="空态插画" />}
      </div>
      <h3 className="mt-6 text-[18px] font-medium text-[#1D2129]">{title}</h3>
      {description && (
        <p className="mt-3 max-w-xs text-center text-[14px] text-[#86909C]">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-8">
          <Button className="rounded-full">{actionLabel}</Button>
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <Button onClick={onAction} className="mt-8 rounded-full">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  /** 只展示纯文本错误信息，禁止 dump HTML */
  message?: string;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "加载失败",
  message = "请检查网络后重试。",
  onRetry,
  backHref,
  backLabel = "返回",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center px-4 py-20 text-center", className)}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
          aria-label="错误"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="mt-6 text-[18px] font-medium text-[#1D2129]">{title}</h3>
      <p className="mt-3 max-w-sm text-center text-[14px] text-[#86909C]">{message}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button onClick={onRetry} className="rounded-full">
            重试
          </Button>
        )}
        {backHref && (
          <Link href={backHref}>
            <Button variant="outline" className="rounded-full">
              {backLabel}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
