# EVALUATION_CARD — evidence-grounded rubric evaluation v2

> Companion to `docs/audit/EVALUATION_V2_REPORT.md`. This card states what
> the evaluator guarantees, measures, and does NOT do.

## Method

1. Per interview format, a FIXED versioned rubric (`behavioral/technical/
   system-design/data-ml/general-v1`, 4–6 dimensions, 1–5 behavioral anchors).
2. The model scores ONLY against those anchors (lower-on-tie), with ≥1
   verbatim evidence quote per dimension — enforced by Zod schema, not prose.
3. UI 0–100 values are derived deterministically (`anchor × 20`).
4. Evaluator `confidence` (high/medium/low) = evidence sufficiency, weakest
   link overall. It is never a candidate-psychology judgment.
5. Practice readiness (`needs_foundation/developing/interview_ready/
   strongly_prepared`) + mandatory disclaimer replaces hire verdicts.

## What is measured

- Dimension levels with cited transcript evidence, rationale, confidence,
  and a next drill; QA flaws + professional rewrites; strengths/gaps/drills.
- Delivery observables (WPM, fillers, durations, interruptions, STT stats).

## What is NOT done

- No hire/no-hire decisions, no culture-fit scoring, no personality,
  emotion, honesty, intelligence, accent, or protected-attribute inference.
- No cross-candidate ranking; no employer-facing adjudication surface.
- Scores are session-scoped practice estimates, not hiring suitability.

## Validation status (honest)

- Structural: schema rejects evidence-less dimensions and out-of-anchor
  scores (unit-tested). Dataset contracts validated keylessly.
- Keyed (needs `ZHIPU_API_KEY`, `npm run test:eval`): 12-case golden
  agreement (readiness + bands + MAE/adjacent/Spearman/Kappa), 3-repeat
  stability, 4-vector injection resistance, 4-pair fairness regression —
  all with PROVISIONAL bars pending human baselines (see EVAL_REPORT).
- Human labels: current bands are single-author v1; multi-rater labeling
  (Cohen/Spearman vs raters) is tracked future work.
