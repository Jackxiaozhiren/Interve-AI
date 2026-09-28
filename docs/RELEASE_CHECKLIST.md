# RELEASE_CHECKLIST — practice-only launch (Phase G3)

> Per Next.js production checklist, mapped to evidence. Checked = verified
> in-tree; OPEN = launch blocker or accepted follow-up (owner + condition).
> Bars stay provisional until A-graduation (see EVAL_REPORT §6 + GRADUATION GAP).

## Security headers & CSP

- [x] Enforcing CSP + hardening headers on every response (`src/proxy.ts:83-104`:
  CSP, nosniff, DENY frame, XSS-block, referrer, HSTS, permissions-policy).
- [x] Strict policy converging via Report-Only + live collector
  (`src/proxy.ts` report-only block, `src/app/api/csp-report/route.ts`,
  always-204, PII-free logs).
- [x] CVE-2025-29927 class pinned (`tests/integration/proxy-guard.test.ts`:
  forged `x-middleware-subrequest` still gated).
- [x] `npm audit --audit-level=critical` exit 0 (Next 16.3.5; 0 critical,
  SECURITY_REPORT §1 re-audit).

## Env & secrets

- [x] `.env*` gitignored (`.gitignore:34`) + dockerignored (`.dockerignore`,
  live-verified: no `.env*` in shipped image, G2).
- [x] Server-only keys never `NEXT_PUBLIC_*`, never logged (values never
  printed; `security-surface.test.ts` pins client-bundle hygiene).
- [x] `service_role` never in frontend (secret scan 0 hits, SECURITY_REPORT §2).
- [ ] `src/lib/supabase.ts:3-4` falls back to `placeholder.supabase.co` when
  `NEXT_PUBLIC_SUPABASE_URL` is absent. Because that value is inlined at
  **build** time, `/api/health` can report `db: ok` from a server started with
  no environment at all (measured 2026-09-26: standalone artifact, zero runtime
  env, health 200 with real 620ms/819ms probes). The check proves the baked
  project is reachable — it does NOT prove the deployment was configured.
  Decide before first deploy: keep the fallback, or fail fast at boot.

## Metadata & error surfaces

- [x] Root metadata: title template + description + OG + twitter
  (`src/app/layout.tsx:9-33`); `lang="zh-CN"`, skip link.
- [x] `robots.ts` live-verified (public 4 routes allow; gated/API disallow).
- [x] `error.tsx` + `not-found.tsx` + `loading.tsx` + `global-error.tsx` present.
  The earlier "no global-error — acceptable: root layout has no async server
  boundary needing one" rationale was wrong: `<Providers>` is a client tree that
  throws fine, and `error.tsx` explicitly does not wrap the root layout/template.
  Added 2026-09-26 and verified live (injected client throw → built → `next
  start` → Chromium: own document, `lang`, title, styles and both recovery
  actions reached the DOM). Pinned by `tests/unit/global-error-boundary.test.ts`.
- [ ] Sitemap: OPEN (non-blocking) — the blocker is NOT a missing domain.
  `https://interve-ai.vercel.app` is live and is the repo homepage (verified
  2026-09-26: HTTP 200, `/api/health` ok with real DB latency, 38 production
  deployments since 2026-04-25). What is missing is `NEXT_PUBLIC_SITE_URL` in
  the Vercel project — the live document has no `og:url`, which is how that
  reads. Set it there, then add `src/app/sitemap.ts` + `metadataBase`.

## Observability (PII-free)

- [x] Structured `logApi` on every API route (route/requestId/status/latency,
  no bodies/keys) + budget dimension (`user_budget_exceeded`) + CSP
  violation channel (`csp-report`).
- [x] Quota guardrails: C1 eval ledger + B6 per-user daily budget (429 +
  Retry-After), both keylessly pinned.

## Data & compliance (practice-only red lines)

- [x] No new hire/culture verdicts generated (F1销账 in `eval-compat.ts`
  header); legacy rows read-only + bilingual captions.
- [x] Every score ships evidence + uncertainty + training disclaimer
  (evaluation contract, Zod-enforced).
- [x] Privacy: 30-day local retention, user data export/delete
  (privacy center), `oroma_index` user-partitioned (B4-fix).

