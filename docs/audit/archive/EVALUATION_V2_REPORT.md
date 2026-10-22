# EVALUATION_V2_REPORT (Phase 4 Gate)

> Replaces "one LLM call outputs 0-100 scores + hire verdicts" with an
> evidence-grounded, rubric-anchored, readiness-based evaluation pipeline.
> Prompts, models, and non-eval behavior otherwise unchanged.

## 1. Contract (8.2-8.6)

- **Rubric registry** (`src/ai/rubrics/`): 5 versioned rubrics (behavioral/technical/system-design/data-ml/general-v1), 4-6 dimensions each, every dimension with 1-5 behavioral anchors. Framework mapping incl. legacy ids (`amazon_lps` → behavioral-v1); unknown → `general-v1`.
- **Evidence-first, schema-enforced** (`src/ai/evaluation-contract.ts`): every dimension REQUIRES ≥1 verbatim evidence quote (Zod `.min(1)` — a scoreless dimension cannot validate); scores are 1-5 anchor levels only; 0-100 derived deterministically (`×20`); per-dimension evaluator `confidence` (high/medium/low = evidence sufficiency, never candidate psychology); overall confidence = weakest link; `improvement` drill per dimension; `strengths/weaknesses/nextDrills` (1-5 each, feeds the Phase 7 practice loop); `qaReview` kept; `timelineEvents`/`trainingRoadmap` optional passthrough.
- **No hire verdicts** (8.5): `readiness ∈ {needs_foundation, developing, interview_ready, strongly_prepared}` + rationale + mandatory disclaimer ("Training estimate … not an employment decision").
- **No culture fit** (8.6): `cultureFitAdvisor`/`culturalTraits` generation removed; role-relevant collaboration/ownership/communication live INSIDE technical/behavioral rubrics as scored dimensions.
- **Prompt builder** (`src/ai/prompts/evaluation.ts`): anchors inlined, binding rules (lower-level-on-tie, no-evidence→1, forbidden list), STAR-marking rule for behavioral, Chinese-output continuity preserved.

## 2. Route (`analyze-interview`)

Same guard/rate-limit/cost-routing/fallback/observability as Phase 2. New: rubric selection → builder prompts → `EvaluationV2Schema` → server normalization (pins `version`/`rubricId`, drops off-rubric dimension ids, tolerates partial sets). Fallback responses carry `x-fallback`.

## 3. Compatibility (history preserved, never rewritten)

- `Interview.evaluationV2` added (optional); all legacy fields kept optional.
- `src/lib/eval-compat.ts`: V2 → full view; legacy → transparency view (dims with `anchorLevel: null`, `confidence: low`, "no evidence captured" notes, `Legacy …` verdict labels); empty → none. `sessionScore()` unifies dashboard/achievements math (legacy average now includes historical `bodyLanguage` — read-only fidelity).
- UI: report (readiness header + rationale + unified radar + dimensions + drills; council/culture sections legacy-only with 历史评估 captions), replay tabs (Diagnostics/Dimensions/Readiness), dashboard badges/scores/radar, modal banner + dimensions, dossier/print/export (readiness + dimensions + disclaimer), achievements (codes kept for stored unlocks; V2 logic on readiness/dimensions, legacy paths grandfathered), trends extraction (V2-first with legacy fallback).

## 4. Verification

- `npm run lint` 0/0 · `tsc` PASS · vitest **79/79** (22 new: registry 9, contract 9 incl. evidence-less rejection, compat 4) · `next build` PASS (re-run at gate).
- Negative tests prove the mechanism, not just the copy: evidence-less dimensions rejected, out-of-anchor scores rejected, hire/culture fields absent from the contract, pressure branches absent from the route.
- E2E re-run for touched surfaces (report/replay/dashboard/modal paths render via existing specs where coverable; full keyless suite at gate).
- Deferred (explicit): evaluator calibration/golden sets/human agreement (Phase 5 AI-eval harness); `analyze-chunk` endpoint fate; behavioral stealth-probing block now labeled for the rubric engine's follow-up planner; DeliveryCoach deterministic wording pass; full i18n of new copy.

---

## 5. Phase 4 delta 2026-09-14 (V2 lane: evidence envelope beyond analyze-interview)

> analyze-interview was already V2. This delta extends the doctrine to the
> three remaining user-facing 0-100 lanes, classifies every lane in code, and
> adds the first lane-specific golden set. All schema changes are
> optional-with-default (old model outputs, mocks, and stored rows still
> validate); no consumer broke; no output field removed.

### 5.1 Lane classification contract (`src/ai/lanes.ts`, pinned by `tests/unit/lanes.test.ts`)

- EVIDENCE_GRADED (scores shown; evidence + confidence mandatory):
  `evaluation-v2`, `analyze-practice`, `analyze-alignment`, `analyze-match`.
