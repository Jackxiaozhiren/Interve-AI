# Interve AI — MASTER_AUDIT (Phase 1 Gate)

> HEAD `f37f574` / `main` / 2026-09-03. Read-only. No src/ changes.
> Companions: `ARCHITECTURE_CURRENT.md`, `../research/TECH_RESEARCH.md`.
> Baseline (fresh `npm ci`): lint 0 errors / 13 warnings; `tsc --noEmit` PASS; `next build` PASS (36 routes); `npm audit` 62 vulns (3L/39M/19H/1C). E2E not executed (needs browsers + keys).

## Executive Summary

Interve AI is a feature-rich interview-practice demo with a working Setup→Interview→Report main path, real LLM dialogue, real local STT/TTS workers, and real whiteboard/code context plumbing. It is **not** production-ready: human vision metrics are `Math.random()` persisted as scores; 16/16 AI routes lack auth/rate-limit; RLS is `USING(true)` with no `user_id`; auth is forgeable cookie JSON; hiring verdicts + culture-fit scores lack rubric/evidence/calibration and collide with EU AI Act Art.5(1)(f) + NYC LL144; migrations drift UUID↔BIGSERIAL; `proxy.ts` guard is likely inert (default export); tests are Playwright-smoke only with no CI/verify/evals. UX has 7 dead-end pages/buttons, fake Replay playback, and live-score distraction during interviews.

Phase 2 must be P0-first, incremental, measurement-led: kill fake scores, close RLS/IDOR, auth+limit APIs, remove employment decisions, reconcile migrations, fix proxy, add `verify`+CI skeleton — before any new features.

## Repository Truth (condensed)

Next 16.2.4 / React 19.2.4 / TS5 strict / AI SDK 6.0.168 / Zhipu GLM (`glm-4-flash/4.7-flash/4v`) + Gemini (`2.5-flash/1.5-pro`) + OpenAI optional / Supabase (7 tables, no `user_id`/FK) / mock cookie auth / zustand+Context+Orama / next-pwa / MediaRecorder+SpeechRecognition+Whisper+Kokoro+energy VAD / camera preview-only / Monaco JS-only / tldraw snapshot / recharts. 182 files in `src/`. `README` = create-next-app default. No `.github/`. No unit tests. `Dockerfile node:20` vs local node 24.

## P0 Issues (ship-blocking)

### P0-1 Fake vision persisted as score — Truthfulness + EU ban
- Evidence: `src/components/interview/VisionTelemetry.tsx:44-59` (`Math.random()` eye/posture/expression), `:111,118` `%` UI; `TelemetryWidget.tsx:40` focus random; `SystemHealthIndicator.tsx:21` latency random; `src/app/interview/page.tsx:735-743` `bodyLanguageScore=(eye+post+expr)/3 → db.interviews.update({radarScores})`; `db.ts:30-38` schema; thresholds `CopilotHints:26,30 <60` never fire (fake range 60-100).
- Root Cause: camera preview wired to random walk + `onVisionDataUpdate`, no CV model (`package.json` has no face/pose libs).
- Impact: deceived users; fabricated hiring-adjacent signal; EU Art.5(1)(f) prohibited-pattern exposure.
- Recommended Fix: hide `%`, show `Unavailable`, stop persisting `bodyLanguage`, remove from radar/roadmap/achievements; later local-only self-view or diagram-vision only.
- Dependency: none. Effort: S (1-2 days). Verification: `grep Math.random src/components/interview` clean for metrics; E2E asserts no vision `%`; DB `bodyLanguage` null.

### P0-2 Open RLS + no ownership — Broken Access Control
- Evidence: `supabase/migrations/001_init_schema.sql:202-221` 7× `FOR ALL USING(true) WITH CHECK(true)` (no `TO service_role`, no `auth.uid()`); `0001` no RLS; zero `user_id` cols; `lib/supabase.ts:3-7` anon singleton; `api-client.ts:44+` anon CRUD.
- Root Cause: placeholder policies never replaced; ownership never modeled.
- Impact: anon full read/write; BIGSERIAL enumerable IDOR.
- Fix: `002` migration adds `user_id uuid REFERENCES auth.users` + backfill plan + per-op `to authenticated using ((select auth.uid())=user_id)`; least-privilege anon; RLS tests.
- Dep: P0-5 ordering (reconcile types first). Effort: M. Verify: anon `select` denied; A cannot read B; IDOR API tests.

