# SECURITY

> Details: `docs/audit/SECURITY_REPORT.md` + `docs/audit/MASTER_AUDIT.md` P0-2/P0-3/P0-6/P0-7. Exceptions below are release-accepted with reachability notes.

- AuthN/Z: signed HMAC sessions + `proxy.ts` page guards + per-route `guardRequest` (401 anon, forged-cookie rejection, tamper rejection). Supabase `002` owner (`authenticated=auth.uid()`) + contained anon (`user_id IS NULL`); live RLS/IDOR tests pending staging (static contract pins migration).
- Abuse: per-IP fixed-window limits (10-30/min, `Retry-After`/`RateLimit-*`, 429), 128KB-8MB byte caps (413), Zod I/O (400), POST-only AI surface, client+server abort, bounded retries (2 / 1-with-fallback), model allowlist (no client `model`).
- Uploads: 5MB + 60k-char OCR caps, SVG refusal, MIME+size double-check, `data:image/*`-only vision (provider-SSRF kill). `pdfjs-dist` HIGH removed.
- Injection (LLM01): `UNTRUSTED` fences + treat-as-data on top-5 prompts; keyed injection suite measures drift≤20 + no flips/markers.
- Output (LLM10): safe markdown path; strict CSP allowlist + Upstash multi-instance limits tracked (current CSP has `unsafe-inline`/`connect *` — documented, not silent).
- Secrets/PII: 0 secret hits; server-only keys (import-graph verified); PII-free structured logs (`requestId/aiCallId/sessionId/latency/provider/model/tokens/retries`, never raw resume/transcript/keys); JD-out-of-URL, transcript session-scoped.
- Deps: `npm audit` 39 post-fix (sharp/onnx chains aliased out of browser, never imported server-side; postcss/ws/uuid/etc. build/dev-nested) — upgrade lane Next 16.3.4. SAST today = `tsc` strict + ESLint hooks + Zod I/O + POST-only surface test; CodeQL/Semgrep lane tracked for CI.
