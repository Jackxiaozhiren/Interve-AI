# ARCHITECTURE

> Source of truth: `docs/audit/REPOSITORY_TRUTH.md` + `docs/audit/ARCHITECTURE_CURRENT.md`. This file is the short map.

- App Router (`src/app/`): `/`, `/landing`, `/login`, `/signup`, `/setup` (wizard + plan preview), `/interview` (live room: `useChat` stream + workers + Monaco + tldraw + self-view), `/practice` (Server/Client split — the clean boundary), `/dashboard` (+`report/[id]`, `replay/[id]`, `privacy`, `settings`, `resume`, `knowledge`, `interview`), `/chat`, `/recruiter` (mock), 17 API routes (`src/app/api/*/route.ts` + `session`).
- AI (`src/ai/`): `providers/registry.ts` (single construction site, model table, retry budgets, mock tier), `prompts/` (17 versioned builders), `rubrics/` (5 anchored rubrics), `evaluation-contract.ts` (evidence-first V2 schema), `interview/{state,plan,types}.ts` (loop state + coverage planner), `drills/bank.ts` (28 drills), `evals/metrics.ts` (Kappa/Spearman/MAE/agreement/variance).
- Gate (`src/lib/api/`): `guard.ts` (requestId→rate-limit→session→size+Zod), `session.ts` (HMAC cookie), `rate-limit.ts`, `validate.ts`, `errors.ts`, `logging.ts` (PII-free), `request-id.ts`. `src/proxy.ts` (named `proxy`, nodejs-only) guards pages + security headers.
- Data: Supabase 7 tables + `002` ownership migration; local fallback (`lib/api-client.ts`, `lib/db.ts`); state (`useInterveStore`, `useInterviewLoopStore`, `useAccessibilityStore`, `AuthContext`); search (Orama); PWA shell (`next-pwa`, no runtimeCaching — tracked).
- Media: `src/lib/audio/` (delivery/STT/VAD) + `src/hooks/` + `src/workers/` (Whisper-base, Kokoro-82M); vision = diagrams/docs only, camera = self-view.
