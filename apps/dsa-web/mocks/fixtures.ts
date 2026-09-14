/**
 * Shared mock fixtures for DSA web (vitest + Playwright).
 * Covers: COMPLETED / FAILED / RUNNING, confidence in 0~1 and >1 (percent-style),
 * and empty-array boundaries. Mirrors `openapi.json` schemas.
 */
import type {
  AnalysisRun,
  BenchmarkRow,
  Dataset,
  DatasetProfile,
  RunDetail,
} from "@/lib/api";

export const fixtureDatasets: Dataset[] = [
  { id: "sales_q3", file: "sales_q3.csv", format: "csv", rows: 1250, cols: 8, created: "2026-08-01T10:00:00Z", hash: "a3f9c1" },
  { id: "churn_2026", file: "churn_2026.csv", format: "csv", rows: 8420, cols: 12, created: "2026-08-12T09:30:00Z", hash: "77bd02" },
  { id: "events_json", file: "events.json", format: "json", rows: 312, cols: 5, created: "2026-08-20T14:15:00Z", hash: "e10a9d" },
  { id: "empty_table", file: "empty_table.csv", format: "csv", rows: 0, cols: 0, created: "2026-09-01T08:00:00Z", hash: "000000" },
  { id: "survey_wave9", file: "survey_wave9.csv", format: "csv", rows: 2048, cols: 24, created: "2026-09-05T16:45:00Z", hash: "c41f7b" },
  { id: "ops_metrics", file: "ops_metrics.json", format: "json", rows: 96, cols: 6, created: "2026-09-10T11:20:00Z", hash: "9d2e44" },
];

export const fixtureAnalyses: AnalysisRun[] = [
  { id: "run_001", runId: "run_001", objective: "Revenue grew 12% in Q3", query: "Why did revenue grow in Q3?", dataset: "sales_q3", status: "COMPLETED", created: "2026-09-01T10:00:00Z" },
  { id: "run_002", runId: "run_002", objective: "Churn drivers by cohort", query: "What drives churn?", dataset: "churn_2026", status: "RUNNING", created: "2026-09-02T10:00:00Z" },
  { id: "run_003", runId: "run_003", objective: "Event funnel drop-off", query: "Where do users drop off?", dataset: "events_json", status: "FAILED", created: "2026-09-03T10:00:00Z" },
  { id: "run_004", runId: "run_004", objective: "Empty table sanity check", query: "Anything in here?", dataset: "empty_table", status: "COMPLETED", created: "2026-09-04T10:00:00Z" },
  { id: "run_005", runId: "run_005", objective: "Survey sentiment split", query: "How is sentiment trending?", dataset: "survey_wave9", status: "PENDING", created: "2026-09-05T10:00:00Z" },
];

function baseRun(overrides: Partial<RunDetail> & Pick<RunDetail, "id" | "objective" | "status">): RunDetail {
  return {
    plan: [],
    trace: [],
    evidence: [],
    insights: [],
    limitations: [],
    artifacts: [],
    ...overrides,
  };
}

