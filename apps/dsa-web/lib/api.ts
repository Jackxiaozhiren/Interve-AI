/**
 * Data contract for DSA web frontend.
 * IMPORTANT: `apiUrl` / `API_BASE_URL` signatures are frozen — pages may only
 * change UI presentation, never the fetch contract. Backend API is untouched.
 *
 * Contract source: `openapi.json` (OpenAPI 3.1) → generated `lib/api-types.ts`
 * via `npx openapi-typescript openapi.json -o lib/api-types.ts`.
 * This module only adds type aliases below; no runtime signature changed.
 */

import type { components } from "@/lib/api-types";

/** OpenAPI-backed contract aliases (display interfaces below stay canonical). */
export type ContractDataset = components["schemas"]["Dataset"];
export type ContractDatasetProfile = components["schemas"]["DatasetProfile"];
export type ContractAnalysisRun = components["schemas"]["AnalysisRun"];
export type ContractTraceStep = components["schemas"]["TraceStep"];
export type ContractEvidenceItem = components["schemas"]["EvidenceItem"];
export type ContractRunDetail = components["schemas"]["RunDetail"];
export type ContractBenchmarkRow = components["schemas"]["BenchmarkRow"];
export type ContractError = components["schemas"]["Error"];

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${suffix}`;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/* ---------- Types (all displayed fields must be kept on screen) ---------- */

export interface Dataset {
  id: string;
  file: string;
  format: string;
  rows: number;
  cols: number;
  created: string;
  hash?: string;
}

export interface DatasetProfile extends Dataset {
  schema?: { name: string; type: string }[];
  preview?: Record<string, unknown>[];
  analyses?: AnalysisRun[];
  lineage?: { step: string; detail: string; at: string }[];
}

export interface AnalysisRun {
  id: string;
  runId?: string;
  objective?: string;
  query?: string;
  dataset?: string;
  status: string;
  created?: string;
}

export interface TraceStep {
  tool: string;
  status: string;
  duration_ms?: number;
  duration?: number;
  call_id?: string;
  input?: unknown;
  output?: unknown;
}

export interface EvidenceItem {
  claim: string;
  confidence: number;
  source?: string[];
  result?: unknown;
}

export interface RunDetail {
  id: string;
  objective: string;
  status: string;
  plan?: { step: string; at: string }[];
  validation_rate?: number;
  trace?: TraceStep[];
  evidence?: EvidenceItem[];
  insights?: string[];
  limitations?: string[];
  artifacts?: { name: string; kind: string }[];
  report_markdown?: string;
}

export interface BenchmarkRow {
  task: string;
  v1: number;
  v2: number;
  category?: string;
}

/* ---------- Fetch helpers (logic preserved, UI-only changes allowed) ---------- */

export const listDatasets = () => getJson<Dataset[]>("/datasets");
export const getDataset = (id: string) =>
  getJson<DatasetProfile>(`/datasets/${encodeURIComponent(id)}`);
export const listAnalyses = () => getJson<AnalysisRun[]>("/analysis");
export const runAnalysis = (dataset: string, query: string) =>
  postJson<AnalysisRun>("/analysis", { dataset, query });
export const getRun = (runId: string) =>
  getJson<RunDetail>(`/analysis/${encodeURIComponent(runId)}`);
export const listBenchmarks = () =>
  getJson<BenchmarkRow[]>("/benchmarks");
export const listReports = () =>
  getJson<AnalysisRun[]>("/reports");
export const listRuns = () => getJson<AnalysisRun[]>("/runs");
export const getReplay = (id: string) =>
  getJson<RunDetail>(`/runs/${encodeURIComponent(id)}/replay`);

export async function checkApiHealth(): Promise<"up" | "down"> {
  try {
    await getJson<unknown>("/health");
    return "up";
  } catch {
    return "down";
  }
}
