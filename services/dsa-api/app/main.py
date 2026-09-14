"""DSA API — standalone FastAPI service (Backend choice A).

Serves the frozen contract in `apps/dsa-web/openapi.json` on :8000.
In-memory store seeded with demo fixtures; uploads are parsed (CSV/JSON).
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]
CSV_MIMES = {"text/csv", "application/csv", "application/vnd.ms-excel"}
JSON_MIMES = {"application/json", "application/ld+json"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def short_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:6]


# ---------------- Models (mirror openapi.json schemas) ----------------

class Dataset(BaseModel):
    id: str
    file: str
    format: str
    rows: int
    cols: int
    created: str
    hash: Optional[str] = None


class SchemaCol(BaseModel):
    name: str
    type: str


class LineageStep(BaseModel):
    step: str
    detail: str
    at: Optional[str] = None


class AnalysisRun(BaseModel):
    id: str
    runId: Optional[str] = None
    objective: Optional[str] = None
    query: Optional[str] = None
    dataset: Optional[str] = None
    status: str
    created: Optional[str] = None


class AnalysisRunCreate(BaseModel):
    dataset: str
    query: str = Field(min_length=1, max_length=500)


class TraceStep(BaseModel):
    tool: str
    status: str
    duration_ms: Optional[float] = None
    duration: Optional[float] = None
    call_id: Optional[str] = None
    input: Optional[Any] = None
    output: Optional[Any] = None


class EvidenceItem(BaseModel):
    claim: str
    confidence: float = Field(ge=0, le=2)
    source: Optional[list[str]] = None
    result: Optional[Any] = None


class PlanStep(BaseModel):
    step: str
    at: str


class Artifact(BaseModel):
    name: str
    kind: str


class RunDetail(BaseModel):
    id: str
    objective: str
    status: str
    plan: Optional[list[PlanStep]] = None
    validation_rate: Optional[float] = None
    trace: Optional[list[TraceStep]] = None
    evidence: Optional[list[EvidenceItem]] = None
    insights: Optional[list[str]] = None
    limitations: Optional[list[str]] = None
    artifacts: Optional[list[Artifact]] = None
    report_markdown: Optional[str] = None


class BenchmarkRow(BaseModel):
    task: str
    v1: float
    v2: float
    category: Optional[str] = None


class DatasetProfile(Dataset):
    schema: Optional[list[SchemaCol]] = None
    preview: Optional[list[dict[str, Any]]] = None
    analyses: Optional[list[AnalysisRun]] = None
    lineage: Optional[list[LineageStep]] = None


# ---------------- Seed store ----------------

def _seed() -> tuple[dict[str, dict], dict[str, dict], list[dict]]:
    datasets: dict[str, dict] = {
        "sales_q3": {"id": "sales_q3", "file": "sales_q3.csv", "format": "csv", "rows": 1250, "cols": 8, "created": "2026-08-01T10:00:00Z", "hash": "a3f9c1",
                      "schema": [{"name": "id", "type": "integer"}, {"name": "value", "type": "number"}, {"name": "label", "type": "string"}],
                      "preview": [{"id": 1, "value": 10, "label": "row-1"}, {"id": 2, "value": 20, "label": "row-2"}, {"id": 3, "value": 30, "label": "row-3"}],
                      "lineage": [{"step": "upload", "detail": "sales_q3.csv stored", "at": "2026-08-01T10:00:00Z"}, {"step": "profile", "detail": "1250 rows × 8 cols", "at": "2026-08-01T10:00:00Z"}]},
        "churn_2026": {"id": "churn_2026", "file": "churn_2026.csv", "format": "csv", "rows": 8420, "cols": 12, "created": "2026-08-12T09:30:00Z", "hash": "77bd02",
                        "schema": [{"name": "id", "type": "integer"}, {"name": "value", "type": "number"}, {"name": "label", "type": "string"}],
                        "preview": [{"id": 1, "value": 10, "label": "row-1"}],
                        "lineage": [{"step": "upload", "detail": "churn_2026.csv stored", "at": "2026-08-12T09:30:00Z"}]},
        "events_json": {"id": "events_json", "file": "events.json", "format": "json", "rows": 312, "cols": 5, "created": "2026-08-20T14:15:00Z", "hash": "e10a9d",
                         "schema": [{"name": "id", "type": "integer"}, {"name": "value", "type": "number"}],
                         "preview": [{"id": 1, "value": 10}],
                         "lineage": [{"step": "upload", "detail": "events.json stored", "at": "2026-08-20T14:15:00Z"}]},
        "empty_table": {"id": "empty_table", "file": "empty_table.csv", "format": "csv", "rows": 0, "cols": 0, "created": "2026-09-01T08:00:00Z", "hash": "000000",
                         "schema": [], "preview": [], "lineage": []},
        "survey_wave9": {"id": "survey_wave9", "file": "survey_wave9.csv", "format": "csv", "rows": 2048, "cols": 24, "created": "2026-09-05T16:45:00Z", "hash": "c41f7b",
                          "schema": [{"name": "id", "type": "integer"}, {"name": "sentiment", "type": "string"}],
                          "preview": [{"id": 1, "sentiment": "pos"}],
                          "lineage": [{"step": "upload", "detail": "survey_wave9.csv stored", "at": "2026-09-05T16:45:00Z"}]},
        "ops_metrics": {"id": "ops_metrics", "file": "ops_metrics.json", "format": "json", "rows": 96, "cols": 6, "created": "2026-09-10T11:20:00Z", "hash": "9d2e44",
                         "schema": [{"name": "id", "type": "integer"}],
                         "preview": [{"id": 1}],
                         "lineage": [{"step": "upload", "detail": "ops_metrics.json stored", "at": "2026-09-10T11:20:00Z"}]},
    }
    runs: dict[str, dict] = {
        "run_001": {"id": "run_001", "runId": "run_001", "objective": "Revenue grew 12% in Q3", "query": "Why did revenue grow in Q3?", "dataset": "sales_q3", "status": "COMPLETED", "created": "2026-09-01T10:00:00Z",
                     "plan": [{"step": "Load sales_q3.csv and profile columns", "at": "2026-09-01T10:00:01Z"}, {"step": "Run sql_query for quarterly totals", "at": "2026-09-01T10:00:03Z"}],
                     "validation_rate": 0.92,
                     "trace": [{"tool": "sql_query", "status": "COMPLETED", "duration_ms": 812, "call_id": "call_9f2a", "input": {"q": "totals"}, "output": {"q3": 1.12}}, {"tool": "chart_render", "status": "COMPLETED", "duration_ms": 120, "call_id": "call_9f2b"}],
                     "evidence": [{"claim": "Revenue grew 12% in Q3", "confidence": 0.92, "source": ["sales_q3.csv#row:812", "ledger#q3"], "result": {"delta": 0.12}}, {"claim": "Growth concentrated in enterprise segment", "confidence": 0.71, "source": ["sales_q3.csv#col:segment"]}],
                     "insights": ["Enterprise segment drove 80% of the delta."], "limitations": ["Q3 ledger closes Sep 30; numbers may restate."],
                     "artifacts": [{"name": "q3_report.md", "kind": "markdown"}], "report_markdown": "# Q3 revenue\n\nRevenue grew 12% in Q3."},
        "run_002": {"id": "run_002", "runId": "run_002", "objective": "Churn drivers by cohort", "query": "What drives churn?", "dataset": "churn_2026", "status": "RUNNING", "created": "2026-09-02T10:00:00Z",
                     "plan": [{"step": "Scan churn_2026.csv cohorts", "at": "2026-09-02T10:00:01Z"}],
                     "trace": [{"tool": "df_profile", "status": "RUNNING", "duration_ms": 340, "call_id": "call_ab12"}],
                     "evidence": [], "insights": [], "limitations": [], "artifacts": []},
        "run_003": {"id": "run_003", "runId": "run_003", "objective": "Event funnel drop-off", "query": "Where do users drop off?", "dataset": "events_json", "status": "FAILED", "created": "2026-09-03T10:00:00Z",
                     "plan": [{"step": "Parse events.json funnel", "at": "2026-09-03T10:00:01Z"}],
                     "trace": [{"tool": "json_parse", "status": "FAILED", "duration_ms": 12, "call_id": "call_cd34", "output": {"error": "truncated"}}],
                     "evidence": [], "insights": [], "limitations": ["events.json is truncated at line 300."], "artifacts": []},
        "run_004": {"id": "run_004", "runId": "run_004", "objective": "Empty table sanity check", "query": "Anything in here?", "dataset": "empty_table", "status": "COMPLETED", "created": "2026-09-04T10:00:00Z",
                     "plan": [], "validation_rate": 0, "trace": [], "evidence": [], "insights": [],
                     "limitations": ["Dataset has 0 rows; nothing to verify."], "artifacts": [], "report_markdown": "# Empty\n\nNo rows to analyze."},
        "run_005": {"id": "run_005", "runId": "run_005", "objective": "Survey sentiment split", "query": "How is sentiment trending?", "dataset": "survey_wave9", "status": "COMPLETED", "created": "2026-09-05T10:00:00Z",
                     "plan": [{"step": "Aggregate sentiment by wave", "at": "2026-09-05T10:00:01Z"}], "validation_rate": 85,
                     "trace": [{"tool": "nlp_classify", "status": "COMPLETED", "duration": 1.4, "call_id": "call_ef56"}],
                     "evidence": [{"claim": "Positive sentiment at 68%", "confidence": 92, "source": ["survey_wave9.csv#col:sentiment"]}, {"claim": "Wave 9 response rate fell", "confidence": 61, "source": ["survey_wave9.csv#col:wave"]}],
                     "insights": ["Sentiment stable; response rate is the risk."], "limitations": [],
                     "artifacts": [{"name": "sentiment.png", "kind": "image"}, {"name": "wave9.md", "kind": "markdown"}], "report_markdown": "# Wave 9\n\nPositive sentiment at 68%."},
    }
    benchmarks = [
        {"task": "sql_grounding", "v1": 0.81, "v2": 0.93, "category": "grounding"},
        {"task": "citation_f1", "v1": 0.66, "v2": 0.84, "category": "grounding"},
        {"task": "replay_success", "v1": 0.9, "v2": 0.98, "category": "reproducibility"},
        {"task": "trace_completeness", "v1": 0.74, "v2": 0.88, "category": "traceability"},
        {"task": "empty_grace", "v1": 0.5, "v2": 0.95, "category": "robustness"},
        {"task": "error_clarity", "v1": 0.58, "v2": 0.91, "category": "robustness"},
    ]
    return datasets, runs, benchmarks


DATASETS, RUNS, BENCHMARKS = _seed()

app = FastAPI(title="DSA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("x-request-id") or f"req-{uuid.uuid4().hex[:12]}"
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
    response.headers["x-request-id"] = rid
    response.headers["x-process-ms"] = str(round((time.perf_counter() - start) * 1000, 2))
    return response


def _not_found(what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{what} not found")


def _analyses_for(dataset_id: str) -> list[dict]:
    return [r for r in RUNS.values() if r.get("dataset") == dataset_id]


# ---------------- Routes ----------------

@app.get("/health", tags=["meta"])
def get_health():
    return {"status": "ok"}


@app.get("/datasets", response_model=list[Dataset], tags=["datasets"])
def list_datasets():
    return [Dataset(**{k: v for k, v in d.items() if k in Dataset.model_fields}).model_dump() for d in DATASETS.values()]


def _infer_type(values: list[str]) -> str:
    non_empty = [v for v in values if v not in ("", None)]
    if not non_empty:
        return "string"
    try:
        for v in non_empty:
            int(v)
        return "integer"
    except ValueError:
        pass
    try:
        for v in non_empty:
            float(v)
        return "number"
    except ValueError:
        pass
    return "string"


@app.post("/datasets", response_model=Dataset, status_code=201, tags=["datasets"])
async def upload_dataset(file: UploadFile = File(...)):
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds 5MB limit ({len(raw)} bytes)")
    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    # MIME double-check: declared content-type AND extension must agree on csv/json.
    # Unknown/foreign extensions are rejected even when the MIME looks friendly
    # (e.g. a renamed .pdf with text/csv must not pass).
    if ext and ext not in ("csv", "json"):
        raise HTTPException(status_code=422, detail=f"Unsupported extension .{ext}; use .csv or .json")
    is_csv = ctype in CSV_MIMES or ext == "csv"
    is_json = ctype in JSON_MIMES or ext == "json"
    if ctype in CSV_MIMES and ext == "json":
        raise HTTPException(status_code=422, detail="MIME mismatch: CSV content-type with .json extension")
    if ctype in JSON_MIMES and ext == "csv":
        raise HTTPException(status_code=422, detail="MIME mismatch: JSON content-type with .csv extension")
    if not (is_csv or is_json):
        raise HTTPException(status_code=422, detail=f"Unsupported file type (content-type={ctype or 'unknown'}, ext=.{ext or 'none'}); use .csv or .json")
    fmt = "csv" if is_csv else "json"
    try:
        if fmt == "csv":
            text = raw.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text))
            cols = reader.fieldnames or []
            rows_all = [dict(r) for r in reader]
        else:
            parsed = json.loads(raw.decode("utf-8-sig"))
            rows_all = parsed if isinstance(parsed, list) else [parsed]
            cols = sorted({k for r in rows_all if isinstance(r, dict) for k in r.keys()})
            rows_all = [r for r in rows_all if isinstance(r, dict)]
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Unparseable {fmt.upper()}: {exc}") from exc
    preview = rows_all[:20]
    schema = [{"name": c, "type": _infer_type([str(r.get(c, '')) for r in rows_all])} for c in cols]
    ds_id = filename.rsplit(".", 1)[0].lower().replace(" ", "_") or f"upload-{short_hash(raw)}"
    if ds_id in DATASETS:
        ds_id = f"{ds_id}-{short_hash(raw)}"
    record = {
        "id": ds_id, "file": filename, "format": fmt,
        "rows": len(rows_all), "cols": len(cols),
        "created": now_iso(), "hash": short_hash(raw),
        "schema": schema, "preview": preview,
        "lineage": [
            {"step": "upload", "detail": f"{filename} stored", "at": now_iso()},
            {"step": "profile", "detail": f"{len(rows_all)} rows × {len(cols)} cols", "at": now_iso()},
        ],
    }
    DATASETS[ds_id] = record
    return Dataset(**{k: record[k] for k in Dataset.model_fields})


@app.get("/datasets/{dataset_id}", response_model=DatasetProfile, tags=["datasets"])
def get_dataset(dataset_id: str):
    record = DATASETS.get(dataset_id)
    if record is None:
        raise _not_found(f"Dataset {dataset_id}")
    profile = dict(record)
    profile["analyses"] = _analyses_for(dataset_id)
    return DatasetProfile(**{k: profile.get(k) for k in DatasetProfile.model_fields})


@app.get("/analysis", response_model=list[AnalysisRun], tags=["analysis"])
def list_analyses():
    return [AnalysisRun(**{k: r.get(k) for k in AnalysisRun.model_fields}).model_dump() for r in RUNS.values()]


@app.post("/analysis", response_model=AnalysisRun, status_code=201, tags=["analysis"])
def create_analysis(body: AnalysisRunCreate):
    if body.dataset not in DATASETS:
        raise _not_found(f"Dataset {body.dataset}")
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    record = {
        "id": run_id, "runId": run_id, "objective": body.query,
        "query": body.query, "dataset": body.dataset,
        "status": "COMPLETED", "created": now_iso(),
        "plan": [{"step": f"Load {body.dataset} and profile columns", "at": now_iso()}, {"step": "Answer query with logged tool calls", "at": now_iso()}],
        "trace": [{"tool": "planner", "status": "COMPLETED", "duration_ms": 5, "call_id": f"call-{run_id[:8]}"}],
        "evidence": [{"claim": body.query, "confidence": 0.5, "source": [f"{body.dataset}#preview"]}],
        "insights": [], "limitations": ["Seeded demo run: evidence is illustrative."],
        "artifacts": [], "report_markdown": f"# {body.query}\n\nSeeded demo run over `{body.dataset}`.",
    }
    RUNS[run_id] = record
    return AnalysisRun(**{k: record[k] for k in AnalysisRun.model_fields})


@app.get("/analysis/{run_id}", response_model=RunDetail, tags=["analysis"])
def get_analysis_run(run_id: str):
    record = RUNS.get(run_id)
    if record is None:
        raise _not_found(f"Analysis run {run_id}")
    return RunDetail(**{k: record.get(k) for k in RunDetail.model_fields})


@app.get("/benchmarks", response_model=list[BenchmarkRow], tags=["benchmarks"])
def list_benchmarks():
    return BENCHMARKS


@app.get("/reports", response_model=list[AnalysisRun], tags=["reports"])
def list_reports():
    return [AnalysisRun(**{k: r.get(k) for k in AnalysisRun.model_fields}).model_dump() for r in RUNS.values()]


@app.get("/runs", response_model=list[AnalysisRun], tags=["runs"])
def list_runs():
    return [AnalysisRun(**{k: r.get(k) for k in AnalysisRun.model_fields}).model_dump() for r in RUNS.values()]


@app.get("/runs/{run_id}", response_model=RunDetail, tags=["runs"])
def get_run(run_id: str):
    record = RUNS.get(run_id)
    if record is None:
        raise _not_found(f"Run {run_id}")
    return RunDetail(**{k: record.get(k) for k in RunDetail.model_fields})


@app.get("/runs/{run_id}/replay", response_model=RunDetail, tags=["runs"])
def get_replay(run_id: str):
    record = RUNS.get(run_id)
    if record is None:
        raise _not_found(f"Run {run_id}")
    return RunDetail(**{k: record.get(k) for k in RunDetail.model_fields})
