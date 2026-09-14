"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Copy, Check, Download } from "lucide-react";
import { getRun, type RunDetail } from "@/lib/api";
import { runValidationPct } from "@/lib/format";
import { PageHeader } from "@/app/components/data/PageHeader";
import { StatusBadge } from "@/app/components/data/StatusBadge";
import { TraceTimeline, TraceRowMeta } from "@/app/components/data/TraceTimeline";
import { EmptyState, ErrorState, PageSkeleton } from "@/app/components/data/StateBlocks";
import { Tabs } from "@/app/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Progress, Separator } from "@/app/components/ui/feedback";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

// Core evidence-chain page. shadcn Tabs + Card + Progress + Table (https://ui.shadcn.com/docs/components/tabs)
function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? "";
  } catch {
    return String(v);
  }
}

export default function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const id = decodeURIComponent(runId);
  const [data, setData] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    getRun(id)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: unknown) => alive && (setData(null), setError(e instanceof Error ? e.message : "Failed to load run")));
    return () => {
      alive = false;
    };
  }, [id]);

  const validationPct = useMemo(() => runValidationPct(data), [data]);

  async function copyMarkdown() {
    if (!data?.report_markdown) return;
    try {
      await navigator.clipboard.writeText(data.report_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Step 3 · Inspect the evidence" title="Run" description={`Run ID ${id}`} />
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Step 3 · Inspect the evidence" title="Loading run…" description={`Run ID ${id}`} />
        <Card className="p-5"><PageSkeleton rows={5} /></Card>
      </div>
    );
  }

  const trace = data.trace ?? [];
  const evidence = data.evidence ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 3 · Inspect the evidence"
        title={data.objective}
        description={`Run ${data.id} · validation ${validationPct}% · ${trace.length} tool calls · ${evidence.length} claims`}
        actions={
          <>
            <span className="inline-flex"><StatusBadge status={data.status} /></span>
            {data.report_markdown ? (
              <a
                href={`data:text/markdown;charset=utf-8,${encodeURIComponent(data.report_markdown)}`}
                download={`report-${data.id}.md`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> Download report
              </a>
            ) : null}
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "trace", label: `Trace (${trace.length})` },
          { value: "evidence", label: `Evidence (${evidence.length})` },
          { value: "insights", label: "Insights" },
          { value: "artifacts", label: "Artifacts + Report" },
        ]}
      />

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader><CardTitle>Plan timeline</CardTitle><CardDescription>Every planned step with timestamp.</CardDescription></CardHeader>
            <CardContent>
              {(data.plan ?? []).length === 0 ? (
                <EmptyState title="No plan steps" description="The API returned no plan for this run." />
              ) : (
                <TraceTimeline plan={data.plan ?? []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Validation pass rate</CardTitle><CardDescription>Mean claim confidence.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full border-8 border-zinc-100 font-mono text-sm font-semibold"
                  style={{ borderTopColor: validationPct >= 70 ? "#10b981" : validationPct >= 40 ? "#f59e0b" : "#ef4444" }}
                  role="img"
                  aria-label={`Validation ${validationPct} percent`}
                >
                  {validationPct}%
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{evidence.length} claims · {trace.length} tool calls</p>
                  <p className="font-mono text-xs text-zinc-500">objective: {data.objective}</p>
                </div>
              </div>
              <Progress value={validationPct} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "trace" ? (
        trace.length === 0 ? (
          <Card className="p-0"><EmptyState title="No trace steps" description="No tool calls were returned for this run." /></Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm" aria-label="Trace">
                <thead>
                  <tr className="border-b bg-zinc-50/80">
                    {["Tool / Status / Duration", "Call ID", "Details"].map((h) => (
                      <th key={h} className="h-10 whitespace-nowrap px-4 text-left align-middle text-xs font-medium text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trace.map((t, i) => {
                    const dur = t.duration_ms ?? t.duration;
                    const cid = t.call_id ?? `call_${i}`;
                    const open = expanded === `${cid}-${i}`;
                    return (
                      <tr key={`${cid}-${i}`} className="border-b border-zinc-100 align-top last:border-0 hover:bg-zinc-50">
                        <td className="p-4">
                          <TraceRowMeta tool={t.tool} status={t.status} durationMs={typeof dur === "number" ? dur : undefined} callId={cid} />
                        </td>
                        <td className="whitespace-nowrap p-4 font-mono text-xs text-zinc-500">{cid}</td>
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => setExpanded(open ? null : `${cid}-${i}`)}
                            aria-expanded={open}
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                          >
                            {open ? "Hide input/output" : "Show input/output"}
                          </button>
                          {open ? (
                            <div className="mt-2 grid gap-2">
                              <details open className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                                <summary className="cursor-pointer font-mono text-xs font-medium">input</summary>
                                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-zinc-700">{safeJson(t.input)}</pre>
                              </details>
                              <details open className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                                <summary className="cursor-pointer font-mono text-xs font-medium">output</summary>
                                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-zinc-700">{safeJson(t.output)}</pre>
                              </details>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : null}

      {tab === "evidence" ? (
        evidence.length === 0 ? (
          <Card className="p-0"><EmptyState title="No evidence" description="No claims were returned for this run." /></Card>
        ) : (
          <div className="grid gap-3">
            {evidence.map((e, i) => {
              const pct = Math.round((e.confidence > 1 ? e.confidence / 100 : e.confidence) * 100);
              return (
                <Card key={i}>
                  <CardContent className="space-y-2 pt-5">
                    <p className="text-sm font-medium leading-6 text-zinc-900">{e.claim}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><Progress value={pct} /></div>
                      <span className="font-mono text-xs text-zinc-600">{pct}%</span>
                    </div>
                    {(e.source ?? []).length > 0 ? (
                      <p className="font-mono text-xs text-zinc-500">source chain: {(e.source ?? []).join(" → ")}</p>
                    ) : null}
                    {e.result !== undefined ? (
                      <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                        <summary className="cursor-pointer text-xs font-medium text-zinc-700">result</summary>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-zinc-700">{safeJson(e.result)}</pre>
                      </details>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {tab === "insights" ? (
        <div className="grid gap-3">
          <Card>
            <CardHeader><CardTitle>Insights</CardTitle></CardHeader>
            <CardContent>
              {(data.insights ?? []).length === 0 ? (
                <EmptyState title="No insights" description="The API returned no insights for this run." />
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700">
                  {(data.insights ?? []).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" aria-hidden /> Limitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data.limitations ?? []).length === 0 ? (
                <p className="text-sm text-zinc-500">No limitations recorded — treat claims as provisional.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
                  {(data.limitations ?? []).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "artifacts" ? (
        <div className="grid gap-3">
          <Card>
            <CardHeader><CardTitle>Artifacts</CardTitle><CardDescription>Files produced by this run (name + kind preserved).</CardDescription></CardHeader>
            <CardContent>
              {(data.artifacts ?? []).length === 0 ? (
                <EmptyState title="No artifacts" description="No artifact files were returned for this run." />
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {(data.artifacts ?? []).map((a, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-mono text-xs text-zinc-900">{a.name}</span>
                      <span className="font-mono text-xs text-zinc-500">{a.kind}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Report preview</CardTitle>
              <CardDescription>Markdown preserved verbatim · one-click copy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data.report_markdown ? (
                <EmptyState title="No report" description="The API returned no report_markdown for this run." />
              ) : (
                <>
                  <button type="button" onClick={copyMarkdown} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    {copied ? <><Check className="h-3.5 w-3.5" aria-hidden /> Copied</> : <><Copy className="h-3.5 w-3.5" aria-hidden /> Copy Markdown</>}
                  </button>
                  <Separator />
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 font-mono text-xs leading-5 text-zinc-800">{data.report_markdown}</pre>
                </>
              )}
              <Link href="/runs" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>View all runs →</Link>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
