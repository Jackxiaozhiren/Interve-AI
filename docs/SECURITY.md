# SECURITY

> Details: `docs/audit/SECURITY_REPORT.md` + `docs/audit/MASTER_AUDIT.md` P0-2/P0-3/P0-6/P0-7. Exceptions below are release-accepted with reachability notes.

- AuthN/Z: signed HMAC sessions + `proxy.ts` page guards + per-route `guardRequest` (401 anon, forged-cookie rejection, tamper rejection). Row ownership in the *migrations* is `003_per_operation_policies.sql`'s per-operation `(select auth.uid()) = user_id`; in the *deployed* catalog it is one policy per table named `Owner full access` with `cmd = ALL` and the same `auth.uid() = user_id` predicate. The distinction is recorded here because the catalog was read (2026-10-12) and the two do not agree. The static half was weaker than it read until 2026-10-14: `tests/integration/rls-policies.test.ts` counted policies with a lazy wildcard that had no statement boundary, so opening one anon predicate — `USING (true)` on telemetry's `Legacy anon select unowned` — still counted 7 of 7 NULL-gated and the suite stayed green. Every matcher is now bounded to a single statement, and two witnesses hold that bound: RLP1 drops an owner policy's `WITH CHECK`, RLP2 opens an anon `USING`; both go red.
- Legacy anon bridge, settled by a catalog read rather than by inference: `anon-bridge: `proven``.
  On 2026-10-12 the read-only `pg_policies` SELECT in `scripts/sql/verify-anon-bridge.sql` was run
  against project `bfgglzjltfvfpobzscet` and the whole dump is in
  `docs/audit/anon-bridge-evidence.json`. It said: 14 policies, seven tables, two per table —
  `Owner full access` (TO authenticated) and `Legacy anon unowned access` (**TO anon, cmd = ALL,
  USING (user_id IS NULL)**). The bridge was therefore live on all five content tables, not only on
  `telemetry`/`achievements`, and 006 had not been applied.
  **Closed 2026-10-16.** 006 was applied to that project, and the same read now returns the policy
  set recorded in `docs/audit/anon-bridge-evidence.json`: `Owner full access` on all seven tables,
  `Legacy anon unowned access` retained on `telemetry`/`achievements` only, which is the scope 006
  states. The closure check — anon grants on the five content tables — returns zero rows. The count
  is deliberately not restated here: the artifact's own reader warning carries it, and
  `tests/unit/anon-bridge-status.test.ts` compares that number against the dump it warns about, so
  a policy added or dropped reddens the guard instead of leaving two documents to agree. The marker
  in the sentence above is compared by the same test, so neither the prose nor the file can move
  without the other.
  Two consequences that were not visible before the dump:
  *006 as written could not have closed it.* The migration drops four names — `Legacy anon
  select|insert|update|delete unowned` — which this catalog has never contained. It would have
  reported success over an open bridge, which is why 006 now also drops by predicate
  (`roles::text[] @> ARRAY['anon']::text[]` AND `user_id IS NULL`) and raises if any anon grant
  survives. That predicate had a second bug found on the day it was applied: `pg_policies.roles` is
  `name[]`, so the uncast `roles @> ARRAY['anon']::text[]` raised `42883 operator does not exist`
  and the migration aborted at the guarded step rather than closing anything — and the test that
  pinned "drops by predicate" was asserting that unrunnable spelling, so it stayed green on it.
  Both are fixed, and `tests/unit/sql-catalog-predicates.test.ts` keeps the type dimension from
  coming back.
  *The repo's own detector was blind to it.* Everything keyed on those four names
  (`LEGACY_BRIDGE_POLICIES`, `classifyBridge`) reported zero bridge rows on a catalog holding five;
  detection is keyed on what a policy grants from now on, and
  `tests/unit/anon-bridge-status.test.ts` evaluates the dump itself rather than the artifact's
  label — the comparison used to be gated on `status === "PROVEN"`, so evidence collected under a
  different label checked nothing.
  Severity today: no candidate data is exposed because every one of the seven tables holds **0
  rows** (measured, same session). The live exposure is the write path: the app creates ownerless
  rows before sign-in by design, and the first such row on `interviews` becomes readable,
  rewritable and deletable by anyone holding the publishable key. Closing it is a DDL action on
  production and belongs to the owner; the repo-side half — a migration that closes the hole that
  exists, and a guard that cannot pass while it does not — is this commit.
- Resume-index reads are partition-scoped: `orama-restore: `own-partition-only``.
  `restoreKnowledgeHub` used to fall back to the bare `resume-index` row whenever the signed-in
  account had no partition of its own. That row predates partitioning, so its `user_id` is NULL —
  there is nothing to check a caller against, and the fallback served one person's serialized
  resume to whoever signed in next. The guard missed it because it tested the wrong predicate:
  `orama-abuse` asserted the attacker never queried the *victim's namespace*, which held while the
  code read the shared row instead. An anonymous caller still resolves to the legacy id, because it
  has no partition to name and that row is already anon-readable through the bridge above — closing
  that is 006, not this. Moving a real owner's legacy row is an administrator's migration, which is
  also why `deleteKnowledgeHub` refuses to delete it. Pinned by
  `tests/unit/orama-abuse.test.ts` ("queries its own partition and nothing else"), with `ORB1`
  putting the fallback back in the falsification harness.
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
- Injection (LLM01): `UNTRUSTED` fences + treat-as-data, measured as 17 of 20 modules under `src/ai/prompts/`. `tests/unit/prompt-fence-inventory.test.ts` enumerates `PROMPT_REGISTRY` and makes every lane answer whether it carries candidate text, fencing it or justifying the exemption, so the pair cannot drift without a red test; the older "top-5 prompts" wording was a Phase-3 scope note that outlived Phase 3. The count moved off 15 on 2026-10-17 because one exemption was resting on a sentence that measured false, and to 17 the same day when the last two unlabelled client channels were fenced (`/api/interview-chat` accepts `messages` from the request body with a **client-chosen role**, `synthesizeServerState` turns assistant-role text into `questionHistory[].question`, and the coverage section quoted the last three of them into the system prompt unlabelled; separately `role`/`level` reach the prompts from `?role=` and the body with no enum behind them and were interpolated twice in instruction position, including in the prompt that produces the scores the candidate sees). That block is `UNTRUSTED PRIOR QUESTIONS` now, and the same test asserts the echo *still* reaches the prompt, so nobody can re-grant the old exemption on the old argument. Keyed injection suite measures drift≤20 + no flips/markers. Since 2026-10-17 a fence is also *sealed*: `asData()` drops the literal `UNTRUSTED … START/END` words from every payload before it is wrapped, because the check that compared a lane's boundary set with and without a marker-carrying payload came back red on **all sixteen** fenced lanes — a resume could otherwise end its own section and put the rest of itself in instruction position. `tests/unit/prompt-fence-inventory.test.ts > does not let <lane>'s payload draw its own fence` is what keeps that closed, and SEAL1/SEAL2 plant it open.
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
