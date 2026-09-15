# CONTRIBUTING

1. Read `docs/DEVELOPMENT.md` + `docs/ARCHITECTURE.md` + `docs/audit/REPOSITORY_TRUTH.md` before touching code; read the `node_modules/next/dist/docs` chapter for any Next-16 area you change (AGENTS.md rule).
2. Small, incremental PRs with migration/rollback notes for DB changes (additive only). Never: delete tests to pass, disable lint without basis, downgrade TS strictness, ship mock/fake/random as AI, mass-rewrite without a migration plan, or guess latest APIs from memory.
3. Every AI/scoring change needs evidence + uncertainty + eval impact (`npm run test:eval` keyless at minimum); every API change needs Zod I/O + auth + caps + rate-limit + requestId + PII-free logs + tests (401/400/413/429).
4. Gates: `npm run verify` must pass; touched E2E/a11y lanes re-run; `npm audit` re-checked for dep PRs. CI (`.github/workflows/ci.yml`) red blocks merge.
5. Docs: update the owning `docs/audit/*_REPORT.md` + `REPOSITORY_TRUTH.md` H-entries when behavior changes; keep `docs/ai-governance/` + `LIMITATIONS.md` honest (no capability claims beyond verified use).
