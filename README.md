# Interve AI — Evidence-Grounded Multimodal AI Interview Practice & Assessment Platform

> For job-seekers: explainable, verifiable training. **Practice only — never a hiring-screening / elimination tool.** No face→emotion/personality/hireability scoring, no protected-attribute inference, no employment decisions. Every score ships with evidence + uncertainty + a training-estimate disclaimer.

## What it is

Goal-based interview training loop: **Setup (target company/role/JD/resume/level/round/language/difficulty → Interview Plan) → GreenRoom preflight → Live interview (voice/text + Monaco coding + tldraw whiteboard, optional camera self-view) → Evidence-grounded evaluation (rubric V2 + readiness, not hire/no-hire) → Diagnose → Drill → Retry → Compare → Track (Dashboard trends / Replay turns / Privacy center).**

Screenshots: run `npm run dev` and open `/landing` (marketing), `/setup` (wizard), `/interview?id=<id>` (live room), `/dashboard` + `/dashboard/report/[id]` + `/dashboard/replay/[id]` (analysis), `/practice` (drills), `/dashboard/privacy` (data rights).

## Architecture

```
Setup → interviews (Supabase) → Interview room (useChat stream + Whisper/Kokoro workers + Monaco + tldraw snapshot)
  → interview-chat (planner→interviewer→analyzer→state→follow-up) → analyze-interview (rubric registry + EvaluationV2Schema)
  → Dashboard/Report/Replay/Drills/Progress ── Privacy Center / ai-governance / evals
```

- See `docs/audit/REPOSITORY_TRUTH.md` (HEAD + H1-H11 evidence), `docs/audit/ARCHITECTURE_CURRENT.md`, `docs/audit/MASTER_AUDIT.md`, phase reports (`STABILIZATION/TRUTHFULNESS/EVALUATION_V2/AI_ARCHITECTURE/INTERVIEW_ENGINE/PRODUCT_LOOP/AUDIO/UX/EVAL/SECURITY/PERF_REPORT.md`), `docs/research/TECH_RESEARCH.md`, `docs/ai-governance/{MODEL_CARD,EVALUATION_CARD,DATA_POLICY,RISK_REGISTER,LIMITATIONS}.md`.

## Features

- 11 interview types (Recruiter/Behavioral/Tech/Coding/SystemDesign/DataML/Product/Business/Salary/Leadership/Custom) + custom text; Easy→Expert adaptive difficulty; 10/15/20/30-min budgets.
- Resume×JD gap matrix (unknowns stay unknown, gaps-first focus), STAR/behavioral/technical/system-design rubrics (1-5 anchors + verbatim evidence + confidence + improvement drills).
- 28 drills (one/rubric-dimension) + weakest-first plan + per-question Retry→Compare + attempts deltas.
- Replay turn-level (Q/A/transcript/delivery/readiness/retry links); coding review (correctness/complexity/reasoning/tests/quality/expression); diagram review (missing parts/bottlenecks/SPOF/scale/reliability/security/observability/data-flow).
- Observable-only audio analytics (WPM/filler/interruptions/answer-sec/round-trip/STT confidence — never anxiety/personality/honesty); barge-in (user speech stops TTS); device picker + permission recovery; live captions + keyboard-first recording; Calm/LiveCaptions/Dyslexia modes.
- Privacy Center: collect/store/purpose/retention/delete/export; resumes encrypted in transit, transcripts user-controlled, raw audio/video never stored by default, frames local-only.

## Stack

`Next 16.2.4 / React 19.2.4 / TS strict / AI SDK v6 (ai@6.0.168) / Zhipu GLM (OpenAI-compat) + Gemini + optional OpenAI / Supabase Postgres / zustand + Context + Orama / next-pwa / MediaRecorder + SpeechRecognition + Whisper (transformers.js) + Kokoro-82M (kokoro-js) + energy VAD / Monaco / tldraw / recharts`. Node>=20.9.

## Quickstart (clean room)

```bash
git clone https://github.com/Jackxiaozhiren/Interve-AI.git
cd Interve-AI
npm ci
cp .env.example .env.local   # fill ZHIPU_API_KEY; generate SESSION_SECRET below
npm run verify               # lint + typecheck + 196 tests + build (keyless)
npm run dev                  # http://localhost:3000
```

Generate the session secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## Env

| Var | Required | Notes |
|---|---|---|
| `ZHIPU_API_KEY` | AI features (FREE tier) | Free registration at open.bigmodel.cn; server-only, never `NEXT_PUBLIC_*`. Free allowance covers daily practice + eval smoke |
| `OPENAI_BASE_URL` | Zhipu compat | Default `https://open.bigmodel.cn/api/paas/v4/` (OpenAI-compat wiring, intentional) |
| `OPENAI_API_KEY` | NOT needed (leave blank) | Only for explicit `?model=openai`; the free stack never calls it |
| `SESSION_SECRET` | Prod auth (FREE, local) | ≥16 chars (64-hex recommended); prod fails closed without it; dev loud fallback |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional persistence (FREE tier) | Without them the app runs on local fallback (`local-<uuid>` sessions); with a free project, apply 001+002 then `npm run verify:supabase-free` |

## AI

