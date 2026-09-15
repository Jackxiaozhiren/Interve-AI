# STABILIZATION_REPORT (Phase 2 Gate)

> Base: HEAD `f37f574` + Phase 1 audit. All changes incremental; no feature
> deleted, no prompt/model behavior changed, no migration history rewritten.

## 1. Gate results (2026-09-03, fresh `npm ci` + vitest 3.2.7)

| Command | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings (was 0 errors / 13 warnings) |
| `npm run typecheck` (`tsc --noEmit`) | PASS |
| `npm run test` (vitest unit + integration) | 5 files, 49/49 PASS, no network/keys |
| `npm run build` (`next build`) | PASS, 36 routes |
| `npm run verify` (lint+typecheck+test+build) | PASS (exit 0) |
| `npm run test:e2e:smoke` (chrome-1280x720, 9 root spec files) | 14 passed, 3 skipped (keyed AI suite, fixme) |
| `npx playwright test --project=chrome-1280x720` (entire suite incl. `tests/e2e/`) | **17 passed, 3 skipped, exit 0** (2.1 min, workers=1) |
| `npm run test:e2e` (full 12-project matrix) | NOT run locally (needs firefox/webkit/msedge + provider keys) — CI lane; `testMatch` fixed to `**/*.spec.ts` so Playwright no longer executes vitest files |
| `npm audit` |Re-run before release (vitest added; Phase 0 baseline was 62 vulns) |

## 2. What was fixed

### 2.1 Build quality (5.1)
- Unified scripts: `lint / typecheck / test / test:unit / test:integration / test:e2e / test:e2e:smoke / test:a11y / build / verify`.
- Added `vitest@3.2.7` (dev only; v5 conflicts with pinned `@types/node@20`, so v3 — documented, revisit on node upgrade) + `vitest.config.ts` (node env, unit+integration include, `@` alias mirror).
- `tests/helpers.ts`: real session seeding via `POST /api/session` (replaces dead `interve_auth_user` key).

### 2.2 Lint/type/build (5.2)
- Removed 5 stale `eslint-disable` (interview ×4, api-client ×1); narrowed file-level disable to `@typescript-eslint/no-explicit-any` with debt pointer; fixed `useLiveQuery` stale closure with documented disable; GreenRoom stream cleanup via ref mirror (fixes `exhaustive-deps` properly); removed dead `messages` prop (CopilotPanel + caller), dead `isDegraded` flag, dead `SnakeToCamelCase/CamelToSnakeCase` types; unbound catches (`catch {`); LoginForm requires non-empty password (anti-mistake, still demo-grade — documented).
- `src/proxy.ts`: `export default` → named `export function proxy` (Next 16 contract; the guard was likely inert before).

### 2.3 Database reconciliation (5.3)
- `0001`/`001` kept verbatim for history. New `supabase/migrations/002_session_ownership.sql` (additive, idempotent): nullable `user_id UUID` ×7, owner indexes ×7, drops the 7 open policies, creates strict `Owner full access` (`TO authenticated`, `auth.uid()=user_id`) + contained `Legacy anon unowned access` (`TO anon`, `user_id IS NULL` both clauses). Rollback SQL embedded in file header.
- Decision basis: destructive rewrite would strand existing projects; nullable columns keep the demo working while owned rows become anon-invisible the moment Auth lands.

### 2.4 Sessions + RLS transition (5.4)
- `src/lib/api/session.ts` (WebCrypto HMAC, edge-safe): same cookie name, signed envelope `{v:1,id,email,username,iat,exp/24h}`; legacy unsigned cookies fail closed (one re-login). Prod without `SESSION_SECRET` (≥16 chars) fails closed; dev uses loud deterministic fallback.
- `POST/GET/DELETE /api/session`: schema-validated issuance (30/min), introspection, clearing. `AuthContext` now takes its authority from the HttpOnly server cookie (localStorage kept for UI only). `proxy.ts` verifies signatures and protects `/dashboard /setup /interview /chat /recruiter /practice` (+ `/api/dashboard`); forged `{"id":"x"}` cookies no longer pass.
- RLS tests: `tests/integration/rls-policies.test.ts` pins the migration contract (7 drops, 7 owner policies on `auth.uid()`, 7 contained anon policies, 7 indexes, no `USING(true)`). Live RLS tests need a staging project — tracked as Phase 3 prerequisite (see §4).

