# EVAL_REPORT (Phase 11 Gate)

> The project's future technical moat, built honestly: real harness, real
> datasets, verified math — with provisional bars explicitly marked until
> human baselines and funded keys exist.

## 1. What shipped

- `src/ai/evals/metrics.ts`: quadratic-weighted Kappa, Spearman (tied
  ranks), MAE, exact/adjacent agreement, stdev. Verified against
  hand-computed values (κ=0.6 case, ρ=0.5 case).
- `evals/golden.json` (v1.0.0): 12 synthetic cases (6 tracks ×
  strong/weak) with full-dimension anchor bands + readiness. Contract:
  unique ids, all 6 tracks, bands within 1-5, full rubric coverage per
  case — all asserted keylessly every run.
- `evals/injection-cases.json` (4 vectors: answer-score, answer-verdict,
  prompt-extract, JD-context) with demand markers.
- `evals/fairness-pairs.json` (4 surface-token pairs; profiles NO
  protected traits — swaps names/pronouns/org-type/gap-framing only).
- `evals/runner.ts`: in-process calls to the REAL handler (same
  schema/guard/provider path); env-gated (`ZHIPU_API_KEY`).
- Suites: golden agreement (bands + MAE<1.0 + adjacent>0.8 + ρ>0.5 +
  κ>0.4), 3-repeat stability (stdev ≤1.0 anchor, no readiness flips),
  injection (drift ≤20 + no flips + no markers), fairness (drift ≤20 +
  no flips). `test:eval` lane with dedicated config; keyless = 4 skipped,
  exit 0 (verified).
- `tests/unit/eval-metrics.test.ts` + `tests/integration/eval-datasets.test.ts`
  run in the normal gate (keyless).

## 2. Provisional bars (not fake rigor)

All numeric bars above are provisional: set from first-principles
tolerance (anchor granularity = 20pts; drift ≤20 = within one anchor;
stability ≤1.0 anchor), NOT from measured baselines. A breach flags
human review; it proves nothing alone. Bars graduate to calibrated gates
only after (a) funded-key nightly runs establish variance, (b) multi-rater
labels replace single-author bands.

## 3. Deferred with basis

- Multi-rater human labeling (needs raters + adjudication protocol).
- Nightly keyed runs + trend dashboard (needs funded keys + CI secrets).
- Adversarial red-team beyond the 4 vectors; intersectional fairness
  (deliberately NOT built without ethicist review — token swaps only).
- `test:e2e` keyed AI paths (chat.spec fixme stands).

## 4. Verification

- `npm run verify` exit 0 (lint 0/0, tsc, vitest **174/174** — 12 new,
  build 36 routes). `npm run test:eval` exit 0 (4 skipped, reason logged).
- Chrome e2e re-run at gate (privacy custody copy touched).
