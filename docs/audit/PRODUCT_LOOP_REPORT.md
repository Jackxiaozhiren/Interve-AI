# PRODUCT_LOOP_REPORT (Phase 7 Gate)

> Closes the loop: Target → Plan → Adaptive interview → Evidence eval →
> Diagnose → Drill → Retry → Compare → Track. No decorative options:
> every new control is wired end-to-end.

## 1. Goal-based setup (12.1)

- Added Step-3 sections: **Interview Type** (11 taxonomy entries + custom
  free text), **starting Difficulty** (4), **Time budget** (10/15/20/30 min).
- Type → rubric mapping (`types.ts` v1.0.0); coding auto-enables the
  scratchpad; type/difficulty/budget persist on the interview record and
  travel via URL into the loop (`initLoop` + `interviewType` body field).
- Rubric precedence (backward compatible): explicit non-general
  `framework` wins (old clients unchanged); else the canonical type
  selects; default general-v1 either way.
- Plan preview in Step 5 + `plan` persisted on the record.
- Deliberately NOT added: language selector (prompts can't honor it yet —
  adding one would be fake UI), company/role changes (already existed).

## 2. Plan + gap matrix (12.3)

- `interview/plan.ts`: deterministic assembly from the setup alignment
  report (strengths/gaps labeled AI-estimated) + type rubric dimensions.
  Unmentioned rows are `unknown`, never invented gaps; empty alignment →
  `ungrounded: true` badge path. Focus areas = gaps-first (max 3) + rub-ric
  coverage fill (max 4 total).

## 3. Adaptive difficulty (12.4)

- Setup select seeds `useInterviewLoopStore` (validated + clamped);
  Phase 6 engine adapts ±1/turn; badge shows `Turn N · Difficulty`;
  `interview-chat` tooling notes fire per type (coding/whiteboard).

## 4. Intelligent follow-up (12.5)