### 2.5 API hardening (5.5)
- New `src/lib/api/`: `guard.ts` (fixed order: requestId → IP rate limit → session → size+Zod), `session.ts`, `rate-limit.ts` (fixed-window, documented single-instance), `validate.ts` (content-length fast path + actual-byte cap + Zod, no body echo), `errors.ts` (standard `{error:{code,message},requestId}` + `x-request-id`), `logging.ts` (PII-free JSON lines), `request-id.ts` (trace-safe echo).
- All 16 AI routes + `/api/session`: session-required (401), Zod inputs (400), byte caps 128KB–8MB (413), per-IP limits 10–30/min with `Retry-After`/`RateLimit-*` (429), combined client+server abort, explicit `maxRetries` (1 where manual fallback exists, else 2), model name in logs only. Prompts, models, output shapes unchanged — except: `parse-jd questionCount` clamped 1–20 (was unbounded cost vector), `analyze-vision` accepts `data:image/*` only (kills provider-side fetch/SSRF), `copilot/trends` outputs Zod-checked with same fallback behavior, `parse-resume` enforces the advertised 5MB server-side + refuses SVG + caps OCR text at 60k chars.
- 25 API contract tests (`tests/integration/api-hardening.test.ts`): 401×17, 400×(all+malformed+clamp+vision-scheme+missing-file), 413×(JSON+5MB+SVG), 429 (31-hit flood, zero AI calls), session issue/verify/forge matrix. Unit: session (8), rate-limit (4), validate+request-id (6).

