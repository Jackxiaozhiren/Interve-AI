import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/lib/utils";

// Source: https://ui.shadcn.com/docs/components/badge (status mapping on top)
const STATUS_MAP: Record<string, "success" | "danger" | "warning" | "default" | "outline"> = {
  COMPLETED: "success",
  SUCCEEDED: "success",
  OK: "success",
  PASS: "success",
  PASSED: "success",
  SUCCESS: "success",
  FAILED: "danger",
  FAIL: "danger",
  ERROR: "danger",
  RUNNING: "warning",
  PENDING: "warning",
  QUEUED: "warning",
  CANCELLED: "default",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status.trim().toUpperCase();
  const variant = STATUS_MAP[key] ?? (key.includes("FAIL") || key.includes("ERROR") ? "danger" : key.includes("RUN") || key.includes("PEND") ? "warning" : key.includes("COMPLET") || key === "OK" ? "success" : "default");
  const dot =
    variant === "success"
      ? "bg-emerald-500"
      : variant === "danger"
        ? "bg-red-500"
        : variant === "warning"
          ? "bg-amber-500"
          : "bg-zinc-400";
  return (
    <Badge variant={variant} className={cn(className)} aria-label={`status: ${status}`}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {status}
    </Badge>
  );
}
