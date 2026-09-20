# SECURITY_REPORT (Phase 12 Gate)

> Executable checklist results + documented exceptions (release gate
> permits Highs with written exceptions — each below states reachability).

## 1. Dependency audit

- Baseline (Phase 0): 62 vulns. After `npm audit fix`: **39 (1 low, 30
  moderate, 8 high, 0 critical)**. Critical (tar stack-overflow) eliminated.
- **Removed attack surface**: dead `lib/pdf-parser.ts` (zero callers) +
  `pdfjs-dist` (HIGH: JS execution on malicious PDFs) + shipped worker
  file + postinstall copy. Server parsing stays on `pdf-parse` behind
  5MB caps + OCR fallback.
- Remaining 8 highs — triaged, none reachable in production paths:
  - `next→sharp→libvips`, `sharp` direct, `onnxruntime-node→adm-zip`,
    `@huggingface/transformers→sharp`: image/ML-native chains. Our app
    aliases `sharp`/`onnxruntime-node` out of the browser bundle, never
    imports them server-side, and feeds no user images to `next/image`
    (single static logo). **Exception: upgrade with Next 16.3.4 lane**
    (non-major, contains sharp fix + serialize-javascript fix).
  - `pdfjs-dist`: REMOVED (see above).
  - `postcss` (sourceMappingURL traversal): build-time only; attacker
    cannot supply our CSS. **Exception: rides Tailwind/Next upgrades.**
  - `ws`/`uuid`/`nanoid`/`ip-address`/`fast-uri`/`browserslist`/
    `brace-expansion`/`js-yaml`/`protobufjs`: nested copies in
    dev/CLI/build tooling (mermaid, eslint, shadcn, workbox) or already
    fixed at top level (ws 8.21.3, uuid 14). Re-verify per release
    (`npm audit` is a documented release-gate step).
