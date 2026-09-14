"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, FlaskConical, Loader2 } from "lucide-react";
import { listDatasets, runAnalysis, type Dataset } from "@/lib/api";
import { PageHeader } from "@/app/components/data/PageHeader";
import { ErrorState } from "@/app/components/data/StateBlocks";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Select, Textarea } from "@/app/components/ui/input";

// shadcn Select + Textarea + Button (https://ui.shadcn.com/docs/components/textarea)
const EXAMPLES = [
  "What drove revenue change last quarter?",
  "Which segment has the highest churn and why?",
  "Summarize anomalies with evidence and confidence.",
];

function AnalysisForm() {
  const router = useRouter();
  const search = useSearchParams();
  const preset = search.get("dataset") ?? "";
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dataset, setDataset] = useState(preset);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    listDatasets()
      .then((d) => {
        setDatasets(d);
        setLoadError(null);
        if (preset && d.some((x) => x.id === preset)) setDataset(preset);
        else if (d.length > 0 && !dataset) setDataset(d[0].id);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Failed to load datasets"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRun() {
    if (!dataset || !query.trim() || loading) return;
    setLoading(true);
    setRunError(null);
    try {
      const run = await runAnalysis(dataset, query.trim());
      const id = run.runId ?? run.id;
      router.push(`/analysis/${encodeURIComponent(id)}`);
    } catch (e) {
      setRunError(e instanceof Error ? e.message.replace(/<[^>]*>/g, "") : "Run failed");
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
          <CardDescription>Pick a dataset, write a plain-English objective, and run. Every step is traced.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError ? <ErrorState message={loadError} onRetry={() => window.location.reload()} /> : null}
          <div>
            <label htmlFor="dataset" className="mb-1.5 block text-sm font-medium text-zinc-900">Dataset</label>
            <Select id="dataset" value={dataset} onChange={(e) => setDataset(e.target.value)} aria-label="Dataset">
              <option value="">Select a dataset…</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>{d.file} · {d.rows} rows · {d.cols} cols</option>
              ))}
            </Select>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="query" className="block text-sm font-medium text-zinc-900">Question</label>
              <span className="font-mono text-xs text-zinc-500" aria-live="polite">{query.length}/500</span>
            </div>
            <Textarea
              id="query"
              value={query}
              maxLength={500}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. What drove revenue change last quarter?"
              aria-describedby="query-help"
            />
            <p id="query-help" className="mt-1 text-xs text-zinc-500">Be specific: metric, window, and segment.</p>
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Example questions">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setQuery(ex)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          {runError ? <ErrorState title="Run failed" message={runError} /> : null}
          <Button onClick={onRun} disabled={!dataset || !query.trim() || loading} className="w-full sm:w-auto">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Running…</> : <><FlaskConical className="h-4 w-4" aria-hidden /> Run analysis</>}
          </Button>
        </CardContent>
      </Card>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>How verification works</CardTitle>
            <CardDescription>Sticky guide · Step 2 Ask → Step 3 Inspect.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Execute", "The planner calls logged tools with call_id and duration."],
              ["Verify", "Each claim shows confidence and source chain."],
              ["Reproduce", "Open the trace, copy the report Markdown, or replay the run."],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-zinc-900">{t}</p>
                  <p className="text-sm leading-6 text-zinc-600">{d}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 2 · Ask your question"
        title="Analysis"
        description="Run an evidence-linked analysis. Objective, dataset, and query are preserved end-to-end."
      />
      <Suspense fallback={<Card className="p-5"><p className="text-sm text-zinc-500">Loading…</p></Card>}>
        <AnalysisForm />
      </Suspense>
    </div>
  );
}