## Release mechanics

- [x] `main` is wired to auto-deploy to **Vercel Production** via the GitHub
  integration — measured 2026-09-26: every push to `main` in this session
  created a Production deployment (38 total since 2026-04-25). So "push" and
  "publish" are the same action here; there is no staging gate between them.
  Anything that treats a push as code-only is working from a wrong model.
- [x] Reproducible `docker build` green (standalone, runs: /login 200; tag
  `interve-ai:phase-g` verified 2026-09-17). Doc drift fixed 2026-09-26: this
  row claimed node:20 while the Dockerfile and the CI parity check both pin
  node:24 — so the recorded image build predates the base bump and is stale.
  Caveat 2026-09-19: NOT re-verifiable in this env (no docker daemon —
  re-run where a daemon exists before cutting the release tag).
- [x] Standalone artifact runs without Docker, verified 2026-09-26 by assembling
  exactly what the Dockerfile's runner stage copies (`standalone/` + `public/` +
  `.next/static/`) and starting `node server.js`: `/api/health` 200 with live DB
  probes, `/` 200 (81KB), `/manifest.json` 200. Covers the runtime half the
  daemon-less caveat left open; the image build itself still needs a daemon.
- [x] Deploy parity pinned in CI (`deploy consistency` step: standalone +
  node24 + no-secret-layers + default Vercel build).
- [x] Migrations additive-only with rollback notes (002/003/004).

## Production state, measured 2026-09-26

The rows below come from the live site and the Vercel dashboard, not from the
repo — the repo disagreed with reality on three counts (it claimed no prod
domain, no service worker need, and "no global-error needed").

- [x] `SESSION_SECRET` **was absent, which took down production login.**
  `POST /api/session` returned `500 CONFIG_MISCONFIGURED`; the code fails closed
  (no weak-key fallback under `NODE_ENV=production`), so it was an outage, not a
  vulnerability. Fixed same day: fresh value generated off-machine, stored as
  type Secret, scoped Production+Preview, redeployed. Verified: `200 {"ok":true}`,
  and the cookie round-trips (`POST /api/parse-jd` with an empty body is `401`
  without it, `400 VALIDATION_FAILED` with it — proves verify() passes without
  spending a model call). Env changes need a Redeploy; Redeploy does pick up
  newly added project vars.
- [x] `GOOGLE_GENERATIVE_AI_API_KEY` — was absent for five months (the dashboard
  listed only Zhipu, the two Supabase vars and `OPENAI_BASE_URL`), which meant
  `parse-jd`, `analyze-alignment` and `analyze-code` — the three routes that call
  the @ai-sdk/google default provider with no fallback model — returned 500 to any
  signed-in user. Added as type Secret (Production + Preview) and **verified live
  2026-09-26**: authenticated `POST /api/parse-jd` → 200 with real generated
  questions (title/rationale differ from `MOCK_PAYLOADS`, and `AI_MOCK` is unset),
  7–9s per call. Note the sequencing trap: the first probe after "I redeployed"
  still returned 500 because the new deployment had not finished promoting.
  Follow-up owed: the old (now revoked) key is still in `.env.local`, so these
  three routes fail locally until it is replaced.
- [x] `ZHIPU_API_KEY` re-saved as type **Secret** (it was `Config`, i.e. readable
  in the dashboard by anyone with project access). The underlying value was **not**
  rotated, so it has been readable for its whole lifetime; rotate at the source if
  a collaborator or a read-scoped integration is ever added.
- [ ] `NEXT_PUBLIC_SITE_URL` unset (live document has no `og:url`). Production has
  two further domains attached beyond `interve-ai.vercel.app` ("+2" in
  Settings → Environments); their names are unknown, so the canonical value is
  undecided. Unblock: pick the domain, set the var, redeploy, then add
  `src/app/sitemap.ts` + `metadataBase`.
- [ ] **Local dev and production share one Supabase project** — the ref in
  `.env.local` also appears in the live client bundle. Corrected 2026-09-27: the
  claim that "any local interview run writes rows into the production database"
  is false — no run from `/setup` has ever written a row (see the persistence
  blocker below), so the shared project has been harmless *for now*. It stops
  being harmless the moment persistence is fixed, which is why it is listed next
  to that blocker rather than as its own decision. Decide: accept it, or point
  dev at a second free project (migrations 001-005 are additive).
