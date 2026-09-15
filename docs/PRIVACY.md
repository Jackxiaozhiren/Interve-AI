# PRIVACY

> Details: `docs/ai-governance/DATA_POLICY.md` + `/dashboard/privacy` (Privacy Center UI).

- Collect: resume/JD (explicit upload/paste), transcripts/answers, delivery observables (WPM/filler/pauses/latency), diagrams/code snapshots, settings. Never by default: raw audio/video, camera frames (local-only self-view, never stored/scored).
- Store: Supabase (with `002` ownership) or local fallback; transcripts session-scoped (not forever-localStorage); whiteboard keys namespaced; 90-day purge + delete/export round-trip APIs (retention job dry-run tracked).
- Purpose: practice training only — never employer screening, never emotion/personality/protected-attribute inference (banned list in `LIMITATIONS.md`, enforced by `prohibitions.test.ts`).
- Who reads: row owners only (`auth.uid()=user_id` post-cutover); legacy NULL rows anon-contained until backfill (documented exception).
- Rights: Privacy Center shows collection/storage/purpose/retention + delete/export controls; `dicebear?seed=email` + `console.error` PII vectors fixed/audited; resume encryption in transit, redaction + OCR consent logged.
