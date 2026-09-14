import { cn } from "@/lib/utils";

// Source: https://ui.shadcn.com/docs/components/skeleton + progress + separator (hand-copied)
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-zinc-100", className)} />;
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-100", className)}
    >
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-px w-full bg-zinc-200", className)} />;
}