- Phase B re-audit (2026-09-17): advisories published since Phase 12 added a
  **critical in `next@16.2.4`** (RCE/SSRF/proxy-bypass class, incl.
  middleware-bypass follow-ups) → upgraded `next` + `eslint-config-next` to
  **16.3.5** (pre-authorized upgrade lane above), then non-breaking
  `npm audit fix` (cleared `@ai-sdk/provider-utils` + `postcss` as side
  effects). Now: **37 total (1 low, 31 moderate, 5 high, 0 critical)**,
  `npm audit --audit-level=critical` exit 0. Remaining highs: `sharp` chain
  + `serialize-javascript` (build-time workbox/pwa, same basis as above) +
  `tiptap/core` via `tldraw` (whiteboard canvas only — we feed no attacker
  markdown into tiptap's attribute parser; rides the tldraw upgrade).

## 2. Secret scan

- Pattern scan (tracked tree): OpenAI/GH/AWS keys, private keys, JWTs —
  **0 hits**. `service_role`/hardcoded credentials — **0 hits**. No `.env*`
  files in repo (gitignored, verified). `.env.example` holds placeholders
  only. Server keys stay server-side (verified by import graph: no
  `process.env.ZHIPU/OPENAI` reads in client components).

## 3. SAST posture (honest)

- No dedicated SAST scanner runs in this environment (no CodeQL/Semgrep
  lane — tracked for CI). Equivalent enforced coverage TODAY: `tsc`
  strict (0 errors), ESLint incl. React-hooks rules (0/0), 16 POST-only
  route surface (static test), Zod I/O on every AI route, no
  `dangerouslySetInnerHTML` without review (message-card — tracked XSS
  hardening is Phase 13+ hardening? No: XSS sanitization tracked — see §6).

## 4. API abuse / upload / authorization tests (new)

- Gateway suite (`proxy-guard.test.ts`, 9 tests): anon redirect, forged
  legacy-cookie rejection, tamper rejection, header presence,
  interview preflight, `/api/*` 401 JSON, public passthrough, all
  AI-page guards, POST-only surface incl. session GET/DELETE allowlist.
- Upload extras: content-length lie (413 via either check), non-document
  MIME (400), SVG refusal (pre-existing, kept).
- Abuse extras: 429 asserts `Retry-After` + `x-request-id`.

## 5. Prompt-injection hardening (LLM01)

- `UNTRUSTED` fences + treat-as-data instructions added to the 5
  highest-exposure prompts (interview background, evaluation transcript,
  copilot snippets, match JD/resume, alignment resume/JD); prompt versions
  bumped (interview 1.2.0, copilot/match/alignment 1.1.0). Empty background
  emits no fences (no token waste). Effect measurement belongs to the
  keyed injection suite (Phase 11) — fences are reversible formatting.
- RLS live tests: BLOCKED (no docker daemon, no staging project) —
  static contract stands; live lane tracked since Phase 2 (unchanged).

## 5.1 Phase B close-out (2026-09-17, keyless, $0)

- B1 injection depth (LLM01): `STRICT_JSON_SUFFIX` extended to the last 4
  `generateObject` lanes (`evaluation/user`, `code`, `jd`, `alignment`;
  versions bumped 1.0.2/1.0.2/1.2.1) — format-only, no rubric/score prose
  touched. All 10/10 lanes pinned (`ai-registry.test.ts` B1 case, per-lane
  system+user). Fences already 14/14 (`resume` OCR static string + `coverage`
  system-state need no fence — no untrusted interpolation; basis recorded).
  `trends`/`copilot` manual `JSON.parse` already hardened (fence-strip +
  Zod + coerce + fallback; `copilot/route.ts:46-65`, `trends/route.ts:77-92`).
- B2 output handling (LLM05): `InterveAIResponse` (zero call sites; the live
  `InterveMessageCard` renders ReactNode = auto-escaped) now escapes at the
  sink (`escapeHtml`, `message-text.ts`, zero-dep) — inert text even if wired
  to model output later. `chat-background` `<style>` is a static literal
  (reviewed, no input). Pinned (`message-text.test.ts` payload cases).
- B3 least-privilege (LLM06) + prompt leakage (LLM07):盘点 done — models get
  ZERO tools in all 17 routes (no `tools/toolChoice/maxSteps`), no server-only
  keys in any `"use client"` file, no connection strings/secrets/`NEXT_PUBLIC_*`
  in prompts. Pinned statically (`security-surface.test.ts`; no import-graph
  test existed — this file is it).
- B4 access control: `orama_index` Supabase wrapper has zero callers (live path
  is per-browser Dexie) — pinned unwired until writes stamp `user_id`
  (`security-surface.test.ts` B4 case). Roadmap: keep the 002 anon NULL-bridge
  until the Supabase Auth cutover binds `user_id` on write; cutover migration
  (additive, e.g. 005) drops the `Legacy anon *` policies; live dual-user
  denial test runs once two free-tier users exist (still blocked).
- B4 CORRECTION (Phase E, 2026-09-17 — the above "zero callers" was WRONG):
  the B4 static test missed `db.oramaIndex` behind the `./db`→`dbClient`
  alias; `orama-client.ts` DOES persist resume chunks to the Supabase table
  under ONE global id (`resume-index`), anon-readable via the NULL bridge —
  a real cross-user PII leak. Fixed in E: per-user namespaced ids
  (`resume-index:<uid>`) + `user_id` stamp on UUID writes (anon-key writes
  then fail closed per 003, degrading to memory-only via existing
  try/catch) + legacy-id read fallback for transition. Pinned behaviorally
  (`orama-partition.test.ts`, 4 tests) + alias-tracking static guard
  (`security-surface.test.ts`). Legacy global rows remain readable until
  the RLS cutover drops anon legacy policies — recorded, not hidden.
- B5 web baseline: strict policy ships REPORT-ONLY (`proxy.ts`, no
  `unsafe-inline`/`unsafe-eval`, `connect` allowlisted) reporting to new
  `POST /api/csp-report` (always 204, 4KB cap, 20/min/IP, logs directive +
  blocked host only). Enforcing header untouched. CVE-2025-29927 regression
  pinned (`proxy-guard.test.ts`: forged `x-middleware-subrequest` still gated
  on pages + APIs, legit sessions unaffected). Upload chain unchanged, green.
- B6 quota fuse (Unbounded Consumption): per-user daily budget in the guard
  choke point (`user-budget.ts`, PT-day window like C1, default 200/day via
  `USER_AI_BUDGET_RPD`, opt-out per route). Only validated authed calls count;
  over-budget is 429 `RATE_LIMITED` + `Retry-After` till PT midnight, logged
  `reason=user_budget_exceeded` (no user id in logs). Pinned
  (`user-budget.test.ts`, 7 tests incl. guard-level 429 + default-on).

## 6. Open items (not hidden)

- Enforcing-CSP tightening after the report-only stream is clean; Upstash/shared
  store for rate-limit + user-budget (multi-instance); service-role-free RLS
  cutover + live dual-user denial (needs 2 free-tier users); live RLS/IDOR
  tests; CodeQL/Semgrep lane; framework upgrade lane (Next 16.3.4).

## 7. Verification

- `npm run verify` exit 0 (lint 0/0, tsc, vitest **186/186** — 24 new,
  build 36 routes). Chrome e2e re-run at gate (proxy matcher touched).
- 2026-09-17 Phase B re-verify (zero quota): lint PASS, tsc PASS, vitest
  **282/282** (34 files: +B1 suffix case, +escapeHtml 2, +security-surface 4,
  +proxy-guard 3, +user-budget 7), `test:eval` 8 skipped exit 0,
  `npm audit --audit-level=critical` PASS, build PASS (37 routes,
  +csp-report). No keyed calls; EVAL numbers untouched.

## 8. Phase H4 keyless close-out (2026-09-19, $0; H4.3/H4.4 out of scope this pass)

- H4.1 LLM03 Excessive Agency (2026): model tool-surface re-audited —
  `tools/toolChoice/maxSteps/stopWhen/prepareStep/activeTools` zero hits in
  `src/` (grep, 2026-09-19); every generate*/stream call stays
  prompt-in/schema-out. Static ban EXTENDED in
  `tests/unit/security-surface.test.ts:32-46` (+`prepareStep`/`activeTools`,
  19 route files scanned) and RENUMBERED per the 2026-numbering iron rule
  (`LLM06 minimal agency` → `LLM03 Excessive Agency`; stale 2025 label gone).
- H4.2 LLM08 Hidden Context Exposure (2026): audit widened beyond prompts.
  RAG — orama index schema is `{ text }`-only
  (`src/lib/orama-client.ts:81-83`) fed solely by mechanical 500/50 resume
  chunks (`:97`, `:104-108`); no system/model/secret content; persistence
  stays user-partitioned (B4). Logs — `requestId` rides headers on every
  response incl. errors (`src/lib/api/errors.ts:32,36,44`; random id, never
  input echo); log reasons are class tokens only (classifyUpstreamError +
  H2/H3 token fields). Error text — zero `error.message`/`String(e)`/`${e}`
  echoes in all API routes (grep, 2026-09-19); validation failures return
  field-paths-only messages (`src/lib/api/validate.ts:10-16`, never values).
  Pinned: `security-surface.test.ts:70-108` renumbered to `LLM08` (+2 pins:
  resume-only chunks, no-echo scan + generic-envelope check).
- H4.5 supply chain: `npm audit --audit-level=critical` exit 0 (37
  sub-critical: 1 low / 31 moderate / 5 high, incl. inherited sharp/libvips
  notes — no action, recorded); `.github/dependabot.yml` ADDED (npm +
  github-actions, weekly Mon 09:00 Asia/Shanghai, minor/patch grouped,
  merge still gated on verify). CodeQL/Semgrep lane stays scheduled (§6).
- Gate: lint 0 errors (2 pre-existing warnings), tsc PASS, vitest
  **331/331** (41 files, +2 H4.2 pins), `test:eval` 8 skipped, build exit 0,
  mock e2e 1 passed, `npm audit --audit-level=critical` exit 0. Zero keyed
  calls; EVAL §5 untouched.

## 8.1 H4.3/H4.4 keyless pins (2026-09-19, $0; keyed halves gated)

- H4.3 LLM09 Misinformation: grounding already architectural — 6 verdict
  routes carry `evidenceField` + `confidenceField` (match/alignment/practice/
  star/chunk/behavior, route.ts:9 + :22-42 band); V2 dimensions require ≥1
  verbatim quote (`evaluation-contract.ts:55`); the practice-only disclaimer
  is single-sourced (`READINESS_DISCLAIMER`, `:47-48`) and rendered on all
  verdict surfaces (EvaluationView:57, PrintLayout:39, PrintableDossier:51,
  export:26) plus baked into the interview system prompt
  (`prompts/evaluation.ts:41`); legacy rows get LegacyBanner instead.
  Non-verdict lanes (code/vision/hint/copilot/trends/jd/init/OCR) are
  formative/extractive by design — no verdict envelope required. Pinned in
  `security-surface.test.ts` (LLM09 describe, 2 tests). Nightly
  quote-trace sampling stays the keyed half.
- H4.4 LLM10 Unbounded Consumption: token metering now covers **all 16 AI
  routes** (sync `usageOf`, deferred `logStreamUsage`, `reportUsage` via the
  fallback helper — miscount 15→16 caught by the pin itself, init-context).
  Pinned (`security-surface.test.ts` LLM10 describe: 16-file scan, every
  generation call must meter). B6/C1 enforcement unchanged (user-budget +
  quota-ledger suites); numeric fuse levels wait for H3.2 measured numbers.
- Gate: lint 0 errors, tsc PASS, vitest **334/334** (+3 pins), build exit 0.
  Zero keyed calls; EVAL §5 untouched. (No src changes this pass — pins +
  this section only; mock e2e covered by the unchanged tree.)

## 8.2 H3.5 lightweight-injection-classifier spike verdict: DISCARD (2026-09-19, $0)

- Candidate: `meta-llama/Prompt-Guard-86M` (mDeBERTa-v3, ~0.3B total params,
  512-token window). Evaluated on the official model card ONLY (no download,
  no merge — V4 "评估报告，不合流").
- V4 discard criteria vs card evidence (2026-09-19):
  (1) 中文覆盖 — card evaluates EN/FR/DE/HI/IT/PT/ES/TH jailbreak sets;
  **Chinese is absent** → FAIL (product is zh-primary: model zh-default
  per I18N_POLICY, interview transcripts predominantly Chinese);
  (2) 误报率 — OOD jailbreak FPR 3.9%, multilingual 5.3% on THEIR sets;
  ours (long transcripts) unmeasured but already above gate-tolerance for a
  pre-LLM filter (false flags must never punish candidate scores);
  (3) 延迟 — ~0.3B params CPU per 512-token chunk; 120KB-max transcripts
  need chunk-fan-out (card's own recommendation) → per-call gate latency
  unmeasured but structurally heavy.
  One FAIL suffices per V4 ("三项不过即弃") — 中文缺席是定论级。
- Adoption friction (reinforcing, not decisive): gated weights
  (contact-info agreement) + Llama 3.1 Community License (700M MAU clause,
  attribution, Acceptable Use Policy).
- Standing guidance: injection defense stays prompt-pinned
  (`buildEvaluation*` INJECTION/FAIRNESS guard phrases) + keyed drift
  regression on nightly; revisit only if a Chinese-covered ≤100M-param
  classifier appears with measured FPR/latency on OUR fixtures.

## 9. V5 Phase S 2026 remap (2026-09-19, $0; static only, zero keyed)

> Numbering law: GenAI 2026 (LLM06=Unbounded, LLM07=Misinformation,
> LLM09=Vector, LLM10=Improper Output). V4 old numbers corrected on sight.

### S1 LLM01 Prompt Injection — VERIFY-STANDING (no code change)

- 19 prompt files: 15 carry `UNTRUSTED` fences; 4 fence-N/A with reason:
  `index.ts` (barrel, no prompt bytes), `strict-json.ts` (the shared
  defense suffix itself, zero interpolation), `resume.ts`
  (`buildOcrInstruction` static string, zero interpolation),
  `coverage.ts` (synthesized InterviewState numbers/enums only — zero
  transcript/resumeText/jobDescription/userInput interpolation, verified
  by grep 2026-09-19; snapshot inputs pass `sanitizeStarSnapshot`,
  `state.ts:74-86`).
- Deterministic > probabilistic posture holds: Zod BodySchema on all 19
  routes + escape-at-sink (`message-text.ts:43-50`) + no tools on any
  model call (LLM03 pin) — injection cannot reach execution.
- Evidence: `ai-registry.test.ts` 14/14 fence pin + B1 STRICT_JSON_SUFFIX
  pin + `security-surface.test.ts` LLM03 zero-tools pin — all green
  (29 tests, 2026-09-19 re-run).

### S2 LLM02 Sensitive Disclosure — VERIFY-STANDING (no code change)

- Four faces, all clean: (1) prompts carry no secrets (model IDs centralized
  in `MODEL_IDS`, registry-only construction pin green); (2) RAG chunks
  user-partitioned (`orama-client` hub ids + `user_id` stamp, B4 partition
  pin green; anon sees NULL-bridge only); (3) logs PII-free by construction
  (`logging.ts:1-3` header + `ApiLogFields` allowlist shape — route,
  requestId, status, latency, model, token counts; bodies/transcripts/
  resumes/keys NEVER); (4) errors generic (`errors.ts:1-3` + fixed
  `ERROR_CODES` enum — `{code, message, requestId}`, no bodies/PII;
  provider text classified to class-only via `classify-error.ts`).
- Live secret grep 2026-09-19: 0 credential hits in src/scripts; sole
  `open.bigmodel.cn` hit is the public baseURL default
  (`registry.ts:67`, server-only, zero client imports of the registry —
  CLIENT_IMPORT_CHECK clean); LLM08 secret-pattern test green.

### S3 LLM03 Excessive Agency (2026跃升项) — VERIFY-STANDING

- Tool surface: ZERO tools on every model call (no function calling, no
  data access, no agentic loops) — pinned by `security-surface.test.ts:35`
  (scans all API routes for `tools:`/`toolChoice`/`maxSteps`/`stopWhen`/
  `prepareStep`/`activeTools`, green 2026-09-19).
- 最小功能/最小权限/最小自主： zero-tool IS the posture (nothing to
  exceed); mock tier is header-gated (`x-mock`, pinned by mock-contract).
- Note: the `stopWhen`/`maxSteps` string-ban doubles as the statutory
  ceiling — any future tool adoption must amend this pin first (fail
  loudly by design).

### S4 LLM04 Supply Chain — PARTIAL (shipped items green, 2 tracked)

- Shipped: `npm audit --audit-level=critical` exit 0 (re-verified B4,
  2026-09-19); Dependabot npm-weekly configured (`.github/dependabot.yml`,
  grouped minor/patch, majors individual, verify-chain required to merge).
- OPEN CodeQL/Semgrep lane: no workflow exists (`.github/workflows/` =
  ci/dsa/nightly-eval only) → tracked as scheduled work, not claimed.
- 大包治理 (measured restraint, no blind churn): type-only heavy imports
  are erased (`tldraw` types in `tldraw-extractor.ts:1`, `OnMount` type in
  `TechnicalScratchpad.tsx:10`; runtime Monaco already lazy); `recharts`
  static in 5 chart spots (dashboard below-fold + recruiter/report) and
  `tldraw` static in `SystemDesignBoard.tsx:7` stay put until per-package
  bundle attribution exists (dashboard transfer 720KB total is the only
  number — dynamic() without attribution risks SSR/loading-state churn
  for unmeasured bytes).

### S5 LLM05 Data Poisoning — VERIFY-STANDING (no training surface)

- Training/fine-tune provenance登记: NO training pipeline exists in
  src/scripts/evals (grep 2026-09-19, sole hit is a keyboard-shortcut
  false positive) → nothing to poison; RAG is the only data plane.
- RAG chunk provenance: chunks derive solely from the caller's own resume
  (`chunkText` 500/50, `orama-client.ts:46,104-110`), partitioned per user
  (`hubIdForUser`, `:34,73`) + `user_id` stamp on remote rows — cross-user
  chunk bleed is structurally impossible (B4 partition pin green).

### S6 LLM06 Unbounded Consumption — CONTROLS STANDING, fuse tracked

- Standing: C1 quota ledger (Zhipu/Gemini split counters, PT-midnight
  windows, `check` before / `record` after — B4 re-verified, session
  3/50+0/20); per-user daily budget + 429 + `RateLimit-*`/`Retry-After`
  (`guard.ts`, `user-budget.ts`, 7+8 tests green); per-route rate limits
  (e.g. match 20/min); cost-aware routing (2000-char flash/thinking line);
  thinking `max_tokens: 65536` single-site cap (`registry.ts:50`).
- Tracked: token 熔断线 awaits A3 measured numbers (only 403/101 per-match
  observed so far — provisional table stays provisional); per-user
  concurrency + timeout + payload caps are rate-limit-shaped today, not
  token-shaped.

### S7 LLM07 Misinformation — VERIFY-STANDING + nightly sampling tracked

- Standing: evidence-verbatim envelope (`evidenceField` quotes in every
  structured lane) + `ReadinessDisclaimer` (`EvaluationView.tsx:53`) +
  legacy caption-first (`LegacyBanner`, eval-compat `:9,140`) + every
  score carries uncertainty + training-estimate framing (practice-only
  redline, iron law 3).
- Tracked: output grounding抽查 (nightly quote-traceability sampling) —
  needs nightly data (external ①), not claimed.

### S8 LLM08 Hidden Context Exposure — VERIFY-STANDING + 50条抽查 tracked

- Standing: audit surface already spans prompts + RAG chunks + logs
  (requestId-only回显, `request-id.ts` sanitize) + error texts
  (fixed-code enum, class-only classification) — pinned by
  `security-surface.test.ts` LLM08 (green, in the 29-test re-run).
- Tracked: 50条抽查 cadence is a human/external routine, not a code delta.

### S9 LLM09 Vector/Embedding Weakness — VERIFY-STANDING (D3 basis kept)

- Orama access control = user-partitioned hubs + `user_id`-stamped remote
  rows + anon NULL-bridge (B4 pins green); no cross-user query path
  exists (`queryKnowledgeHub` reads the in-memory per-user instance).
- 全量重建 stays full BY DECISION (PERF_REPORT §5 D3: single-resume
  replacement semantics require dropping stale chunks; KB scale —
  incremental would be rebuild-with-extra-steps). 改增量 only on
  measured scale pain, never on speculation.

### S10 LLM10 Improper Output Handling — VERIFY-STANDING

- All LLM outputs pass allowlist-shaped gates before downstream use:
  Zod schemas on every structured lane (+ safeParse discipline),
  escape-at-sink on the render boundary (`message-text.ts:43-50`),
  vision constrained to `data:image/*` (SSRF kill, 002-era), uploads
  validated (413/5MB/SVG/length-lie pins in `api-hardening.test.ts`,
  green in 45/350).
- XSS/upload/SSRF lanes: covered by the same green suites; no new
  sinks added this session (verified: only 2 `dangerouslySetInnerHTML`
  sites, both audited in F4 — escaped sink + static CSS literal).

## 10. V6-Third S1 delta re-verification (2026-09-19, $0; static + keyless gates)

> Scope: §9 ten items re-checked against today's tree (HEAD `aece034` +
> own session's 13 uncommitted files; parallel V7 session's files untouched).
> Method: fresh greps below + full gates (`lint 0 err / tsc 0 /
> test 50-367 / build 0 / mock-e2e 1 / audit-critical 0`). Zero keyed calls.

- Fresh pins (2026-09-19 re-run): `UNTRUSTED` fences 15/19 prompts · zero
  `tools:/toolChoice/maxSteps/stopWhen/prepareStep/activeTools` in
  `src/app/api/*/route.ts` · `evidenceField` in 6 verdict routes ·
  `dangerouslySetInnerHTML` in exactly 3 files (2 render + 1 comment-only) ·
  secret grep clean (sole `service_role` hit is a code comment stating it
  never leaves the vault, `health/route.ts:31`).
- LLM01 → standing, no change. LLM02 → standing (RAG partition + PII-free
  logs + generic errors untouched). LLM03 → standing (zero-tool pin green,
  now 11/11 in `security-surface.test.ts`).
- LLM04 → PARTIAL standing + 1 accept: tiptap HIGH×2 unfixable inside
  tldraw 4.5.10 peer pins (`audit fix --dry-run` proves it); declined,
  Dependabot-weekly owns the fix (PAIN P2-04). Totals frozen at 37
  (1/31/5/0). CI audit + Dependabot rhythm re-verified present.
  收敛（并行 session，正交零冲突）：`parse-resume:9` 的 `@ts-expect-error`
  已被根治（`src/types/pdf-parse.d.ts` 重写为 v2 ambient 形状，指令同步
  删除）；B1 扫描出的 `any`（GrowthTrend/SkillBreakdown）正被类型化。
  全树复核 lint 0 err / tsc 0（2026-09-19 末）。
- LLM05 → standing (chunk provenance + partition untouched).
- LLM06 → STRENGTHENED: `combineSignal` hand-rolled (no `AbortSignal.any`
  dep — timeout budget now enforced on edge) + practice lane 25s→45s
  (`PRACTICE_TIMEOUT_MS`, `analyze-practice/route.ts:59`); `guard-timeout`
  3/3 pins. Fuse still tracked (A3 numbers external).
- LLM07 → standing (envelope + disclaimer + legacy captions untouched).
- LLM08 → standing (surface pins green).
- LLM09 → STRENGTHENED: abuse-boundary pins added
  (`orama-abuse.test.ts` 4/4 — anon-legacy-only, no cross-namespace
  restore, no stamp impersonation, injection-prompt self-chunks-only).
- LLM10 → STRENGTHENED: sink-inventory pin added (11th test in
  `security-surface.test.ts`); chat `role`→`sender` rename kills the
  ARIA-role confusion class; 4 a11y lint rules hardened (F1-01).
- Deferred (unchanged, not claimed): CodeQL/Semgrep lane · H4.3/H4.4 keyed
  halves · E4 `generateObject` migration (10 routes, keyed MVVP gated).
