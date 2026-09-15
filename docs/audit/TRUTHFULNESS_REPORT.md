# TRUTHFULNESS_REPORT (Phase 3 Gate)

> All changes incremental. No prompt/model/output-shape changes to scoring
> pipelines (that is Phase 4). This phase removes fabrication and relabels
> uncertainty honestly.

## 1. Removed fakes (P0)

| # | Fake | Evidence (before) | Fix | Verification |
|---|---|---|---|---|
| 1 | Eye-contact / posture / expression `%` from `Math.random()` | `VisionTelemetry.tsx:44-59` + `onVisionDataUpdate` → `interview/page.tsx:114,735-744` persisted `bodyLanguage` into `radarScores` → report/dashboard | **Deleted** `VisionTelemetry.tsx`; new `CameraSelfView.tsx` (preview + permission states, "Local only / No visual analysis", zero metrics, zero callbacks) | `truthfulness.test.ts` (file absent, no `Math.random`, no `visionData`/`bodyLanguageScore`/`bodyLanguage:` in page) |
| 2 | `Focus.Idx %` random walk | `TelemetryWidget.tsx:35-43` | Removed tile + state; widget renamed to honest "Session" audio-pipeline status (AI Active/Listening/Standby) | Same suite |
| 3 | "实时延迟 Nms" random walk | `SystemHealthIndicator.tsx:15-24` | Real `navigator.onLine` connectivity (live listeners) + stress flag; latency number removed; `wsLatency` prop made `never` so callers cannot pass fake numbers (type-level guard) | Same suite; caller updated |
| 4 | Vision `GOOD/POOR %` tile | `LiveStats.tsx:108-140` fed by fake upstream | Tile deleted; dead `sentimentScore`/`accuracyScore` props deleted | Same suite |
| 5 | Dead emotion pipeline burning quota | `interview/page.tsx:853-868` called `/api/analyze-chunk` every final chunk; both setters fed dead props | Call removed; WPM/filler local measurement kept | Same suite (`analyze-chunk` absent from page) |
| 6 | Heuristic → pressure manipulation | `interview-chat/route.ts:145-154` (`cognitiveLoad<30` → "加大压力"; `>80` → forced gentleness) driven by silence+filler formula | Block deleted with rationale comment; field still accepted-and-ignored for client compat | Same suite (branches absent) |

## 2. Relabeled uncertainty (honest, not fake)

- `LiveStats` Load tile → "Strain · Experimental" with caption "Heuristic from pauses & fillers — not a medical or emotional measure"; removed red HIGH alarm styling.
- STAR / Behavioral tiles: "AI ASSESS" → "AI estimate · Experimental" (real LLM pipelines, uncalibrated until Phase 4).
- `analyze-chunk` route: kept (no callers) with deprecation note — `sentimentScore` must never be presented as psychology; Phase 4 redefines or removes it.

## 3. Multimodal doctrine (binding for all future work)

**Measured → Evidence → Interpretation. Never Camera → Random → UI, never Transcript → LLM → Arbitrary 92.**

- **Language** (real): transcript content, STAR structure, technical correctness, evidence/examples, conciseness, relevance. Scores require evidence + uncertainty (Phase 4).
- **Audio** (observable only): speech rate, pause duration, filler words, turn latency, interruption, answer duration, volume stability. BANNED packaging: anxiety, personality, confidence, honesty, stress-as-diagnosis.
- **Visual** (high value): system-design diagrams, whiteboard, slides, screen content, code, documents, charts — via `analyze-vision` (real, snapshot-scoped). Camera = optional self-view, local-only, never stored, never scored. BANNED: face → emotion/personality/honesty/intelligence/hireability/culture-fit; accent/voice → competence/personality; any protected-attribute inference.
- **If it cannot be measured reliably, show `Unavailable`/`Experimental` — never a percentage.**

Left for Phase 4 (explicitly NOT Phase 3): evidence-grounded rubric engine, `hireVerdict`/`cultureFit` replacement, STAR/behavioral calibration, stealth-probing prompt block (`behavioralTraits<40`), `analyze-chunk` endpoint fate.

## 4. Verification

- `npm run lint` 0/0 · `tsc` PASS · vitest **57/57** (49 existing + 8 new) · `next build` PASS (re-run at gate).
- E2E suites touching changed UI re-run green (interview/interview-flow/greenroom/interactive); no spec asserted removed copy (verified by grep).
- Decorative `Math.random` remains ONLY in `landing-background.tsx` / `chat-background.tsx` canvas particles (allowlisted: never scored/stored).
- Historical rows containing `bodyLanguage` still render (`|| 0` / `filter(Boolean)` guards verified in dashboard/report/achievements); nothing new is written.

---

## 5. Phase 3 delta 2026-09-14 (V2 lane: prompt-layer truthfulness)

