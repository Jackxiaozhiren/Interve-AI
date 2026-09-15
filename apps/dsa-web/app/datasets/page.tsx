"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, FlaskConical, UploadCloud } from "lucide-react";
import { apiUrl, checkApiHealth, listDatasets, type Dataset } from "@/lib/api";
import { PageHeader } from "@/app/components/data/PageHeader";
import { DataTable } from "@/app/components/data/DataTable";
import { ErrorState } from "@/app/components/data/StateBlocks";
import { StatusBadge } from "@/app/components/data/StatusBadge";
import { Button, buttonVariants } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/feedback";
import { cn } from "@/lib/utils";

// shadcn Card + Button + Progress (https://ui.shadcn.com/docs/components/card)
export default function DatasetsPage() {
  const [rows, setRows] = useState<Dataset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [api, setApi] = useState<string>("checking");
  const [dragOver, setDragOver] = useState(false);

  const load = () => {
    listDatasets()
      .then((d) => {
        setRows(d);
        setError(null);
        setApi("checked");
      })
      .catch((e: unknown) => {
        setRows([]);
        setError(e instanceof Error ? e.message : "Failed to load datasets");
      });
    checkApiHealth().then((s) => setApi(s)).catch(() => setApi("down"));
  };

  useEffect(() => {
    load();
  }, []);

  async function uploadFile(file: File) {
    setUploading(true);
    setProgress(10);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setProgress(45);
      const res = await fetch(apiUrl("/datasets"), { method: "POST", body: form });
      setProgress(80);
      if (!res.ok) throw new Error(`Upload failed (${res.status}: ${res.statusText})`);
      setProgress(100);
      load();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message.replace(/<[^>]*>/g, "") : "Upload failed. Check file format (CSV/JSON) and API status.");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 1 · Bring your data"
        title="Datasets"
        description="Upload CSV or JSON once, then reuse rows, columns, format, and hash across every analysis."
        actions={
          <Link href="/analysis" className={cn(buttonVariants({ size: "sm" }))}>
            <FlaskConical className="h-4 w-4" aria-hidden /> Analyze →
          </Link>
        }
      />

      {/* Upload card */}
      <Card>
        <CardContent className="pt-5">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload dataset by dropping a file or pressing Enter to browse"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void uploadFile(f);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") document.getElementById("dataset-file")?.click();
            }}
            className={cn(
              "flex flex-col items-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
              dragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 bg-white"
            )}
          >
            <UploadCloud className="h-6 w-6 text-zinc-400" aria-hidden />
            <p className="mt-2 text-sm font-medium text-zinc-900">Drag & drop CSV / JSON here</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Format hint: .csv, .json · progress shown below · errors stay friendly</p>
            <label htmlFor="dataset-file" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 cursor-pointer")}>
              Browse files
            </label>
            <input
              id="dataset-file"
              type="file"
              accept=".csv,.json"
              className="sr-only"
              aria-label="Choose dataset file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
              }}
            />
            {uploading || progress > 0 ? (
              <div className="mt-4 w-full max-w-sm">
                <Progress value={progress} />
                <p className="mt-1 font-mono text-xs text-zinc-500">{uploading ? `Uploading… ${Math.round(progress)}%` : "Done"}</p>
              </div>
            ) : null}
            {uploadError ? <p role="alert" className="mt-3 max-w-md text-sm text-red-600">{uploadError}</p> : null}
          </div>
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {/* Table: File/Format/Rows/Cols/Created/View/Analyze */}
      {rows === null ? (
        <Card className="p-5"><p className="text-sm text-zinc-500" aria-busy="true">Loading datasets…</p></Card>
      ) : (
        <DataTable<Dataset>
          ariaLabel="Datasets"
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No datasets yet"
          emptyDescription="Upload your first CSV or JSON to begin Step 1."
          emptyAction={
            <label htmlFor="dataset-file" className={cn(buttonVariants({ size: "sm" }), "cursor-pointer")}>
              Upload dataset
            </label>
          }
          columns={[
            { key: "file", header: "File", sortable: true, render: (r) => <span className="font-medium text-zinc-900">{r.file}</span>, sortValue: (r) => r.file },
            { key: "format", header: "Format", render: (r) => <span className="font-mono text-xs text-zinc-600">{r.format}</span> },
            { key: "rows", header: "Rows", sortable: true, render: (r) => <span className="font-mono text-xs">{r.rows}</span>, sortValue: (r) => r.rows },
            { key: "cols", header: "Cols", sortable: true, render: (r) => <span className="font-mono text-xs">{r.cols}</span>, sortValue: (r) => r.cols },
            { key: "created", header: "Created", sortable: true, render: (r) => <span className="font-mono text-xs text-zinc-500">{r.created}</span>, sortValue: (r) => r.created },
            {
              key: "view", header: "View", render: (r) => (
                <Link href={`/datasets/${encodeURIComponent(r.id)}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))} aria-label={`View ${r.file}`}>
                  <Eye className="h-3.5 w-3.5" aria-hidden /> View
                </Link>
              ),
            },
            {
              key: "analyze", header: "Analyze →", render: (r) => (
                <Link href={`/analysis?dataset=${encodeURIComponent(r.id)}`} className={cn(buttonVariants({ size: "sm" }))} aria-label={`Analyze ${r.file}`}>
                  Analyze <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ),
            },
          ]}
        />
      )}

      {/* Hidden status for a11y/tests: keep id/created/hash visible via table; show API diagnostics */}
      <details className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-medium text-zinc-900">API diagnostics</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          <span>API status:</span>
          <StatusBadge status={api === "up" ? "COMPLETED" : api === "down" ? "FAILED" : "RUNNING"} />
          <span className="font-mono">GET /datasets · POST /datasets · GET /health</span>
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </div>
      </details>
    </div>
  );
}
