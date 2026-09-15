# DATA_POLICY — what we collect, store, and why

> User-facing twin: Dashboard → Privacy Center (view/export/delete live).
> This file is the durable policy behind that UI.

## Defaults (privacy-first)

| Data | Default |
|---|---|
| Raw microphone audio | Never stored. Transcribed in-memory, discarded per segment. |
| Camera video / frames | Never leaves the device. Self-view preview only, zero analysis, zero upload. |
| Whiteboard snapshots | Sent per explicit review taps only (`analyze-vision`); originals not persisted. |
| Transcripts, resumes, JDs, evaluations | Stored ONLY to deliver reports/replay/progress; user-deletable per session or in bulk; exportable as JSON. |
| Browser snapshots | Local-only recovery cache, auto-expires after 30 days. |
| Telemetry | Endpoint/latency/status only. No bodies, no transcripts, no keys. |

## Legal/transit notes (no overclaiming)

- TLS in transit; Supabase platform encryption at rest. No app-level field
  encryption is claimed — column-level encryption is tracked work.
- Third-party processors: Zhipu / Google / OpenAI (only keys the deployer
  configures) receive the minimum content each feature needs; OCR/vision
  payloads are data-URLs, never remote fetches.
- No sale of data, no ads profiling, no cross-candidate analytics surface.

## Retention & rights

- Cloud rows: retained until the user deletes them (per-session or bulk in
  Privacy Center). No automatic server purge exists yet — a scheduled-purge
  job is tracked (needs Supabase scheduled functions).
- Local snapshots: 30-day expiry enforced on read.
- Rights supported in-product: view (inventory), export (JSON), delete
  (per session, bulk, local). Account deletion = delete-all + logout
  (Supabase Auth cutover will add server-side user erasure).
