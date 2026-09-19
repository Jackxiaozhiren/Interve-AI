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

## Metadata & error surfaces

- [x] Root metadata: title template + description + OG + twitter
  (`src/app/layout.tsx:9-33`); `lang="zh-CN"`, skip link.
- [x] `robots.ts` live-verified (public 4 routes allow; gated/API disallow).
- [x] `error.tsx` + `not-found.tsx` + `loading.tsx` present (no global-error —
  acceptable: root layout has no async server boundary needing one).
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

- [x] Reproducible `docker build` green (node:20-alpine, standalone,
  runs: /login 200; tag `interve-ai:phase-g` verified 2026-09-17).
- [x] Deploy parity pinned in CI (`deploy consistency` step: standalone +
  node20 + no-secret-layers + default Vercel build).
- [x] Migrations additive-only with rollback notes (002/003/004).

## OPEN launch blockers (external, not code)

- [ ] A-graduation: 7-day nightly trend + 2-rater κ≥0.6 (EVAL_REPORT
  GRADUATION GAP). Practice-only launch does NOT require it; "calibrated"
  claims do.
- [ ] F3 human a11y pass sign-off (`docs/A11Y_MANUAL_CHECKLIST.md`).
- [ ] Live dual-user RLS denial (needs 2 free-tier users).

## Sign-off

| Date | Commit | Role | Decision |
|------|--------|------|----------|
| YYYY-MM-DD | `git rev-parse --short HEAD` | owner | practice-only LAUNCH / HOLD |