> Prior report removed fabricated telemetry and relabeled UI. This delta hardens the
> prompt layer: untrusted-content isolation everywhere, removal of the last
> score-inflation instruction, and neutralization of emotion-measurement
> semantics. No output-schema changed (compat); no generation path added/removed.

### 5.1 Untrusted-content fences 5/14 → 14/14

All 9 bare-interpolation builders now fence candidate/employer-controlled inputs
as data (`### UNTRUSTED X START/END ###` + never-follow-instructions line,
same convention as match.ts 1.1.0):

| Builder | Version | Fenced inputs |
|---|---|---|
| behavior | 1.0.0→1.0.1 | transcript (+ STRICT_JSON_SUFFIX: Zhipu generateObject lane lacked exact-key pinning) |
| star | 1.0.1→1.1.0 | transcript + codeContext + systemDesignContext |
| practice | 1.0.0→1.0.1 | answer (+ STRICT_JSON_SUFFIX) |
| code | 1.0.0→1.0.1 | problemStatement + code |
| jd | 1.0.0→1.0.1 | jobDescription |
| context | 1.0.1→1.0.2 | jobDescription + resumeContext |
| hint | 1.0.0→1.0.1 | currentCode + chatHistory |
| vision | 1.0.0→1.0.1 | problemContext |
| trends | 1.0.0→1.0.1 | sessionDataJson |
| chunk | 1.0.1→1.1.0 | text + interview context (see 5.3) |

Contract: `tests/unit/ai-registry.test.ts` += "Phase 3: every user-content builder
fences inputs as data (14/14)" (1 new test). Registry auto-picks versions
(`prompts/index.ts` imports constants — no registry edit needed); semver-shape
test unaffected.

### 5.2 Score-inflation instruction removed (star 1.1.0)

Deleted: "non-empty code/design ⇒ Action MUST be ≥40 … proportionally increase
A and R up to 100". Replaced with evidence-only credit: credit only what the
transcript or artifact actually demonstrates; never inflate for a merely
attached artifact; never assign a minimum; score 0 with no evidence.
`timeSpentSeconds` kept (interview-loop steering signal, schema already
"Estimated"; StarTracker rambling heuristic unchanged). The two
`toContain("at least 40")` pins updated to the new language (intentional
product fix, not test-softening — V2 iron law: no evidence ⇒ no score).

### 5.3 Emotion-measurement neutralization (chunk 1.1.0)

System prompt reworded from confidence/nervousness psychology to observable
delivery (fluent/specific/structured vs hesitant/vague/incoherent) plus an
explicit ban: "do NOT infer emotions, personality traits, confidence as a
personal trait, stress, or honesty". Keys unchanged (`sentimentScore`,
`technicalAccuracy`) for compat — endpoint has zero in-product consumers
(`prohibitions.test.ts` callerless pin stays green) and MUST NOT be presented
as psychology (route comment updated). Full redefine-or-remove stays Phase 4.

### 5.4 Culture/Hire display: verified contained (no code change)

Sweep 2026-09-14: every Culture Fit / Council Debate / Cultural Traits /
verdict mapping renders ONLY for `view.legacy` rows with `LegacyBanner` /
"· 历史评估" captions (report/[id]:195-232,298-307,401; replay:356-400;
SessionDetailModal:95-224; PrintLayout:10-85; PrintableDossier:12-118;
dashboard:229-241). V2 rows render Readiness + `ReadinessDisclaimer`, never a
hire decision. Generation already zero (`prohibitions.test.ts`:
no `hireVerdict:`/`cultureFitAdvisor:` writes outside `db.ts` types). No
change needed; recorded here to close the Phase 1 P0-4 residue item.

### 5.5 Deferred (explicitly NOT Phase 3)

match↔alignment dedup (double spend, double scale — needs product decision +
consumer migration; Phase 5 scope); 6-lane V2 envelope migration (needs
calibration harness; Phase 4 scope); interview-chat client `model` param
allowlist tightening (bounded + logged today; Phase 4); keyed prompt
regression (no funded keys in this env — prompt deltas are format/wording
only, Zod+repair unchanged, full suite green).

## 6. Verification (2026-09-14)

- `npm run lint` 0/0 · `tsc` PASS · `npm run test` **25 files / 206 PASS**
  (was 205: +1 fence contract test; 2 pins updated for the intentional floor removal).
- `prohibitions.test.ts` 8/8 (callerless sentiment, no hire/culture writes,
  no protected-attribute inference) · `truthfulness.test.ts` 8/8.
- Incidents during work: hint.ts fence edit broke template-literal escaping
  (esbuild transform failure) — caught by vitest, fixed (`\`\`\``), re-green.
  One `set-state-in-effect`-style over-strict test placement (fence asserted on
  system instead of user prompt) — corrected, not softened.