### 2.6 Product resilience found by the new tests (all verified green after fix)
- Setup "Start without Mic" was disabled while hardware probed — now enabled while probing (label's promise; GreenRoom re-checks). `confirmAndStart` falls back to `local-<uuid>` sessions when the DB is unreachable (honors "Supabase Optional"). Replay page no longer spins forever on DB failure (added missing `.catch`).
- E2E suite repaired without deleting tests: EN locators, real session helper, `?id` preflight params, real setup selections, empty-state-aware dashboard assertions, `domcontentloaded` waits (model workers defeat `networkidle`), scaffold `example.spec.ts` (tested playwright.dev) replaced by local `landing.spec.ts`. `chat.spec.ts` → `describe.fixme` (needs provider keys; re-enable with Phase 3 AI-eval harness).

## 3. Major decisions (basis)

| Decision | Basis | Reversibility |
|---|---|---|
| Transitional (not full) Supabase Auth | Full cutover needs staging project + email/OAuth + backfill; doing it blind risks breaking all flows (violates incremental rule) | 002 schema + signed sessions are the on-ramp; cutover plan §4 |
| Session-required AI APIs + guarded pages (ends anonymous demo) | 16/16 unauthenticated + `thinking+65536` + no caps = unbounded quota burn (P0-3 evidence) | One-click mock login preserves demo; limits documented per route |
| In-memory rate limit | Zero new infra for Phase 2; single-instance true for standalone/dev | Upstash lane tracked for multi-instance |
| Keep `hireVerdict`/scoring prompts untouched | Truthfulness/governance redesign is Phase 3–4 scope (rubric engine); Phase 2 must not half-edit eval semantics | Flagged, not fixed — see §4 |

## 4. Remaining / deferred (not hidden)

1. **Supabase Auth cutover + live RLS/IDOR tests** (needs staging project): flip login/signup to Auth, backfill `user_id`, verify anon-denied + cross-user-denied against live DB.
2. **Keyed AI e2e + AI Eval harness** (needs funded keys with caps): re-enable `chat.spec.ts`, add golden/stability/injection/fairness evals.
3. **Full 12-project matrix + multi-instance limits + strict CSP allowlist + remaining 14 `set-state-in-effect` suppressions + `api-client` typed rewrite** — all tracked in MASTER_AUDIT P1–P3.
4. **Residual risks**: anon-key direct DB access to legacy (`user_id IS NULL`) rows persists until cutover; cookie sessions are unforgeable but not yet phishing-resistant (no MFA — out of scope); demo auth still accepts any identity (documented in login code + report).

## 5. Files changed (summary)

- Added: `src/lib/api/*` (6), `src/app/api/session/route.ts`, `supabase/migrations/002_session_ownership.sql`, `vitest.config.ts`, `tests/unit/*` (3), `tests/integration/*` (2), `tests/helpers.ts`, `tests/landing.spec.ts`, `docs/audit/STABILIZATION_REPORT.md`.
- Modified: `package.json`/lock (scripts + vitest), `.env.example` (SESSION_SECRET), `src/proxy.ts`, `src/context/AuthContext.tsx`, 16 API routes (+session), setup/interview/replay pages, 4 components, `src/lib/api-client.ts`, 10 spec files. Removed: `tests/example.spec.ts` (external scaffold → local equivalent).

---

## 6. Phase 2 delta 2026-09-14 (HEAD `bc69d30`, V2 lane)

### 6.1 Lint root-cause: build output was being linted

Fresh `npm run lint` reported **859 errors / 13301 warnings**, but JSON-format triage proved **all of it came from `apps/dsa-web/.next/**` build artifacts** — the flat config only ignored root `.next/**`, not nested ones. Real-source signal was **4 errors / 0 warnings**. Fix (no suppression, no rule weakening):

- `eslint.config.mjs`: added `**/.next/**`, `**/out/**`, `coverage/**`, `playwright-report/**`, `test-results/**` to `ignores`. Result: `npm run lint` → **0 errors, 0 warnings**.
- `src/components/layout/Footer.tsx`: 9 internal `<a href="/…">` → `<Link>` (kept `/api/session` + `#` anchors as `<a>` — correct, not page navigations). Fixes 2× `@next/next/no-html-link-for-pages`.
- `apps/dsa-web/app/datasets/page.tsx`: moved synchronous `setError(null)` out of the effect path into promise callbacks; `useEffect(() => { load(); }, [])`. Same behavior, no cascading render. Fixes `react-hooks/set-state-in-effect`.
- `apps/dsa-web/tests/dsa/helpers.ts` + 3 spec files: `useMocks` → `shouldUseMocks` (a plain env reader misnamed as a hook, called inside `mockApiController`). Fixes `react-hooks/rules-of-hooks`. Zero behavior change.

### 6.2 DB: `003_per_operation_policies.sql` (additive, idempotent, zero behavior change)

- Splits 002's two `FOR ALL` policies per table into per-operation `SELECT/INSERT/UPDATE/DELETE` policies with **identical predicates** (owner: `((select auth.uid()) = user_id)` TO authenticated; anon: `(user_id IS NULL)` TO anon). 14 drops + 56 creates, parens/structure machine-checked.
- Basis: Supabase one-policy-per-operation guidance (`TECH_RESEARCH.md` §A #3, §C #21). Enables future least-privilege edits (e.g. anon SELECT-only) without touching owner write paths.
- Contract: `tests/integration/rls-policies.test.ts` += 4 tests (10 total) pinning 003 — history intact, 14 drops, 4×7 owner per-op with exact predicates, 4×7 NULL-gated anon per-op, no executable `FOR ALL`.
- NOT done (blocked, tracked): type reconciliation UUID↔BIGSERIAL (needs staging `db reset` to see which baseline won — destructive either way, must not guess); Auth cutover + `user_id` backfill; live dual-user denial tests; anon NULL-bridge removal.

### 6.3 API hardening: no change needed

Phase 1 subagent verified all 18 routes already sit behind `guardRequest` (requestId → IP limit → session → maxBytes+Zod, per-route timeouts, `Retry-After`/`RateLimit-*`). `npm run test` green confirms the 401/400/413/429 matrices still hold.
