# SECURITY

> Details: `docs/audit/SECURITY_REPORT.md` + `docs/audit/MASTER_AUDIT.md` P0-2/P0-3/P0-6/P0-7. Exceptions below are release-accepted with reachability notes.

- AuthN/Z: signed HMAC sessions + `proxy.ts` page guards + per-route `guardRequest` (401 anon, forged-cookie rejection, tamper rejection). Row ownership is `003_per_operation_policies.sql`'s per-operation `(select auth.uid()) = user_id`, not the older `002` `authenticated=auth.uid()` some notes still cite; `006_close_anon_bridge_content_tables.sql` then closed the anon-readable content tables. **Open, and not closable from here:** that 005+006 are actually applied to the production project is asserted by the migration files only — it needs `select * from pg_policies where tablename like 'interview%'` run against the live database, which no keyless local path can reach.
- Abuse: per-IP fixed-window limits (10-30/min, `Retry-After`/`RateLimit-*`, 429), 128KB-8MB byte caps (413), Zod I/O (400), POST-only AI surface, client+server abort, bounded retries (2 / 1-with-fallback), model allowlist (no client `model`).
- Uploads: 5MB + 60k-char OCR caps, SVG refusal, MIME+size double-check, `data:image/*`-only vision (provider-SSRF kill). `pdfjs-dist` HIGH removed.
- Injection (LLM01): `UNTRUSTED` fences + treat-as-data on top-5 prompts; keyed injection suite measures drift≤20 + no flips/markers.
- Output (LLM10): safe markdown path; one enforced CSP (`src/proxy.ts`), scoped to
  the origins the app really fetches and pinned by
  `tests/unit/csp-scope.test.ts`, which re-derives the inline-style count and the
  host↔disclosure mapping every run. `style-src 'unsafe-inline'` and
  `connect-src *` remain and are stated here rather than glossed: the first is
  required by 57 `style={{}}` attributes across 34 files plus Next's own inline
  bootstrap script (nonces need a custom server this deployment does not have),
  and the second by the runtime model download.
- Rate limiting: **per instance, in-memory.** There is no Upstash or other
  shared store in `package.json` or `src/`, so an earlier claim of
  "multi-instance limits" was wrong and is corrected here. The ceiling that does
  hold across instances is the per-caller daily AI budget, keyed on
  `session.id + client IP` (`user-budget.ts`), which is why it is bound to the IP
  and not the session alone.
- Secrets/PII: 0 secret hits; server-only keys (import-graph verified); PII-free structured logs (`requestId/aiCallId/sessionId/latency/provider/model/tokens/retries`, never raw resume/transcript/keys); JD-out-of-URL, transcript session-scoped.
- Deps: `npm audit` 39 post-fix (sharp/onnx chains aliased out of browser, never imported server-side; postcss/ws/uuid/etc. build/dev-nested) — upgrade lane Next 16.3.4. SAST today = `tsc` strict + ESLint hooks + Zod I/O + POST-only surface test; CodeQL/Semgrep lane tracked for CI.