- STEERING_SIGNALS (loop-only heuristics; never displayed as evaluations;
  never hiring input): `analyze-star`, `analyze-behavior`, `analyze-chunk`.
- ADVISORY (structured advice, no user-facing score): `interview-system`,
  `analyze-code`, `parse-jd`, `init-context`, `copilot`, `generate-hint`,
  `analyze-vision`, `analyze-trends`, `parse-resume`, `interview-coverage`.
- Test asserts exhaustiveness over all 17 PROMPT_REGISTRY ids (a new prompt
  without classification fails the suite) + fail-closed `laneClassOf`
  (unknown → null). Rationale for leaving star/behavior/chunk numeric: they
  steer difficulty/follow-ups per turn; converting the live loop to 1-5+evidence
  is interview-engine scope (Phase 6), and all three are already quarantined
  (Experimental labels, callerless chunk pin, prohibitions suite).

### 5.2 Evidence envelope: practice 1.1.0 + alignment 1.2.0 + match 1.2.0

Each lane gained `evidence: string[max N].default([])` (verbatim quotes,
exact substrings) + `confidence: high|medium|low .default("medium")`
(evidence sufficiency, never candidate psychology), with prompts requiring
1-3 (practice) / 2-6 (alignment, match) quotes plus confidence semantics.
Mocks carry evidence + confidence (mock-contract safeParses stay green).
UI now shows the grounding next to every score: practice "What earned this
score" + confidence caption; setup "Basis in your documents"; match graph
"Basis in your documents" + confidence caption. Old rows without evidence
render scores as before (guarded blocks) — history preserved, never rewritten.

### 5.3 Practice golden set (first lane-specific calibration asset)

- `evals/practice-golden.json` v1.0.0: 5 synthetic cases (strong/weak/
  technical/thin/empty) with authored score bands + `mustQuote` substrings.
- Keyless contract (`eval-datasets.test.ts`): structure, band validity,
  and self-consistency (every mustQuote occurs verbatim in its answer —
  rot caught without keys).
- Keyed agreement (`evals/practice-golden.eval.test.ts`, self-skips without
  `GOOGLE_GENERATIVE_AI_API_KEY`): in-process analyze-practice calls assert
  band + non-empty evidence + mustQuote traceable to evidence
  (case-insensitive, provisional) + confidence enum. ≈5 flash calls/run;
  nightly/manual lane, not per-PR.

### 5.4 Deferred (explicitly NOT Phase 4)

V2-envelope migration of star/behavior/chunk (needs loop rewrite + turn-level
calibration; Phase 6); match↔alignment dedup (double spend, needs product
decision; Phase 5); multi-rater human labels replacing authored bands;
stability 3×-run + fairness lanes for practice (harness ready, keys needed);
practice-attempt evidence persistence (shown per-session only; attempts history
keeps scores — needs nullable column migration + staging).

## 6. Verification (2026-09-14)

- `npm run lint` 0/0 · `tsc` PASS · `npm run test` **26 files / 213 PASS**
  (was 206: +6 lanes, +1 practice-golden keyless).
- `mock-contract` 18/18 (new envelope keys validate via safeParse) ·
  `eval-datasets` keyless green · keyed practice suite self-skips exit 0
  (no keys in this env).
- `next build` re-run at gate (see Phase 4 VERIFICATION).

---

## 7. Steering-envelope delta 2026-09-15 (closes §5.4's migration item as envelope, not 1-5 conversion)

> The three STEERING_SIGNAL lanes kept emitting bare 0-100 with no
> traceability: follow-up/difficulty steering could not be audited back to
> transcript quotes. Full conversion to 1-5 anchors stays deferred (needs
> turn-level calibration + keyed runs); what ships here is the same
> optional-with-default envelope doctrine as §5.2 — scores untouched,
> grounding added, old outputs/mocks/rows still validate, no consumer broke,
> no field removed.

### 7.1 Schema + prompts + mocks (uniform, via `src/ai/evidence.ts`)

- `analyze-star` 1.1.0→1.2.0: schema += `evidence[≤4]` (2-4 verbatim quotes,
  S/T/A/R attribution where possible) + `confidence` enum. Prompt names the
  new top-level keys (STRICT_JSON_SUFFIX forbids unnamed extras); pinned
  strings preserved (`EXACTLY … s, t, a, r`, per-component keys, no floor,
  fences). Per-component `confidence` 0-100 numbers stay — they are
  assessment confidences, distinct from the top-level evaluator confidence.
- `analyze-behavior` 1.0.1→1.1.0: schema += `evidence[≤4]` (1-3 quotes) +
  `confidence`; prompt keeps `If completely missing, score 0` + fences.
- `analyze-chunk` 1.1.0→1.2.0: schema += `evidence[≤2]` (1-2 quotes) +
  `confidence`; psychology ban + key names preserved. Zero in-product
  consumers (callerless pin stays green) — the envelope exists so any future
  revival is grounded from birth.
