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
- [ ] Sitemap: OPEN (non-blocking) — needs a prod domain; refused to invent
  (condition: set `NEXT_PUBLIC_SITE_URL`, add `src/app/sitemap.ts`).

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

## OPEN launch blockers (external, not code)

- [ ] A-graduation: 7-day nightly trend + 2-rater κ≥0.6 (EVAL_REPORT
  GRADUATION GAP). Practice-only launch does NOT require it; "calibrated"
  claims do.
- [ ] F3 human a11y pass sign-off (`docs/A11Y_MANUAL_CHECKLIST.md`) —
  a 2026-09-19 in-session sign-off exists and the machine lanes re-ran
  green on 2026-09-25, but an in-session sign-off is not a human pass:
  re-opened rather than inherited. See the checklist's re-verification row.
- [ ] Live dual-user RLS denial (needs 2 free-tier users).

## Sign-off

| Date | Commit | Role | Decision |
|------|--------|------|----------|
| 2026-09-19 | `8bbf3fa`+dirty-tree (uncommitted, see `git status`) | owner | practice-only LAUNCH (in-session sign-off; A-graduation + live denial stay tracked follow-ups, non-blocking per above) |
| 2026-09-25 | `e07f33b`+this tree | takeover session | **HOLD** — the 09-19 LAUNCH was asserted in-session, so it is not inherited as an owner decision. Nothing has ever been deployed (no Vercel link, no domain, `metadataBase` still gated on `NEXT_PUBLIC_SITE_URL`), so no release is being blocked; the box just has to be re-ticked by a human. |
