"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listRuns, type AnalysisRun } from "@/lib/api";
import { PageHeader } from "@/app/components/data/PageHeader";
import { StatusBadge } from "@/app/components/data/StatusBadge";
import { DataTable } from "@/app/components/data/DataTable";
import { ErrorState } from "@/app/components/data/StateBlocks";
import { Card } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

export default function RunsPage() {
  const [rows, setRows] = useState<AnalysisRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listRuns()
      .then((d) => alive && (setRows(d), setError(null)))
      .catch((e: unknown) => alive && (setRows([]), setError(e instanceof Error ? e.message : "Failed to load runs")));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 3 · Inspect the evidence"
        title="Runs"
        description="Every execution with status and replay link. Nothing is hidden."
        actions={<Link href="/analysis" className={cn(buttonVariants({ size: "sm" }))}>New run →</Link>}
      />
      {error ? <ErrorState message={error} onRetry={() => window.location.reload()} /> : null}
      {rows === null ? (
        <Card className="p-5"><p className="text-sm text-zinc-500" aria-busy="true">Loading runs…</p></Card>
      ) : (
        <DataTable<AnalysisRun>
          ariaLabel="Runs"
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No runs yet"
          emptyDescription="Start from Analysis — each run appears here with trace and replay."
          emptyAction={<Link href="/analysis" className={cn(buttonVariants({ size: "sm" }))}>Start analysis</Link>}
          columns={[
            { key: "id", header: "ID", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
            { key: "objective", header: "Objective", sortable: true, render: (r) => <span className="max-w-64 truncate font-medium text-zinc-900">{r.objective ?? r.query ?? "—"}</span>, sortValue: (r) => r.objective ?? r.query ?? "" },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "created", header: "Created", sortable: true, render: (r) => <span className="font-mono text-xs text-zinc-500">{r.created ?? "—"}</span>, sortValue: (r) => r.created ?? "" },
            { key: "trace", header: "Trace", render: (r) => <Link href={`/analysis/${encodeURIComponent(r.runId ?? r.id)}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Trace →</Link> },
            { key: "replay", header: "Replay", render: (r) => <Link href={`/runs/${encodeURIComponent(r.runId ?? r.id)}/replay`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Replay →</Link> },
          ]}
        />
      )}
    </div>
  );
}
