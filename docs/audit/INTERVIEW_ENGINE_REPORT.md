# INTERVIEW_ENGINE_REPORT (Phase 6 Gate)

> Real interview loop: state → planner → interviewer → answer → analyzer →
> state → follow-up. No preset-question railroading; no frozen context.

## 1. Loop state (`src/ai/interview/state.ts`, pure + tested)

- `InterviewState v1.0.0`: difficulty, turnCount, startedAt, timeBudgetSec
  (default 900s), questionHistory (cap 50), starAvg/traitsAvg (nullable),
  followUpTargets (cap 5).
- `levelToDifficulty`: Intern/Junior→easy, Mid→medium, Senior+→hard.
- `deriveFollowUpTargets`: STAR dims <50 + traits <40 (the thresholds the
  UI already used — now transparent state, not stealth instructions).
- `adaptDifficulty`: hold if turns<2 or no signals; combined mean ≥75 → up,
  <40 → down; one step/call, clamped easy..expert.
- `recordTurn` / `remainingSec` / `synthesizeServerState`: server rebuilds
  authority-side state from `messages` every turn (turns, question excerpts,
  avgs, targets); the client's `difficultyHint` only seeds the ±1 adaptation
  base (unknown → seniority default). Clients cannot dictate difficulty.
- Analyzer snapshots may lag one turn (async side-channel) — stated in the
  coverage prompt as experimental estimates.

## 2. Follow-up planner output (`src/ai/prompts/coverage.ts`, registry #17)

Per-turn section: turn/difficulty/remaining budget, coverage avgs,
prioritized gap list (or advance-the-plan), last-3-questions anti-repeat
list, ask-at-level instruction, wrap-up nudge under 20% budget.

## 3. Route integration (`interview-chat`)

- Accepts optional `interviewLoop {startedAt, timeBudgetSec, difficulty}`
  (malformed → 400); synthesizes state; appends coverage section.
- Behavioral stealth-probing block DELETED (replaced by transparent gaps);
  STAR/company/persona grounding untouched.
- `INTERVIEW_PROMPT` stays 1.1.0 (builder bytes besides the Phase 6-noted
  deletion unchanged); new `interview-coverage 1.0.0` registered.

## 4. Frontend (`useInterviewLoopStore` + interview/page)

- Loop init per interview id; `recordUserTurn` on every send (question =
  latest AI message or "(opening)").
- **Staleness fix (Phase 1 debt)**: `sendMessage({text}, {body: fresh…})`
  now overrides the render-time transport snapshot with send-time values
  (contexts, analyzer snapshots, loop timing). Verified merge semantics in
  the installed SDK (`{...transportBody, ...options.body}`).
- Minimal UI: `Turn N · Difficulty` meta in PinnedQuestion header.

## 5. Verification

- `npm run verify` exit 0 (lint 0/0, tsc, vitest **124/124** — 17 new,
  build 36 routes). New tests: state rules incl. clamp/hold/empty-history,
  coverage rendering incl. wrap-up branch, route loop contract
  (accept/reject), registry count 17, stealth-absence assertion.
- Chrome e2e re-run at gate (interview flows exercise init/send paths).
- Deferred: time-budget UI control (default 900s; configurable in Phase 7
  setup), per-skill (JD-derived) required-skills tracking (needs JD skill
  extraction — Phase 7 Resume+JD grounding), difficulty effectiveness
  measurement (Phase 7+ evals).