Central registry `src/ai/providers/registry.ts` (ONE construction site/vendor, ONE model table, ONE retry policy; `AI_MOCK=1` handler tests). Versioned prompts `src/ai/prompts/` (17 entries). Model ids: `glm-4-flash` (default), `glm-4.7-flash` (thinking, `thinking:{type:enabled}` + 65k cap server-side), `glm-4v-plus/flash` (diagrams/docs, `data:image/*` only), `gemini-2.5-flash/1.5-pro/1.5-flash`, `gpt-4o/mini` (optional). OpenRouter free third lane (opt-in only, never default): `?model=openrouter` → `nvidia/nemotron-3-ultra-550b-a55b:free` (free-form chat, text-only, no structured output), `?model=openrouter-structured` → `deepseek/deepseek-v4-flash-0731:free` (structured-output candidate). Needs server-only `OPENROUTER_API_KEY`; free models rotate + rate-limit, so Zhipu/Gemini stay primary. `generateObject` (10 routes) is deprecated-but-working in AI SDK v6 — new code uses `generateText`+`Output.object`; mass migration via `npx @ai-sdk/codemod v6 --dry` + keyed regression (tracked). Untrusted resume/JD/answers are fenced as data (`UNTRUSTED` + ignore-instruction hardening on top-5 prompts).

## Supabase / migrations

7 tables (`interviews, evaluations, practice_sessions, telemetry, achievements, orama_index, assessments`). History frozen: `0001` (UUID/JSONB) vs `001` (BIGSERIAL/TEXT[] + open `USING(true)` policies). Current: `002_session_ownership.sql` (additive: nullable `user_id` + owner indexes + `TO authenticated auth.uid()=user_id` + contained `TO anon user_id IS NULL`; rollback header inside). Never delete history — only add migrations. Free live check: `npm run verify:supabase-free` (anon-key, read-only, skips keyless with exit 0); cross-user denial stays pinned by static contract `tests/integration/rls-policies.test.ts` until two free-tier users exist to exercise it.

## Testing

| Lane | Command |
|---|---|
| All keyless ($0) | `npm run verify` (lint 0/0 + typecheck + 196 vitest + build 37 routes) |
| Unit / integration | `npm run test:unit`, `npm run test:integration` |
| AI eval keyless | `npm run test:eval` (all suites self-skip, exit 0 — harness + datasets still validated) |
| AI eval free live (≤3 flash calls) | `npm run test:eval:free` (needs free `ZHIPU_API_KEY`; golden weak-case + smallest injection vector; CI runs it only when the secret exists) |
| AI eval full (31+3 calls, nightly) | `npm run test:eval` with free key (golden MAE/adjacent/ρ/κ provisional + stability + injection + fairness; 1-concurrency free quota, never per-PR) |
| Supabase free live | `npm run verify:supabase-free` (anon read-only; skips keyless) |
| E2E smoke / full / a11y | `npm run test:e2e:smoke`, `npm run test:e2e`, `npm run test:a11y` |
| E2E journey | `Landing→Signup→Setup→resume+JD→Preflight→answer→complete→analysis→Replay→Drill→delete` (Playwright `chrome-1280x720` + 12-project matrix in CI) |

CI (`.github/workflows/ci.yml`, all free): install → lint → typecheck → unit+integration → build → eval keyless → supabase-free (skips without secrets) → Playwright chromium smoke → `npm audit --audit-level=critical`, plus a secret-gated `free-eval-smoke` job (≤3 calls, skips on forks). PR red blocks merge.

## Security & privacy / Responsible AI

- Every AI route: session-required (401) + Zod I/O (400) + byte caps 128KB-8MB (413) + per-IP limits + `Retry-After`/`RateLimit-*` (429) + client+server abort + explicit retries + `x-request-id` + PII-free JSON logs. Uploads: 5MB/60k-char caps, SVG refusal, MIME+size double-check. `proxy.ts` (named `export function proxy`, nodejs-only) guards app pages + headers (CSP tightening tracked).
- XSS: LLM markdown via safe rendering path (strict allowlist tracked); secrets: 0 hits scan; deps: `npm audit` 39 (1L/30M/8H/0C) triaged non-reachable + upgrade lane.
- Responsible AI: readiness (`Needs Foundation/Developing/Interview Ready/Strongly Prepared`) + training-estimate disclaimer, never hire verdicts; role-relevant competency alignment only (JD-explicit items); banned list enforced by tests (`tests/integration/prohibitions.test.ts` + `truthfulness.test.ts`): no face/voice→emotion/personality/honesty/intelligence/hireability/culture-fit, no accent→competence, no protected attributes.
- Evals (`evals/` + `src/ai/evals/metrics.ts`): 12 synthetic goldens (6 tracks × strong/weak) + injection (4 vectors) + fairness (surface-token swaps, no protected profiling); bars provisional until free-key nightlies + multi-rater labels.

## Deploy

Vercel (`vercel.json`: `npm install`) or Docker (`Dockerfile`: `node:20-alpine`, `npm ci`, `output:standalone`). Set `ZHIPU_API_KEY` + `SESSION_SECRET` + (optional) Supabase vars in the host env. Release gate: engineering all-green, zero fake AI, every score has evidence+uncertainty, injection/fairness/stability pass, RLS/auth/rate-limit pass, Lighthouse达标或有解释 (`/` 92/100/100/100; decor-LCP misses documented in `PERF_REPORT.md`), docs let a newcomer run clean-room.

## Roadmap / Limitations

Next: Supabase Auth cutover + live RLS/IDOR; keyed nightly evals + human calibration; `generateObject`→`generateText+Output` migration; single-shared-mic-stream refactor; Judge0/Pyodide multi-lang execution; continuous whiteboard vision; strict CSP allowlist; Upstash multi-instance limits; full bilingual prompts (no fake language selector until backend honors it). Heavy local models (Whisper/Kokoro) need cached/offline strategy. See `MASTER_AUDIT.md` P1-P3 + each phase report's "Deferred" section — nothing hidden.