- Covered by STAR probes + coverage gaps (Phases 4-6). New: observable
  short-answer probe (<120 serialized chars → "ask for one concrete
  example or number"). Char count only, threshold tested, no psychology.

## 5. Practice loop (13) + drills (14)

- Curated bank: 28 drills (one per rubric dimension, versioned) +
  `drillsForWeaknesses` (weakest-first, cap 3, general fallback).
- Report "Your drill plan" (weakest first, task + tip + practice link).
- Replay diagnostic + report QA cards: "Retry this question →" deep links
  (`/practice?retry=`, unicode-safe); hub custom-retry sessions reuse
  `PracticeSessionClient` with stable per-question ids; attempts history
  with per-attempt deltas (Retry → Compare); `?q=` search prefill.

## 6. Progress (15) + Replay (16, scoped)

- `ProgressInsights`: frequency (4-wk buckets), type performance, STAR
  completion, technical depth, answer length (observable), improvement
  velocity — all pure, nulls render as "—", never invented.
- Replay: per-turn retry links (done); per-turn rubric/metrics need
  turn-level eval storage — deferred with the attempt-compare loop as the
  working substitute. Full "Better Answer" already exists (perfectRewrite);
  generated "Alternative Approach" deferred (new AI call, needs keys+eval).

## 7. Explicitly deferred (with basis)

- **Coding 2.0 multi-language execution** (Judge0/Pyodide): new infra +
  sandbox security review + product decision on backend. JS-only stays.
- **System Design 2.0 continuous vision**: per-stroke model spend + UX
  design; snapshot review stays.
- **Salary/product/business tracks as distinct experiences**: taxonomy +
  general rubric cover them; dedicated rubrics need benchmark data.
- **Turn-level rubric persistence** for replay metrics.
- **Language selector / full i18n**: prompts are Chinese-hardcoded;
  selector without backend support would be fake UI.

## 8. Verification

- `npm run verify` exit 0 (lint 0/0, tsc, vitest **141/141** — 17 new,
  build 36 routes). New: taxonomy/pinning, gap honesty (unknown≠gap),
  drill coverage 28/28 + weakest-first, retry-link unicode round-trip,
  progress nulls-vs-values + bucket math, loop-contract static markers.
- Keyless chrome e2e re-run at gate (setup/practice/replay/dashboard
  paths touched).

---

## 9. Phase 5 delta 2026-09-14 (V2 lane: drill closure + gap-lane decision)

### 9.1 Practice drill loop closed (Practice → Evaluate → Diagnose → Drill → Retry)

Gap found: interview evaluations closed the loop via DrillPlan (report →
`/practice?q=` → hub prefill → Retry → Compare), but practice feedback
suggested nothing — Diagnose→Drill was missing for the drill lane itself.

- `analyze-practice` schema += `drillIds: string[max 3].default([])`;
  prompt 1.1.0→1.2.0 lists the 28 bank ids and instructs up-to-3 picks for
  weak areas (empty if score ≥ 85). Model suggestions are untrusted:
  `normalizePracticeDrills()` (exported, unit-tested) drops unknown ids,
  dedupes, caps at 3, never throws — same precedent as
  `normalizeEvaluation`'s off-rubric drop. Route applies it before responding.
- Mock practice payload carries a valid drill id (mock-contract green).
- `practice/[id]/client.tsx` renders "Recommended drills" (bank lookup by
  id → title/task + hub link), guarded on non-empty; unknown ids render
  nothing (client re-checks the bank, defense in depth).
- Tests: prompt lists real bank ids (spot-check) + normalize keeps/drops/
  dedupes/caps/never-throws + every bank id survives (lanes.test.ts).

### 9.2 match↔alignment: deliberate redundancy, NOT merged (decision record)

Evidence (read 2026-09-14):
- `setup/page.tsx:304` calls analyze-alignment (Gemini 2.5-flash) and
  persists a matchData-shaped copy (`:417-421`); `KnowledgeMatchLoader`
  calls analyze-match (Zhipu cost-aware) ONLY when `!session.matchData`
  (`:13`). Per session, at most ONE JD-gap call fires — no runtime double
  spend. The duplication is code-maintenance, not quota.
- Different models, costs, output keys, surfaces (setup plan focus vs
  dashboard ring), and consumers. Merging prompt text or model routing
  without keyed parity regression would violate the no-unverified-rewrite
  law (no funded keys in this env).

Executed instead (zero behavior change):
- `src/ai/evidence.ts`: shared `evidenceField(max, describe)` +
  `confidenceField(describe)`; all three EVIDENCE_GRADED lanes (minus
  analyze-interview, whose contract is stricter) now construct the envelope
  from one module. Per-lane caps and describe prose stay at the call site —
  describes are sent to the model, so unifying them is a prompt change.
- Merge criteria recorded for the keyed lane: identical-model A/B on
  shared golden JD-gap set with parity bars (score drift ≤ 10, evidence
  overlap), then single implementation + consumer migration.

### 9.3 Deferred (explicitly NOT Phase 5)

Practice-attempt evidence persistence (nullable column migration needs
staging); practice attempts in dashboard progress (dashboard data-flow
change + e2e; interviews-only progress stays); multi-language code
execution; continuous whiteboard eval; full i18n.

## 10. Verification (2026-09-14)

- `npm run lint` 0/0 · `tsc` PASS · `npm run test` (see Phase 5 VERIFICATION) ·
  `next build` re-run at gate.
- `mock-contract` green (drillIds validate) · lanes envelope compat green ·
  keyed practice suite still self-skips (no keys).

---

## 11. Decision 2026-09-15: alignment canonical, match converges (cut deferred)

> Product call, per user delegation ("follow your recommendation").
> No runtime double spend for new sessions (setup persists a matchData-shaped
> copy so `KnowledgeMatchLoader` skips its `analyze-match` fetch); the cost is
> maintenance duplication + a lossy adaptation that dropped evidence/confidence.

- **Keep `analyze-alignment`** (edge, Gemini flash): it feeds `buildInterviewPlan`
  (strengths/gaps → focus areas) via `recommendedFocus` — cutting it would mean
  rebuilding the plan chain on match.
- **Converge `analyze-match`** (nodejs, cost-aware Zhipu) to a legacy compat
  shim: old sessions without `matchData` keep rendering; new sessions never
  call it. The actual route removal happens only after keyed parity
  (identical-model A/B on a shared JD-gap golden set: score drift ≤ 10 +
  evidence overlap), per §9.2 criteria.
- **Shipped now (keyless-safe, additive):** `matchData` += optional
  `evidence`/`confidence` (`db.ts`); setup persists the alignment envelope via
  shared `normalizeGrounding()` (`evidence.ts`, pinned by
  `tests/unit/match-grounding.test.ts`); `KnowledgeMatchGraph` already rendered
  these fields when present, so new sessions light up "Basis in your documents"
  with zero change to old rows. No prompt/model/consumer change.