export const fixtureRunDetails: RunDetail[] = [
  baseRun({
    id: "run_001",
    objective: "Revenue grew 12% in Q3",
    status: "COMPLETED",
    plan: [
      { step: "Load sales_q3.csv and profile columns", at: "2026-09-01T10:00:01Z" },
      { step: "Run sql_query for quarterly totals", at: "2026-09-01T10:00:03Z" },
    ],
    validation_rate: 0.92,
    trace: [
      { tool: "sql_query", status: "COMPLETED", duration_ms: 812, call_id: "call_9f2a", input: { q: "totals" }, output: { q3: 1.12 } },
      { tool: "chart_render", status: "COMPLETED", duration_ms: 120, call_id: "call_9f2b" },
    ],
    // confidence in 0~1
    evidence: [
      { claim: "Revenue grew 12% in Q3", confidence: 0.92, source: ["sales_q3.csv#row:812", "ledger#q3"], result: { delta: 0.12 } },
      { claim: "Growth concentrated in enterprise segment", confidence: 0.71, source: ["sales_q3.csv#col:segment"] },
    ],
    insights: ["Enterprise segment drove 80% of the delta."],
    limitations: ["Q3 ledger closes Sep 30; numbers may restate."],
    artifacts: [{ name: "q3_report.md", kind: "markdown" }],
    report_markdown: "# Q3 revenue\n\nRevenue grew 12% in Q3.",
  }),
  baseRun({
    id: "run_002",
    objective: "Churn drivers by cohort",
    status: "RUNNING",
    plan: [{ step: "Scan churn_2026.csv cohorts", at: "2026-09-02T10:00:01Z" }],
    trace: [{ tool: "df_profile", status: "RUNNING", duration_ms: 340, call_id: "call_ab12" }],
    evidence: [],
    insights: [],
    limitations: [],
    artifacts: [],
  }),
  baseRun({
    id: "run_003",
    objective: "Event funnel drop-off",
    status: "FAILED",
    plan: [{ step: "Parse events.json funnel", at: "2026-09-03T10:00:01Z" }],
    trace: [{ tool: "json_parse", status: "FAILED", duration_ms: 12, call_id: "call_cd34", output: { error: "truncated" } }],
    evidence: [],
    insights: [],
    limitations: ["events.json is truncated at line 300."],
    artifacts: [],
  }),
  baseRun({
    id: "run_004",
    objective: "Empty table sanity check",
    status: "COMPLETED",
    plan: [],
    validation_rate: 0,
    // empty-array boundary: trace/evidence/insights all []
    trace: [],
    evidence: [],
    insights: [],
    limitations: ["Dataset has 0 rows; nothing to verify."],
    artifacts: [],
    report_markdown: "# Empty\n\nNo rows to analyze.",
  }),
  baseRun({
    id: "run_005",
    objective: "Survey sentiment split",
    status: "COMPLETED",
    plan: [{ step: "Aggregate sentiment by wave", at: "2026-09-05T10:00:01Z" }],
    validation_rate: 85,
    trace: [{ tool: "nlp_classify", status: "COMPLETED", duration: 1.4, call_id: "call_ef56" }],
    // confidence >1 (percent-style legacy branch)
    evidence: [
      { claim: "Positive sentiment at 68%", confidence: 92, source: ["survey_wave9.csv#col:sentiment"] },
      { claim: "Wave 9 response rate fell", confidence: 61, source: ["survey_wave9.csv#col:wave"] },
    ],
    insights: ["Sentiment stable; response rate is the risk."],
    limitations: [],
    artifacts: [
      { name: "sentiment.png", kind: "image" },
      { name: "wave9.md", kind: "markdown" },
    ],
    report_markdown: "# Wave 9\n\nPositive sentiment at 68%.",
  }),
];

export const fixtureBenchmarks: BenchmarkRow[] = [
  { task: "sql_grounding", v1: 0.81, v2: 0.93, category: "grounding" },
  { task: "citation_f1", v1: 0.66, v2: 0.84, category: "grounding" },
  { task: "replay_success", v1: 0.9, v2: 0.98, category: "reproducibility" },
  { task: "trace_completeness", v1: 0.74, v2: 0.88, category: "traceability" },
  { task: "empty_grace", v1: 0.5, v2: 0.95, category: "robustness" },
  { task: "error_clarity", v1: 0.58, v2: 0.91, category: "robustness" },
];

export function fixtureDatasetProfile(id: string): DatasetProfile {
  const base =
    fixtureDatasets.find((d) => d.id === id) ?? fixtureDatasets[0];
  return {
    ...base,
    schema: [
      { name: "id", type: "integer" },
      { name: "value", type: "number" },
      { name: "label", type: "string" },
    ],
    preview: Array.from({ length: 3 }, (_, i) => ({ id: i + 1, value: (i + 1) * 10, label: `row-${i + 1}` })),
    analyses: fixtureAnalyses.filter((a) => a.dataset === base.id),
    lineage: [
      { step: "upload", detail: `${base.file} stored`, at: base.created },
      { step: "profile", detail: `${base.rows} rows × ${base.cols} cols`, at: base.created },
    ],
  };
}