### P0-3 16/16 AI routes unauthenticated, no rate limit
- Evidence: `grep getServerSession|getUser|cookies\(\) src/app/api` = none; `proxy.ts:21` only `/dashboard|/api/dashboard` (latter nonexistent); `copilot:16,23` client `model`; `interview-chat:26- thinking+65536`; `parse-resume` no size cap.
- Cause: no session check, no Upstash/memory bucket, no Zod inputs.
- Impact: quota burn, free OCR proxy, DoS.
- Fix: session-required, per-user/day + concurrency caps on high-cost routes, Zod inputs, `AbortSignal.timeout`/`timeout.totalMs`, server model allowlist, file caps.
- Effort: M. Verify: 401 anon; 429 flood; capped sizes.

### P0-4 Employment decisions + Culture Fit — legal/AI governance
- Evidence: `analyze-interview:51,72,83-89,101,111,115-123` (`cultureFitAdvisor`, `hireVerdict enum`, `culturalTraits 0-100`); 58 UI matches (`report/replay/dashboard/export/achievements`); `analyze-trends:45` consumes verdicts.
- Cause: council roleplay prompt with definitive-decision instruction.
- Impact: NYC LL144 AEDT + EU high-risk exposure; unfairness without audit.
- Fix: practice mode → `Interview Readiness (Needs Foundation/Developing/Ready/Strongly Prepared)` + training-estimate disclaimer; delete culture-fit path; gate employer features behind governance docs.
- Effort: M. Verify: `grep hireVerdict|cultureFit` in practice = 0; UI shows readiness + limitations.

### P0-5 Migration drift UUID↔BIGSERIAL (+ JSONB↔TEXT[])
- Evidence: `0001:8,32… UUID`, `cheatsheet JSONB`, no defaults/RLS/indexes vs `001:21,58… BIGSERIAL`, `TEXT[]`, defaults+CHECKs+11 indexes; frontend `Number(id)/parseInt` (`report/[id]:95`, `replay/[id]:35`, `interview:468`) breaks on UUID.
- Cause: two initial schemas, `IF NOT EXISTS` never alters types.
- Fix: freeze `0001/001`, author `002_reconcile` (canonical types, `user_id`, FKs, indexes, RLS) with rollback + seed. Never delete history.
- Effort: M. Verify: fresh `db reset` + CRUD + ID consistency.

