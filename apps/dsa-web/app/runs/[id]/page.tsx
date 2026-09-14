"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL, apiUrl, type RunDetail } from "@/lib/api";
import { PageHeader } from "@/app/components/data/PageHeader";
import { StatusBadge } from "@/app/components/data/StatusBadge";
import { TraceTimeline } from "@/app/components/data/TraceTimeline";
import { EmptyState, ErrorState, PageSkeleton } from "@/app/components/data/StateBlocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

// Uses apiUrl("/runs/:id") directly — lib/api.ts signatures untouched.
async function fetchRun(id: string): Promise<RunDetail> {
  const res = await fetch(apiUrl(`/runs/${encodeURIComponent(id)}`), { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return (await res.json()) as RunDetail;
}

export default function RunByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = use(params);
  const id = decodeURIComponent(raw);
  const [data, setData] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchRun(id)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: unknown) => alive && (setData(null), setError(e instanceof Error ? e.message : "Failed to load run")));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Step 3 · Inspect the evidence" title="Run" description={`Run ${id} · ${API_BASE_URL}/runs/${id}`} />
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Step 3 · Inspect the evidence" title="Loading run…" description={`Run ${id}`} />
        <Card className="p-5"><PageSkeleton rows={4} /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 3 · Inspect the evidence"
        title={data.objective}
        description={`Run ${data.id} · status preserved with full fetch fields`}
        actions={
          <>
            <StatusBadge status={data.status} />
            <Link href={`/runs/${encodeURIComponent(data.id)}/replay`} className={cn(buttonVariants({ size: "sm" }))}>Replay →</Link>
            <Link href={`/analysis/${encodeURIComponent(data.id)}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Open trace →</Link>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Plan</CardTitle></CardHeader>
          <CardContent>
            {(data.plan ?? []).length === 0 ? <EmptyState title="No plan" description="No plan steps returned." /> : <TraceTimeline plan={data.plan ?? []} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-zinc-700">
            <p><span className="font-medium text-zinc-900">Status:</span> {data.status}</p>
            <p><span className="font-medium text-zinc-900">Evidence items:</span> {(data.evidence ?? []).length}</p>
            <p><span className="font-medium text-zinc-900">Tool calls:</span> {(data.trace ?? []).length}</p>
            <p><span className="font-medium text-zinc-900">Artifacts:</span> {(data.artifacts ?? []).length}</p>
            <p className="font-mono text-xs text-zinc-500">id {data.id} · objective {data.objective}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
