"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { getReplay, type RunDetail } from "@/lib/api";
import { PageHeader } from "@/app/components/data/PageHeader";
import { StatusBadge } from "@/app/components/data/StatusBadge";
import { TraceTimeline, TraceRowMeta } from "@/app/components/data/TraceTimeline";
import { EmptyState, ErrorState, PageSkeleton } from "@/app/components/data/StateBlocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/feedback";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

export default function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = use(params);
  const id = decodeURIComponent(raw);
  const [data, setData] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getReplay(id)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: unknown) => alive && (setData(null), setError(e instanceof Error ? e.message : "Failed to load replay")));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Step 3 · Inspect the evidence" title="Replay" description={`Replay of run ${id}`} />
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Step 3 · Inspect the evidence" title="Loading replay…" description={`Run ${id}`} />
        <Card className="p-5"><PageSkeleton rows={4} /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 3 · Inspect the evidence"
        title={`Replay · ${data.objective}`}
        description={`Original run ${data.id} · GET /runs/${id}/replay preserved`}
        actions={
          <>
            <StatusBadge status={data.status} />
            <Link href={`/analysis/${encodeURIComponent(data.id)}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Open trace →</Link>
          </>
        }
      />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw className="h-4 w-4" aria-hidden /> Replay steps</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(data.plan ?? []).length > 0 ? <TraceTimeline plan={data.plan ?? []} /> : <p className="text-sm text-zinc-500">No plan recorded.</p>}
          {(data.trace ?? []).length === 0 ? (
            <EmptyState title="No trace in replay" description="Replay returned no tool calls." />
          ) : (
            <ul className="space-y-2">
              {(data.trace ?? []).map((t, i) => (
                <li key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <TraceRowMeta tool={t.tool} status={t.status} durationMs={t.duration_ms ?? t.duration} callId={t.call_id} />
                </li>
              ))}
            </ul>
          )}
          {(data.evidence ?? []).length > 0 ? (
            <div className="space-y-2">
              {(data.evidence ?? []).map((e, i) => {
                const pct = Math.round((e.confidence > 1 ? e.confidence / 100 : e.confidence) * 100);
                return (
                  <div key={i} className="rounded-lg border border-zinc-200 p-3">
                    <p className="text-sm font-medium text-zinc-900">{e.claim}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1"><Progress value={pct} /></div>
                      <span className="font-mono text-xs">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