### P0-6 `proxy.ts` guard likely inert + weak CSP
- Evidence: `proxy.ts:17 export default` vs Next 16 named `export function proxy` (TECH_RESEARCH #1); only `/dashboard` guarded; `JSON.parse(cookie).id` forgeable; CSP `connect-src *` + `unsafe-eval/inline`; `X-XSS-Protection` obsolete.
- Cause: incomplete middleware→proxy migration.
- Fix: named export, cover `/interview/setup/recruiter/api/*`, verify session server-side, tighten CSP (nonce, no `*`), add COOP/COEP later.
- Effort: S. Verify: forged cookie rejected; unauth redirects; header asserts.

### P0-7 Prompt injection → score manipulation + stored XSS chain
- Evidence: 16 routes concatenate resume/JD/transcript/code/image into prompts with only `"""`/```` ``` ```` wrapping (e.g. `interview-chat:64-122`, `analyze-star:42`, `copilot:37-46`); no sanitize; `message-card.tsx:143-147 dangerouslySetInnerHTML` without DOMPurify; `localStorage/cookie` non-HttpOnly.
- Cause: no untrusted-content segregation (OWASP LLM01), no output encoding (LLM05).
- Fix: delimiters + role isolation + ignore-instruction hardening, Zod input caps, `DOMPurify`/safe-markdown, HttpOnly session, injection evals.
- Effort: M. Verify: `Ignore previous instructions` fixtures don't alter verdict; XSS payloads neutralized.

## P1 Issues (high — Phase 2/3)

- P1-1 Hallucinated 0-100 without rubric/evidence/confidence/calibration. Evidence: 7 scoring routes; `analyze-chunk:39` "best guess 70/50"; `analyze-star:39-40` `Action>=40` floor + `timeSpent` from length; `analyze-match:57` scores without resume. Fix: rubric registry + anchors + `dimension/score/evidence/rationale/uncertainty/improvement` + golden set + Kappa/Spearman/MAE + variance. Effort: L. Verify: golden eval + repeat-variance + adjacent-agreement.
- P1-2 Mock auth (password discarded `LoginForm:42-57`, `signup:19-38`, `oauth_user@example.com`, dual `interveai_user`/`interve_auth_user`, no expiry). Fix: Supabase Auth + HttpOnly session + server guard. Effort: M. Verify: wrong password fails; cookie unforgable; logout invalidates.
- P1-3 IDOR enumeration (`BIGSERIAL` + `Number(id)` reads + full-table `dashboard:45` + guessable `C-101`). Covered by P0-2/P0-3 but tracked separately for API tests. Effort: M (with P0-2).
- P1-4 Upload abuse (MIME-only `setup:311-312` + `parse-resume:14-19`, no size/magic/pages, `Buffer` OOM, OCR exfil without consent, dual pdfjs/pdf-parse). Fix: server size/type/page caps, SVG policy, redaction+consent, single pipeline. Effort: S-M. Verify: oversized/SVG rejected; OCR consent logged.
- P1-5 No CI/verify/evals (no `.github/`, no `test/typecheck/verify` scripts, `lint.txt` stale, Playwright 12-project matrix unsharded). Fix: `lint/typecheck/test:unit/test:e2e/test:a11y/build/verify` + Actions (install→lint→type→unit→build→e2e→security→AI-eval-smoke), PR gate. Effort: M. Verify: red PR blocked.
- P1-6 Interview reliability (1678-line God Component, transport stale snapshot `page.tsx:220-240`, 15s `modelsReady` block, Safari webm, triple-mic, energy VAD false triggers, Worker listener leaks `:614-615`, mic tracks never stopped `:791-898`, VAD missing `isMonitoring` guard). Fix: split components, live body values, lazy models, device fallback, stop tracks, remove listeners. Effort: L. Verify: latency breakdown (STT/TTFT/TTS), no red-dot leak, device-matrix pass.
- P1-7 Privacy minimization (JD 500 chars in `?context=` URL `setup:396-407`, full transcript in `localStorage interve_session_*`, whiteboard in localStorage forever, no delete/export/retention, `dicebear?seed=email`, possible PII in `console.error`). Fix: POST/session for JD, sessionStorage+expiry, consent-gated vision, delete/export APIs, 90-day purge, redaction. Effort: M. Verify: no PII in URL/storage beyond session; delete/export round-trip.
- P1-8 UX blockers: signup no redirect (`signup:19-30`); recording mouse/touch-only (`interview:1291-1294`); GreenRoom `volume===0` deadlock vs `Start without Mic` (`GreenRoom:146`, `setup:1273`); setup auto-pollutes JD (`setup:284-287,300-309`) + silent 500-truncate; knowledge links to `/` not `/setup`; recruiter/chat dead CTAs; landing self-loop (`/landing:29-31,165-169`). Fix per-issue. Effort: M total. Verify: keyboard-only run + link crawl.
- P1-9 Live-score anxiety (`LiveStats:77-170` WPM/filler/vision/load/STAR/behavior always-on; `cognitiveLoad +8/5s silence`, WPM CN bias; `sentiment/accuracy` props dropped silently `LiveStats:37` vs `page:1412-1413`; `isFocusMode` default-on but partial). Fix: hide scores during interview, post-only. Effort: S. Verify: interview shows timer/question/mic only.

## P2 Issues (medium — Phase 3/4)

- P2-1 State overlap (`useInterveStore` vs `useAppStore` resume/JD/cheatsheet), Orama warn-only + no lock, Dexie orphan dep, `reset()` leaks traits. Fix: single store + persist snapshot + surface Orama errors + drop/restore Dexie. Effort: M.
- P2-2 Dead/duplicate code (empty `lib/auth/auth.ts`, dead Supabase OAuth, dead `auth-context`, suspect `question-bank`/`pdf-parser` browser path, dual `TextSelectionMenu`, VAD/Ambient 80% dup, Zod shape dup STAR/store). Fix: call-graph confirm then delete; extract `lib/prompts`, `lib/zhipu`. Effort: M.
- P2-3 Hooks/effects debt (18 `set-state-in-effect` suppressions, 5 `exhaustive-deps`, `useLiveQuery deps:any[]`, `AnimatedNumber` DOM-read init). Fix: derived state/`useSyncExternalStore`/event-driven. Effort: M.
- P2-4 SSR boundary (`dashboard/layout`, `loading`, `ui/*` over-clientized; hooks-file directives). Fix: Server-first layering. Effort: S-M.
- P2-5 `analyze-vision new URL()` crash, `tldraw persistenceKey` cross-session, whiteboard continuous-eval missing, Monaco JS-only, no Judge0/Pyodide. Fix: data-URL validation + namespaced keys + staged language support. Effort: M.
- P2-6 Caching (only `analyze-code` cached), dashboard `select('*')`, Orama full rebuild, no ISR. Fix: targeted caches + pagination + incremental index. Effort: S-M.
- P2-7 i18n (`interview-chat/init-context/analyze-match` hardcoded Chinese; `temp 1.0`; `generateText+JSON.parse` in trends/copilot; `questionCount` unclamped; vision size unclamped). Fix: locale-driven prompts, `generateObject` everywhere, clamp inputs. Effort: S-M.
- P2-8 Recruiter/practice/chat gaps (mock KPIs/candidates, static 17 questions, sidebar histories/attach dead, `parts` dropped `chat:188`). Fix: wire or remove per page decision log. Effort: M.

## P3 Issues (later — polish/scale)

PWA runtimeCaching/offline, visual regression, Lighthouse 90/95 targets, observability (request/AI-call/session IDs, PII-free), docs rewrite (`README/ARCHITECTURE/DEVELOPMENT/TESTING/SECURITY/PRIVACY/AI_EVALUATION/CONTRIBUTING`), clean-room test. Effort: M-L after P0-P2 gates.

## Dependencies & Effort rollup

Order: P0-5 (types) → P0-2 (ownership/RLS) → P0-3/P0-6 (API/proxy auth) → P0-1/P0-4 (fake/hire removal) → P0-7 (injection/XSS) → P1 eval/auth/upload/CI/reliability/privacy/UX → P2 → P3. Total P0 ≈ 3-4 wks (1 eng); P1 ≈ 4-6 wks; P2 ≈ 3-4 wks. No mass rewrite; each fix needs migration/rollback note.

## Verification Methods (Phase gates)

- `npm run verify` (to be added): lint 0e/0w, `tsc`, unit, integration, build, e2e smoke, a11y, security (audit+headers), AI-eval smoke.
- RLS/IDOR: anon-denied + cross-user-denied + enumeration-oracle-closed tests.
- AI: golden synthetic sets + human labels (Kappa/Spearman/MAE) + repeat-variance + injection fixtures + fairness drift (no protected profiling).
- Privacy: URL/storage/PII scan + delete/export round-trip + retention job dry-run.
- UX/a11y: keyboard-only run, SR pass, 24px targets, focus-visible, captions `aria-live`.

## Remaining / Risks

- Supabase project env not present locally — RLS/migration verification needs staging project + service key handling.
- Zhipu/Gemini keys absent — AI eval smoke needs funded keys with caps.
- Whisper/Kokoro hundreds of MB — e2e/perf must allow model-warm vs cold budgets.
- `node:20` Docker vs node 24 local — pin engines before CI.
- Largest risk: fixing auth/RLS will break current demo flows until migration + seed + guard land together — coordinate as one release train, not piecemeal.

---

# Phase 1 Gate 2026-09-14 (HEAD `bc69d30` + working tree, V2 basis)

> Method: fresh `npm ci`-state `lint/typecheck/test/build` + 4 parallel read-only subagents + live web research (`docs/research/TECH_RESEARCH.md` §C). No src/ modified. Companions: `REPOSITORY_TRUTH.md` §12, `ARCHITECTURE_CURRENT.md` §4.

## Executive Summary (updated)

Interve AI is now a **guarded, versioned-prompt, evidence-grounded-V2 practice platform** — not the 2026-09-03 open demo. `guardRequest` (session+Zod+limits) fronts all 18 APIs; providers are single-sited with fallback; `analyze-interview` emits rubric-anchored `EvaluationV2` with mandatory verbatim evidence; fake vision is deleted (camera = local self-view); proxy is a named export with route coverage; CI + 201-test gate exist. It is **not yet shippable**: lint is RED (859e/13301w on the dirty tree); RLS is contained-not-closed (NULL-legacy anon bridge + global orama key + no server purge); 6 scoring lanes still emit unanchored 0-100; 9 prompt builders lack UNTRUSTED fences; `match`/`alignment` double-spend; i18n <20%; CI is smoke-only. Phase 2 must be lint→RLS→fences→de-dup before any new features.

## Repository Truth (condensed, 2026-09-14)

Next 16.2.4 / React 19.2.4 / `ai@6.0.168` / Zhipu (glm-4-flash/4.7-flash/4v) + Gemini (2.5-flash/1.5-pro) + OpenAI optional / Supabase 7 tables (0001 UUID+JSONB vs 001 BIGSERIAL+TEXT[] vs 002 owner-bridge) / HMAC HttpOnly session + proxy / zustand×3 + AuthContext + Orama / next-pwa / MediaRecorder+Whisper+Kokoro+VAD / camera local-only / Monaco + tldraw snapshot / recharts. 19 pages (1 Server) + 18 APIs. Baseline: lint 859e/13301w FAIL · typecheck PASS · test 201/201 PASS · build PASS (43 routes).

## P0 (ship-blocking, with evidence)

- **P0-1 RLS/IDOR contained-not-closed.** Evidence: `001:203-221` 7× `FOR ALL USING(true)` no-`TO`; `002:61-131` owner (`authenticated auth.uid()=user_id`) + NULL-legacy anon bridge; `src/` zero `auth.uid()`, API routes zero `.from(`, anon singleton + `.eq(id)` no-`user_id`, BIGSERIAL enumerable, `orama_index resume-index` global, Privacy Center direct-anon delete. Fix: per-op最小策略 + `user_id REFERENCES auth.users NOT NULL` + server write-binding + orama partition + live dual-user denial (staging-blocked, static contract pins 002). Effort M.
- **P0-2 Schema drift unfrozen.** Evidence: §12 UUID↔BIGSERIAL + JSONB↔TEXT[] + `IF NOT EXISTS` order-dependence; `db.ts id?:number` vs UUID. Fix: freeze both, new reconcile migration + backfill + rollback, never delete history. Effort M.
- **P0-3 Unanchored 0-100 still generated (6 lanes).** Evidence: `behavior/practice/chunk/star/match/alignment` prompts + schemas (chunk `z.number()` unbounded, star `Action≥40` floor + hallucinated `timeSpentSeconds`, trends reads `hireVerdict/cultureFitAdvisor`). Fix: migrate to V2 envelope (`dimension/1-5/evidence≥1/rationale/uncertainty/improvement`) or label non-evaluative; merge match↔alignment. Effort L.
- **P0-4 Culture/Hire display residue (22 hits).** Evidence: report/PrintLayout/SessionDetailModal/PrintableDossier/export/eval-compat/trends/setup/interview-HR (AI subagent table). Generation is gone (good); display of history is fidelity + needs legacy captions + removal roadmap. Effort S-M.
- **P0-5 Prompt-injection unfenced (9 builders).** Evidence: `behavior/star/practice/code/jd/context/hint/vision/trends/chunk` bare interpolation, no `UNTRUSTED` fences, no separator-escape, `trends/copilot` hand-parse coercion, interview-chat max surface (client `model/starProgress/behavioralTraits`). Fix: fence all + `STRICT_JSON_SUFFIX` (Zhipu ignores `json_schema`) + migrate to `generateObject` + injection fixtures. Effort M.
- **P0-6 Lint RED.** Evidence: 859e/13301w (`@ts-ignore`, unused vars, `<a>`→`<Link>`, dsa-web hooks/effects). Fix: zero without suppressions; add `engines` pin + dsa-web scope decision. Effort M.

## P1 (high)

P1-1 No server purge + local PII residency + email-to-dicebear + console-PII + single-instance rate-limit + vision-8MB cost face + dev-secret fallback + third-party retention + no column encryption (DB subagent P1-1..P1-9). P1-2 Interview God Component staleness partially fixed (`sendMessage body:fresh`) — needs split + device CI. P1-3 UX gaps: no deep routes (Resume/JD/GreenRoom/Coding/Design/Completion), Settings mock, Camera no switch/picker, GreenRoom `volume===0` deadlock, WPM/Filler live-eval no opt-out. P1-4 i18n <20% + `en`-default vs ZH-hardcode split + prompt Chinese hardcode 4 sites. P1-5 CI smoke-only (mock-journey/keyboard/a11y-visual/privacy/e2e + FF/Safari/Edge matrix excluded) + `zz-*` debug residue + snapshots 2 pages only.

## P2 / P3

P2: state overlap (`useInterveStore` vs loop/a11y — `useAppStore` gone, good), dead code (`lib/auth-context` mock, `mockTextStream` copy-paste, `analyze-chunk` zero-consumer), hooks/effects 18 suppressions, over-clientized RSC, vision crash fixed (data-URL-only) but per-stroke eval deferred, caching 1-route only, workers COOP/COEP gap, PWA no runtimeCaching. P3: visual regression, Lighthouse 90/95 ( `/` 92 pass, `/landing` 86 /login 89 /signup 88 decor-LCP), OTel/Sentry, docs rewrite (this release starts it), clean-room (works keyless, undocumented).

## Verification (Phase gates)

`npm run verify` (lint 0e/0w + typecheck + test + build) · RLS anon-denied + cross-user-denied + NULL-bridge-expiry · AI golden (Kappa/Spearman/MAE) + 3-repeat variance + injection drift≤20 + fairness drift≤20 · privacy URL/storage/PII + delete/export round-trip + purge dry-run · UX keyboard-only + SR + axe 0 serious/critical on all core pages · `PHASE X VERIFICATION` block per phase.
