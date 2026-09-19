# I18N_POLICY (Phase F2 对照表 — table first, act later)

> V3 F2: "`en` 默认与 ZH 分裂先出对照表再动手". This file IS the table.
> No prompt bytes change here: every model-facing locale switch needs MVVP
> keyed validation (docs/AI_EVALUATION.md) — blocked until nightly + approval.

## UI layer (client): en-default, zh on browser detect

- `src/lib/i18n/LanguageContext.tsx:16-32` — default `"en"`, localStorage
  `interve-lang` override, `navigator.language.startsWith("zh")` auto-detect.
- `src/lib/i18n/dictionaries.ts` — both locales required for new surfaces
  ("New surfaces must add both locales" convention). Status: dict ~43 keys,
  100+ hardcoded ZH strings in components (REPOSITORY_TRUTH) — UI rollout
  debt, not model risk.

## Model layer (server prompts): zh-hardcoded, 4 spots

| # | Lane | File:line | Hardcode | Default today |
|---|---|---|---|---|
| 1 | interview-chat | `src/ai/prompts/interview.ts:48-99` | Whole interviewer persona + PERSONA_MAPPING in Chinese | zh (product is Chinese-first; answers are Chinese) |
| 2 | init-context | `src/ai/prompts/context.ts:15` | "generate all content in Chinese (zh-CN)" | zh |
| 3 | analyze-match | `src/ai/prompts/match.ts:37` | "Provide your analysis in Chinese." | zh |
| 4 | analyze-interview | `src/app/api/analyze-interview/route.ts:66` | "Provide all textual analysis and reasoning in Chinese." | zh |

Other lanes (practice/star/behavior/chunk/code/vision/trends/hint/copilot)
carry no locale directive — model follows the input language (ZH answers →
ZH-leaning output, unverified per-lane).

## Policy (decided, pending MVVP for any EN branch)

1. UI stays en-default; model lanes stay zh-default. The split is INTENTIONAL
   (Chinese-first interview product, English UI shell) — not a bug to
   "unify" hastily.
2. Any EN model branch (locale param, translated persona, translated
   directives) requires: (a)对照表 row updated here, (b) MVVP three-piece
   suite with the EN leg keyed, (c) no n=1 tuning. Until then, locale params
   on builders are FORBIDDEN (dead params pretend).
3. Evidence quotes stay verbatim (input language) under every locale —
   never translated by the model (grounding integrity).
