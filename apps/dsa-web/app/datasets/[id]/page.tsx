"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Database } from "lucide-react";
import { getDataset, type DatasetProfile } from "@/lib/api";
import { PageHeader, HeaderActionLink } from "@/app/components/data/PageHeader";
import { StatCard } from "@/app/components/data/StatCard";
import { DataTable } from "@/app/components/data/DataTable";
import { EmptyState, ErrorState, PageSkeleton } from "@/app/components/data/StateBlocks";
import { StatusBadge } from "@/app/components/data/StatusBadge";
import { Tabs } from "@/app/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

// shadcn Tabs + Card + Table (https://ui.shadcn.com/docs/components/tabs)
export default function DatasetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<DatasetProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("preview");

  useEffect(() => {
    let alive = true;
    getDataset(decodeURIComponent(id))
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: unknown) => alive && (setData(null), setError(e instanceof Error ? e.message : "Failed to load dataset")));
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Step 1 · Bring your data" title="Dataset" description="Profile, schema, preview, and lineage for one dataset." />
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Step 1 · Bring your data" title="Dataset" description="Loading profile…" />
        <Card className="p-5"><PageSkeleton rows={4} /></Card>
      </div>
    );
  }

  const previewRows = (data.preview ?? []) as Record<string, unknown>[];
  const previewCols = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 1 · Bring your data"
        title={data.file}
        description={`Format ${data.format} · Created ${data.created} · ID ${data.id}`}
        actions={
          <>
            <HeaderActionLink href="/datasets">← Datasets</HeaderActionLink>
            <Link href={`/analysis?dataset=${encodeURIComponent(data.id)}`} className={cn(buttonVariants({ size: "sm" }))}>
              Analyze this dataset →
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Dataset stats">
        <StatCard label="Rows" value={String(data.rows)} icon={Database} />
        <StatCard label="Columns" value={String(data.cols)} />
        <StatCard label="Format" value={data.format} />
        <StatCard label="Hash" value={data.hash ? `${data.hash.slice(0, 10)}…` : "—"} hint={data.hash ?? "No hash recorded"} />
      </section>

      <Tabs
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: "preview", label: "Preview" },
          { value: "schema", label: "Schema" },
          { value: "analyses", label: "Analyses" },
          { value: "lineage", label: "Lineage" },
        ]}
      />

      {tab === "preview" ? (
        previewRows.length === 0 ? (
          <Card className="p-0"><EmptyState title="No preview rows" description="The API returned no preview for this dataset." /></Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-zinc-50/80">
                    {previewCols.map((c) => (
                      <th key={c} className="h-10 whitespace-nowrap px-4 text-left align-middle text-xs font-medium text-zinc-500">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                      {previewCols.map((c) => (
                        <td key={c} className="max-w-56 truncate p-4 align-middle font-mono text-xs text-zinc-700">{String(r[c] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}

      {tab === "schema" ? (
        (data.schema ?? []).length === 0 ? (
          <Card className="p-0"><EmptyState title="No schema" description="The API returned no column schema for this dataset." /></Card>
        ) : (
          <DataTable
            ariaLabel="Schema"
            rows={(data.schema ?? []).map((s, i) => ({ _i: String(i), ...s }))}
            rowKey={(r) => String(r._i)}
            columns={[
              { key: "name", header: "Column", sortable: true, render: (r) => <span className="font-mono text-xs font-medium">{String(r.name)}</span>, sortValue: (r) => String(r.name) },
              { key: "type", header: "Type", render: (r) => <span className="font-mono text-xs text-zinc-600">{String(r.type)}</span> },
            ]}
          />
        )
      ) : null}

      {tab === "analyses" ? (
        (data.analyses ?? []).length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="No linked analyses"
              description="Ask a question on this dataset to create the first evidence-linked run."
              action={<Link href={`/analysis?dataset=${encodeURIComponent(data.id)}`} className={cn(buttonVariants({ size: "sm" }))}>Ask a question</Link>}
            />
          </Card>
        ) : (
          <Card className="divide-y divide-zinc-100 p-0">
            {(data.analyses ?? []).map((a) => (
              <Link key={a.id} href={`/analysis/${encodeURIComponent(a.runId ?? a.id)}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-zinc-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900">{a.objective ?? a.query ?? a.id}</span>
                  <span className="block font-mono text-xs text-zinc-500">{a.id}</span>
                </span>
                <StatusBadge status={a.status} />
              </Link>
            ))}
          </Card>
        )
      ) : null}

      {tab === "lineage" ? (
        (data.lineage ?? []).length === 0 ? (
          <Card className="p-0"><EmptyState title="No lineage" description="No lineage steps were returned for this dataset." /></Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Lineage</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative ml-1 space-y-4 border-l border-zinc-200 pl-5">
                {(data.lineage ?? []).map((l, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden className="absolute -left-[26px] h-5 w-5 rounded-full border border-zinc-200 bg-white" />
                    <p className="text-sm font-medium text-zinc-900">{l.step}</p>
                    <p className="text-sm leading-6 text-zinc-600">{l.detail}</p>
                    <p className="font-mono text-xs text-zinc-500">{l.at}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
