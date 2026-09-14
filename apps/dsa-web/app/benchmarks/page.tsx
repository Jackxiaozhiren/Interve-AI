"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Copy, Check } from "lucide-react";
import { listBenchmarks, type BenchmarkRow } from "@/lib/api";
import { PageHeader } from "@/app/components/data/PageHeader";
import { StatCard } from "@/app/components/data/StatCard";
import { EmptyState, ErrorState, PageSkeleton } from "@/app/components/data/StateBlocks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { ChartContainer, ChartLegendDot } from "@/app/components/ui/chart";
import { buttonVariants } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

// Source: https://www.tremor.so (bar/donut comparison idea) via Recharts v3 + https://ui.shadcn.com/docs/components/base/chart (ChartContainer)
const RUNNER = "npm run eval -- --suite v2 --tasks all";

export default function BenchmarksPage() {
  const [rows, setRows] = useState<BenchmarkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    listBenchmarks()
      .then((d) => alive && (setRows(d), setError(null)))
      .catch((e: unknown) => alive && (setRows([]), setError(e instanceof Error ? e.message : "Failed to load benchmarks")));
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const avg = (k: "v1" | "v2") => rows.reduce((s, r) => s + r[k], 0) / rows.length;
    return { v1: avg("v1"), v2: avg("v2"), n: rows.length };
  }, [rows]);

  const donut = useMemo(() => {
    if (!rows) return [];
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.category ?? "uncategorized", (m.get(r.category ?? "uncategorized") ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  async function copyRunner() {
    try {
      await navigator.clipboard.writeText(RUNNER);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 3 · Inspect the evidence"
        title="Benchmarks"
        description="V1 vs V2 on task success, evidence accuracy, and SQL accuracy. Categories show coverage."
        actions={
          <button type="button" onClick={copyRunner} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            {copied ? <><Check className="h-3.5 w-3.5" aria-hidden /> Copied</> : <><Copy className="h-3.5 w-3.5" aria-hidden /> Copy runner command</>}
          </button>
        }
      />

      {rows === null ? (
        <Card className="p-5"><PageSkeleton rows={3} /></Card>
      ) : error && rows.length === 0 ? (
        <div className="space-y-3">
          <ErrorState message={error} onRetry={() => window.location.reload()} />
          <Card className="p-0">
            <EmptyState
              title="No benchmark data"
              description={`Run benchmarks locally, then reload. Command: ${RUNNER}`}
              action={
                <button type="button" onClick={copyRunner} className={cn(buttonVariants({ size: "sm" }))}>
                  Copy command
                </button>
              }
            />
          </Card>
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No benchmark data"
            description={`The API returned zero rows. Run: ${RUNNER}`}
            action={
              <button type="button" onClick={copyRunner} className={cn(buttonVariants({ size: "sm" }))}>
                Copy command
              </button>
            }
          />
        </Card>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-3">
            <StatCard label="V1 mean" value={stats ? stats.v1.toFixed(2) : "—"} hint={`${stats?.n ?? 0} tasks`} />
            <StatCard label="V2 mean" value={stats ? stats.v2.toFixed(2) : "—"} hint="Target: beat V1" />
            <StatCard label="Delta" value={stats ? `${(stats.v2 - stats.v1 >= 0 ? "+" : "") + (stats.v2 - stats.v1).toFixed(2)}` : "—"} hint="V2 − V1" />
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <Card>
              <CardHeader>
                <CardTitle>V1 vs V2 by task</CardTitle>
                <CardDescription>Task success / evidence / SQL accuracy comparison.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex gap-4">
                  <ChartLegendDot color="#3f3f46" label="V1" />
                  <ChartLegendDot color="#10b981" label="V2" />
                </div>
                <ChartContainer ariaLabel="V1 vs V2 bar chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="task" tick={{ fontSize: 11 }} interval={0} angle={-18} dy={8} height={56} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="v1" name="V1" fill="#3f3f46" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="v2" name="V2" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category distribution</CardTitle>
                <CardDescription>Task count per category.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer ariaLabel="Category donut">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                        {donut.map((_, i) => (
                          <Cell key={i} fill={i % 2 === 0 ? "#10b981" : "#3f3f46"} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Trend (V1 → V2)</CardTitle>
              <CardDescription>Line view across tasks in returned order.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer ariaLabel="Benchmark trend line">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey="task" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="v1" name="V1" stroke="#3f3f46" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="v2" name="V2" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
              <p className="mt-2 font-mono text-xs text-zinc-500">Runner: {RUNNER}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
