import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Inbox } from "lucide-react";
import { buttonVariants } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/feedback";
import { safeErrorText } from "@/lib/format";
import { cn } from "@/lib/utils";

// Source: shadcn/ui empty + error conventions (hand-built, zinc minimal)
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-400">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </div>
      <h3 className="mt-4 text-sm font-semibold tracking-tight text-zinc-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-zinc-500">{description}</p>
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function StubEmptyState({ backHref = "/analysis", backLabel = "Go to Analysis" }: { backHref?: string; backLabel?: string }) {
  return (
    <EmptyState
      title="Under construction"
      description="This section is a placeholder stub. Start from Analysis to produce real evidence, then return here."
      action={
        <Link href={backHref} className={cn(buttonVariants({ size: "sm" }))}>
          {backLabel}
        </Link>
      }
    />
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  // Never dump raw HTML: callers pass Error.message only.
  const safe = safeErrorText(message);
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
      <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {title}
      </div>
      <p className="text-sm leading-6 text-red-700/90">{safe || "Request failed. Check API status and retry."}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-red-200 bg-white")}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading" aria-busy="true">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