- [ ] **No interview has ever persisted** (measured 2026-09-27, P0). Read-only
  probes against the live project — `GET /rest/v1/interviews?select=<col>&limit=1`,
  which needs no rows and writes nothing — return `400` Postgres `42703`
  (undefined_column) for `interview_type`, `custom_type_description`,
  `difficulty`, `time_budget_sec`, `plan` and `evaluation_v2`, while `title`,
  `status`, `match_data` and `user_id` return `200`. So 002 *is* applied and
  these six columns never were. The same probe across all seven tables the client
  writes to leaves `evaluations`, `practice_sessions`, `telemetry`, `achievements`,
  `assessments` and `orama_index` clean — 001/002/004 are all applied, so the drift
  is confined to `interviews`: one migration, not a schema rebuild.
  `toSnakeCase()` forwards every key of the
  `Interview` contract with no whitelist and `setup/page.tsx` sets four of them
  unconditionally, so every insert is rejected — before RLS is even evaluated,
  because column resolution happens at planning. The `catch` then reported it as
  "Database unavailable", which is why the symptom kept pointing at the network.
  `supabase/migrations/005_interview_session_columns.sql` is drafted (additive,
  rollback spelled out) and **deliberately not applied**: with 42703 gone, the
  email/password path writes `user_id IS NULL` rows — `src/lib/supabase.ts` is
  `createClient(url, anonKey)` and nothing in `src/` calls `auth.setSession`, so
  every browser request runs as role `anon` — and 003's `Legacy anon select
  unowned` makes those readable by any holder of the publishable key. Applying
  005 alone converts "nobody's data saves" into "everyone's resumes and
  transcripts sit in one global bucket". Either finish the Supabase Auth
  cutover or close the legacy anon policies first.
  `tests/unit/row-contract-columns.test.ts` now holds the repo-side invariant for
  **every** table the client writes to — measured clean apart from these six —
  and was proven to bite per table (hiding 004 reddens only `practice_sessions`).

## OPEN launch blockers (external, not code)

- [ ] **Reads have no owner predicate — RLS is the only lock, and its key is in
  the client** (measured 2026-09-27, independent of the 005 column drift). Every
  read wrapper in `src/lib/api-client.ts` sends `select('*')` with nothing but
  the caller's own filter: `dashboard/page.tsx:47` → `api-client.ts:144` is
  `select('*').order('created_at')`, full stop. So a candidate's history is
  narrowed to their own rows purely by Postgres policies, while the browser holds
  the publishable key and runs as role `anon`. Under 003's legacy anon bridge
  that means any holder of the key reads every `user_id IS NULL` row — other
  people's resume text, job descriptions and transcripts.
  Not hypothetical for every table: `interviews` writes still die on 42703 so it
  has no rows to leak, but `practice_sessions`, `telemetry`, `achievements`,
  `evaluations`, `assessments` and `orama_index` have all their columns and their
  writes succeed today.
  Two-part fix in flight: migration `006_close_anon_bridge_content_tables.sql`
  (drafted, drops the 20 anon policies on the five owner-gated content tables,
  keeps telemetry/achievements bridged) and explicit `user_id` scoping in the
  read wrappers (`tests/unit/read-ownership-scope.test.ts` pins it; written
  first and observed red against the current code, which is the proof the
  predicates were missing). RLS remains the enforcement point — the client filter
  is the second lock, and with no account it declines to query at all rather than
  asking anon for an empty set.
  Ordering constraint: 006 must not be applied before the OAuth path actually
  works, or demo accounts lose read and write together.

- [ ] Env at **build** time, not only runtime: `NEXT_PUBLIC_*` is inlined during
  `next build`, so a host that sets it only on the running server produces an app
  talking to `placeholder.supabase.co` (see the Env & secrets row). Declared and
  checked by `tests/unit/env-surface.test.ts`, which fails if `src/` reads a name
  that `.env.example` neither declares nor excludes with a reason.
- [x] The keyless browser lane (`npm run test:e2e:mock`) runs in CI — it is a
  step of the `gate` job in `.github/workflows/ci.yml`, landed via PR #11 with
  `if: failure()` Playwright artifacts, and gate passed on a runner (9m26s).
  The history is the useful part: it was wired on 2026-09-26, died on the first
  runner attempt at `tests/mock-journey.spec.ts:169` with a 180s actionability
  timeout on the Privacy Center 删除 button (the locator resolved, so something
  was *covering* it), and was reverted to keep `main` green rather than
  papered over with a longer timeout.
  Root cause, read off the artifact that failure produced: `OnboardingTour` is
  mounted by `dashboard-shell`, so for a user who had never finished it its
  `fixed inset-0` `aria-modal` overlay reappeared on every `/dashboard/*` route
  including Privacy, and it reveals 1s after mount. It never reproduced locally
  because the local step-11→12 gap fits inside that timer — only a cold runner
  misses the dismissal window, and missing it once means the seen-flag is never
  written, so the dialog returns on the next dashboard page.
  Two fixes, both kept. Spec-side: re-apply the Escape guard the spec already
  had before the delete click and assert the dialog is hidden (runner-verified
  on PR #11). Product-side: mount the tour on the dashboard index only, with a
  regression test that failed against the unfixed code plus a counter-pin that a
  first-run user still sees it there. That also answers the question PR #11
  left open — should onboarding cover a page whose whole purpose is deleting
  your data? No.
- [ ] A-graduation: 7-day nightly trend + 2-rater κ≥0.6 (EVAL_REPORT
  GRADUATION GAP). Practice-only launch does NOT require it; "calibrated"
  claims do.
- [ ] F3 human a11y pass sign-off (`docs/A11Y_MANUAL_CHECKLIST.md`) —
  a 2026-09-19 in-session sign-off exists and the machine lanes re-ran
  green on 2026-09-25, but an in-session sign-off is not a human pass:
  re-opened rather than inherited. See the checklist's re-verification row.
- [ ] Live dual-user RLS denial (needs 2 free-tier users). Narrowed 2026-09-27:
  it cannot be tested through the email/password path at all, because that path
  never creates a Supabase session — `stampOwner()` therefore writes unowned rows
  and `auth.uid()`-based policies are unreachable rather than merely unverified.
  Only `LoginForm.handleOAuthLogin` → `signInWithOAuth` yields a role that the
  owner policies apply to. **Step 1 landed 2026-09-27** — decision: OAuth is the
  primary identity path, and it needed no platform work: `auth/v1/settings`
  reports `external.email/google/github = true` and `anonymous_users = false`,
  `/auth/v1/authorize?provider=google` hands off to the provider for both the
  production domain and localhost, and `detectSessionInUrl` defaults to true, so
  the OAuth return already populates a session with no new code. `stampOwner()`
  now refuses writes to `interviews` / `evaluations` / `practice_sessions` /
  `assessments` / `orama_index` with no owner, tagged `NO_OWNER`, which
  `classifyDbFailure` reports as its own outcome so the UI says "sign in with an
  account to save" instead of "database unavailable". Stated plainly, because it
  is a product consequence, not a bug: **the email/password demo login no longer
  persists anything** — the alternative was a globally readable row. Still open:
  surface OAuth as the prominent path in `LoginForm`, migration 006 dropping the
  legacy anon policies, then apply 005 + 006 to production. Not proven: the
  end-to-end OAuth round trip (needs a real provider account; would create a
  production user row).

## Sign-off

| Date | Commit | Role | Decision |
|------|--------|------|----------|
| 2026-09-19 | `8bbf3fa`+dirty-tree (uncommitted, see `git status`) | owner | practice-only LAUNCH (in-session sign-off; A-graduation + live denial stay tracked follow-ups, non-blocking per above) |
| 2026-09-25 | `e07f33b`+this tree | takeover session | **HOLD** — the 09-19 LAUNCH was asserted in-session, so it is not inherited as an owner decision. Nothing has ever been deployed (no Vercel link, no domain, `metadataBase` still gated on `NEXT_PUBLIC_SITE_URL`), so no release is being blocked; the box just has to be re-ticked by a human. |
