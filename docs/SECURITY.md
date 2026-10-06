# SECURITY

> Details: `docs/audit/SECURITY_REPORT.md` + `docs/audit/MASTER_AUDIT.md` P0-2/P0-3/P0-6/P0-7. Exceptions below are release-accepted with reachability notes.

- AuthN/Z: signed HMAC sessions + `proxy.ts` page guards + per-route `guardRequest` (401 anon, forged-cookie rejection, tamper rejection). Row ownership is `003_per_operation_policies.sql`'s per-operation `(select auth.uid()) = user_id`, not the older `002` `authenticated=auth.uid()` some notes still cite; `006_close_anon_bridge_content_tables.sql` then closed the anon-readable content tables. **Open, and not closable from here:** that 005+006 are actually applied to the production project is asserted by the migration files only — it needs `select * from pg_policies where tablename like 'interview%'` run against the live database, which no keyless local path can reach.
- Demo auth, stated as a decision rather than a discovery: `demo-auth: `unverified-mint``.
  `POST /api/session` (`src/app/api/session/route.ts`) still signs a session cookie for any
  well-formed identity, so "authenticated" on the AI routes means "asked and was given". Two
  steps were needed to close it and step 1 is shipped: the browser suite now signs its own
  cookie through the server's `signSession()` (`tests/helpers.ts`) instead of POSTing an
  arbitrary identity, so the hole is not load-bearing for 11 spec files and can be closed
  without breaking them. **Step 2 is deliberately not taken from here.** Verifying an upstream
  credential requires an identity CI can obtain, and there is none: the options are a second
  throwaway Supabase project for CI, or an env-gated trust branch inside an auth path — the
  second is a hole with a label on it and will not be written without an explicit decision.
  The live risk was quota multiplication, and that is closed by binding the daily budget to
  `session.id + client IP`; what remains is principled rather than urgent. Blast radius is
  bounded by `stampOwner`, which refuses content-table writes without a Supabase uid, so a
  forged identity owns nothing — and both auth forms say so in the UI
  (`或用演示账号(不保存数据)`), pinned by `tests/unit/auth-demo-disclosure.test.ts`.
  **Unblock condition:** one manual Google sign-in against a preview deployment whose origin is
  first added to Supabase's Authentication → URL Redirects allowlist. `tests/unit/demo-auth-status.test.ts`
  derives the route's actual state from its parse tree and fails if this line disagrees with it,
  if the suite starts POSTing to the mint again, or — when step 2 does land — if the UI keeps
  claiming the path is unverified after it stopped being true.
- Abuse: per-IP fixed-window limits (10-30/min, `Retry-After`/`RateLimit-*`, 429), 128KB-8MB byte caps (413), Zod I/O (400), POST-only AI surface, client+server abort, bounded retries (2 / 1-with-fallback), model allowlist (no client `model`).
- Uploads: 5MB + 60k-char OCR caps, SVG refusal, `data:image/*`-only vision (provider-SSRF kill). `pdfjs-dist` HIGH removed. The server-side gate is one allowlist test on the **client-declared** MIME (`application/pdf` or `image/*`, SVG excepted) plus two independent size checks (`file.size`, then the decoded `arrayBuffer.byteLength`); there is no magic-byte sniff, so the MIME half is a floor against accidents, not against a crafted request. `upload-image-branch: `unreachable-from-ui`` — the route's `image/* → OCR` path has no door in the product: the only caller (`/setup`) sets `accept="application/pdf"` and gates on the same string, and no keyless test can reach it (`isMockEnabled()` returns before validation, so exercising it would spend provider OCR tokens). Exposing it is a product decision about burning OCR on every photographed resume, not a defect to fix silently; `tests/unit/resume-upload-scope.test.ts` pins the asymmetry in both directions so neither side can drift without the other going red.
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
- Deps: the gate is `npm run audit:deps` (`scripts/audit-deps.mjs`), and it splits the
  tree by reachability instead of by severity alone — a critical in the shipped tree
  fails with no exception path, while criticals in the developer tree must match
  `docs/audit/deps-critical.json` in both directions, so a new one cannot land
  undisclosed and a fixed one cannot linger as a claim about a risk the repo no
  longer carries. Counts are deliberately not restated here: they come from
  `npm audit --json`, and a number in prose is a number nobody can re-check.
  Historical triage notes (pre-split): sharp/onnx chains aliased out of the browser,
  never imported server-side; postcss/ws/uuid/etc. build/dev-nested — upgrade lane
  Next 16.3.4. SAST today = `tsc` strict + ESLint hooks + Zod I/O + POST-only surface
  test; CodeQL/Semgrep lane tracked for CI.
