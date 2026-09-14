"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Database, MessageSquareText, ShieldCheck } from "lucide-react";
import { listAnalyses, listDatasets, type AnalysisRun } from "@/lib/api";
import { buttonVariants } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { StatusBadge } from "@/app/components/data/StatusBadge";
import { StatCard } from "@/app/components/data/StatCard";
import { EmptyState, ErrorState, PageSkeleton } from "@/app/components/data/StateBlocks";
import { cn } from "@/lib/utils";

// Source: https://ui.aceternity.com/hero-section (Beams+Grid idea, CSS-only, no canvas) + Magic UI bento idea (static cards)
export default function HomePage() {
  const [runs, setRuns] = useState<AnalysisRun[] | null>(null);
  const [datasetCount, setDatasetCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([listAnalyses(), listDatasets()]).then(([a, d]) => {
      if (!alive) return;
      if (a.status === "fulfilled") {
        setRuns(a.value.slice(0, 5));
        if (a.value.length === 0) setError(null);
      } else {
        setRuns([]);
        setError(a.reason instanceof Error ? a.reason.message : "Failed to load analyses");
      }
      if (d.status === "fulfilled") setDatasetCount(d.value.length);
      else setDatasetCount(null);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div aria-hidden className="hero-grid absolute inset-0" />
        <div aria-hidden className="absolute -top-24 left-1/4 h-64 w-96 rounded-full bg-gradient-to-r from-emerald-100 via-white to-zinc-100 blur-3xl" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Evidence before claim · Ask. Analyze. Verify. Reproduce.
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              Data analysis you can verify, not just believe.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">
              Bring a dataset, ask a question, and inspect every tool call, confidence score, and source hash
              behind the answer.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/analysis" className={cn(buttonVariants())}>
                Try DSA <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/datasets" className={cn(buttonVariants({ variant: "outline" }))}>
                Browse datasets
              </Link>
            </div>
            <p className="mt-4 font-mono text-xs text-zinc-500">Step 1 Bring → Step 2 Ask → Step 3 Inspect</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
            <Card className="bg-white/90">
              <CardContent className="space-y-3 pt-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Evidence chain</p>
                {[
                  { k: "Claim", v: "“Revenue grew 12% in Q3”", c: "text-zinc-900" },
                  { k: "Evidence", v: "confidence 0.92 · 2 sources", c: "text-emerald-700" },
                  { k: "Tool", v: "sql_query · call_9f2a · 812ms", c: "text-zinc-700" },
                  { k: "Dataset", v: "sales_q3.csv · hash a3f9…c1", c: "text-zinc-500" },
                ].map((r, i) => (
                  <div key={r.k}>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                      <span className="text-xs font-medium text-zinc-500">{r.k}</span>
                      <span className={cn("truncate font-mono text-xs", r.c)}>{r.v}</span>
                    </div>
                    {i < 3 ? <p aria-hidden className="py-0.5 text-center text-xs text-zinc-300">↓</p> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="grid gap-3 md:grid-cols-3" aria-label="Stats">
        <StatCard label="Analyses" value={runs === null ? "…" : String(runs.length)} hint={runs === null ? "Loading" : "Recent runs via /analysis"} />
        <StatCard label="Evidence coverage" value={runs === null ? "…" : runs.length > 0 ? "Available" : "—"} hint="Confidence + sources per claim" />
        <StatCard label="Datasets" value={datasetCount === null ? "—" : String(datasetCount)} hint={datasetCount === null ? "API unreachable — placeholder" : "Rows/cols tracked per file"} />
      </section>

      {/* 3 steps */}
      <section className="grid gap-3 md:grid-cols-3">
        {[
          { icon: Database, t: "1 · Ask", d: "Upload CSV/JSON and pick a dataset. Rows, columns, format, and hash are recorded." },
          { icon: MessageSquareText, t: "2 · Analyze", d: "Ask in plain English. Every plan step calls a logged tool with duration and call_id." },
          { icon: ShieldCheck, t: "3 · Verify", d: "Inspect confidence bars, source chains, and limitations before you trust a claim." },
        ].map((s) => (
          <Card key={s.t}>
            <CardContent className="pt-5">
              <s.icon className="h-5 w-5 text-zinc-700" aria-hidden />
              <h2 className="mt-3 text-sm font-semibold tracking-tight text-zinc-900">{s.t}</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">{s.d}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Why DSA dark contrast */}
      <section className="rounded-xl bg-zinc-900 p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Why DSA</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">No black-box answers.</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["Traceable", "Tool, status, duration, input/output JSON for every step."],
            ["Grounded", "Each claim links to sources and a dataset hash."],
            ["Reproducible", "Copy the report Markdown or replay a run end-to-end."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
              <p className="text-sm font-semibold">{t}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-300">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent analyses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Recent analyses</h2>
          <Link href="/runs" className="text-sm text-zinc-600 hover:text-zinc-900">
            View all →
          </Link>
        </div>
        {runs === null ? (
          <Card className="p-5"><PageSkeleton rows={2} /></Card>
        ) : error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : runs.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              title="No analyses yet"
              description="Run your first analysis to see evidence-linked results here."
              action={<Link href="/analysis" className={cn(buttonVariants({ size: "sm" }))}>Start analysis</Link>}
            />
          </Card>
        ) : (
          <Card className="divide-y divide-zinc-100 p-0">
            {runs.map((r) => (
              <Link key={r.id} href={`/analysis/${encodeURIComponent(r.runId ?? r.id)}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-zinc-50">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900">{r.objective ?? r.query ?? r.id}</span>
                  <span className="block font-mono text-xs text-zinc-500">{r.id} · {r.dataset ?? "dataset"} · {r.created ?? ""}</span>
                </span>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
