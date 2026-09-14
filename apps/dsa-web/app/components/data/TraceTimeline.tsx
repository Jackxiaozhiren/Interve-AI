import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { StatusBadge } from "@/app/components/data/StatusBadge";
import { cn } from "@/lib/utils";

// Source: TailAdmin timeline reference (vertical plan timeline, zinc restyle, no admin theme)
export function TraceTimeline({ plan }: { plan: { step: string; at: string }[] }) {
  if (!plan || plan.length === 0) return null;
  return (
    <ol className="relative ml-1 space-y-4 border-l border-zinc-200 pl-5" aria-label="Plan timeline">
      {plan.map((p, i) => (
        <li key={`${p.step}-${i}`} className="relative">
          <span
            aria-hidden
            className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white"
          >
            {i === plan.length - 1 ? (
              <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            )}
          </span>
          <p className="text-sm font-medium text-zinc-900">{p.step}</p>
          <p className="font-mono text-xs text-zinc-500">{p.at}</p>
        </li>
      ))}
    </ol>
  );
}

export function TraceStatusIcon({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s.includes("RUN")) return <Loader2 className="h-4 w-4 animate-spin text-amber-600" aria-hidden />;
  if (s.includes("FAIL") || s.includes("ERROR")) return <XCircle className="h-4 w-4 text-red-600" aria-hidden />;
  if (s.includes("COMPLET") || s === "OK" || s.includes("SUCCESS")) return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  return <Circle className="h-4 w-4 text-zinc-400" aria-hidden />;
}

export function TraceRowMeta({ tool, status, durationMs, callId }: { tool: string; status: string; durationMs?: number; callId?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TraceStatusIcon status={status} />
      <span className="font-mono text-xs font-medium text-zinc-900">{tool}</span>
      <StatusBadge status={status} />
      {typeof durationMs === "number" ? (
        <span className={cn("font-mono text-xs text-zinc-500")}>{Math.round(durationMs)} ms</span>
      ) : null}
      {callId ? <span className="font-mono text-xs text-zinc-400">{callId}</span> : null}
    </div>
  );
}