- Mocks carry real-shaped evidence + `medium` confidence (contract proves it,
  not just safeParse-by-default).

### 7.2 Wired end-to-end (star + behavior only — chunk has no surface)

- `useInterveStore` += `starEvidence/starConfidence/traitsEvidence/
  traitsConfidence` (replaced per analyzer call — quotes are per-answer,
  unlike the max-accumulated numbers) + `setStarGrounding`/
  `setTraitsGrounding` + client-safe `normalizeGrounding()` (filters
  non-strings, caps, enum-falls-back-to-medium, never throws; lives in the
  store module so client components never pull zod into their bundle).
- `interview/page.tsx` stores grounding beside the existing max-accumulate
  number updates, guarded on non-empty (old/envelope-less responses render
  exactly as before).
- `LiveStats` STAR + Behavioral tiles (already opt-in Experimental) render
  `Basis in your answer: "…" · Evaluator confidence: … (evidence
  sufficiency)` when evidence exists — same copy pattern as practice's
  `What earned this score`. No new score exposure: grounding rides with the
  already-visible tiles.
- Drive-by fix found while wiring: `reset()` never cleared
  `behavioralTraits` (cross-interview leak); now clears with everything else,
  pinned by test.

### 7.3 Deliberately NOT done

Full 1-5-anchor conversion of the live loop (needs turn-level calibration +
keyed eval — the §5.4 core); keyed parity/stability/fairness runs (no keys);
StarTracker overlay grounding (progress-ring widget, no fit — LiveStats tile
is the grounding surface); prompt-locale parameterization.

## 8. Verification (2026-09-15)

- `npm run lint` 0/0 · `tsc` PASS · `npm run test` **26 files / 221 PASS**
  (was 216: +5 steering-envelope).
- `mock-contract` green (steering mocks validate WITH explicit evidence) ·
  `prohibitions` green (sentiment stays callerless — no new readers) ·
  `test:eval` keyless exit 0 (7 skipped, no keys).
- `next build` re-run at gate.
- Keyless chrome e2e on touched surfaces: `settings` 3/3 + `keyboard` 3/3
  = **6/6 with `--workers=1`**. Note: `keyboard` mic-toggle flakes under
  parallel workers (recording-START timeout before any steering code runs —
  whisper/fake-mic contention, pre-existing); passes alone and serially.

---

## 9. Grounding-completion delta 2026-09-15 (closes the keyless-doable §5.4/§8 remainders)

> Doctrine unchanged: scores untouched, grounding added, old rows validate,
> no consumer broke, no field removed. The one item NOT closed here is the
> live-loop 1-5-anchor conversion — it needs turn-level calibration + keyed
> runs, and converting without calibration would be a new bare-number regime,
> not a fix. That stays deferred until keys exist.

### 9.1 Practice-attempt evidence persistence (was: shown per-session only)

- `PracticeSession` += optional `evidence?: string[]` / `confidence?`
  (`src/lib/db.ts`); old rows without them render exactly as before.
- `practice/[id]/client.tsx` persists the envelope with each attempt via a
  client-safe `normalizeAttemptGrounding()` (string quotes only, cap 5 =
  schema max, enum-falls-back-to-medium, never throws — same contract as the
  store's `normalizeGrounding`, kept local so the practice route never pulls
  the interview store into its bundle). Envelope-less responses store
  score-only, exactly as before.
- Attempt-history pills keep their visuals; grounding rides in the hover
  `title` (`Basis: "…" · Evaluator confidence: …`), extended only when the
  attempt carries evidence.
- Staging migration: `supabase/migrations/004_practice_evidence.sql`
  (additive, nullable, `IF NOT EXISTS` — safe to run over existing data).

### 9.2 StarTracker grounding without touching the floating overlay

- The progress-ring widget has no fit for quotes and the LiveStats tile is
  already the visual grounding surface — so the tracker carries grounding
  accessibly only: hover `title` + screen-reader `role="note"` paragraph,
  both rendered solely when evidence exists (pure `starGroundingTitle()`
  helper, pinned by test). Visuals render exactly as before.

### 9.3 Mic-flake mitigation without touching the recording path

- `tests/keyboard.spec.ts` mic-toggle marked `test.slow()` (3× timeout
  budget for whisper-worker + fake-mic START under contention) with the
  contention cause + `--workers=1` requirement pinned in a comment.
- No change to `startRecording`/whisper/VAD code: the timeout sits before
  any steering code runs, so this is strictly a test-budget fix.

### 9.4 Deliberately NOT done (still)

Live-loop 1-5 anchors + turn-level calibration (needs keys); keyed
parity/stability/fairness + multi-rater bands (needs keys + staging);
match↔alignment dedup (double spend confirmed: `setup` calls alignment,
dashboard `KnowledgeMatchLoader` calls match on the same resume+JD — needs
a product decision on which surface survives, so analysis only, no code).
