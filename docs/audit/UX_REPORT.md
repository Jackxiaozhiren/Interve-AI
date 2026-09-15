# UX_REPORT (Phase 9 Gate)

> Information architecture first, no visual-theme rework. Every new option
> is wired; decorators without function were refused.

## 1. Live interview de-distraction (21)

- STAR / Behavioral / Strain tiles now hide behind `showLiveInsights`
  (default OFF, persisted in `accessibility-storage`). Always-visible:
  Pace + Filler (measured), session status, self-view, pacing hints.
- New toolbar toggle (AI + `aria-pressed`); existing Calm/Focus/CC/Dyslexia
  toggles gained `aria-pressed`.
- Scores live in the post-interview report; the room shows progress
  (`Turn N · Difficulty`) instead of verdicts.

## 2. Keyboard (WCAG 2.1.1) — P0 closed

- Record button: press-and-hold (mouse/touch) + keyboard `onClick` toggle
  via `event.detail === 0` guard (no double-toggle). Verified by e2e:
  Enter starts AND stops recording with fake devices.
- Dashboard history cards: `role=button` + `tabIndex` + Enter/Space +
  focus ring + accessible name.
- Session modal: Esc closes, focus moves to Close on open.
- Message actions: visible on `group-focus-within` (were hover-only).
- GreenRoom bypass + text input + setup wizard were already keyboard paths.

## 3. Focus / SR / captions / motion / contrast / targets

- Skip link now MOVES FOCUS to `#main-content` (`tabIndex=-1` target,
  client `SkipLink`, e2e-verified) — was scroll-only.
- LiveCaptions history is keyboard-scrollable (`tabIndex` + label);
  deliberately NO live region (announcement owned by transcript
  `role=log`; dual live regions would double-speak) — documented.
- Target size measured, not assumed: icon-sm 32px, icon 36px,
  icon-lg 40px, xs 24px, sm:h-7 28px, message actions ~26px — all ≥
  WCAG 2.2 AA 24px. No changes needed; recorded here.
- Contrast: GreenRoom bypass link slate-400 (~2.5:1) → slate-500.
- Password toggle: removed `tabIndex=-1` exclusion, added
  `aria-label` + `aria-pressed`.
- Calm / LiveCaptions / Dyslexia modes kept and now `aria-pressed`-honest.

## 4. IA + setup numbering

- 10 surfaces mapped (Landing/Dashboard/Setup/Preflight[Step-6+GreenRoom]/
  Live/Analysis/Replay/Drills[practice+report plan]/Progress/Settings).
  No new routes needed; no dead-end added.
- Setup visual numbers fixed: 01/02/03a-e/04/05a-d/06 (was 04/04,
  05/06/07/08 vs 05). Stepper (1-6) unchanged and now consistent.

## 5. i18n architecture (23), honestly scoped

- Real: `LanguageProvider` mounted + persisted (`interve-lang`) with
  browser auto-detect; NEW Phase 9 strings ship en+zh via
  `dictionaries.interview` (turn/difficulty/toggle/badges/camera notes);
  en↔zh key parity pinned by unit test.
- NOT claimed: full bilingual UI. Inventory: interview room copy and all
  AI prompts remain Chinese-hardcoded; prompt locale parameterization
  needs eval measurement (tracked, not faked). No language selector was
  added anywhere the backend cannot honor.

## 6. No-camera / no-voice guarantees

- Camera: optional self-view, denied-state copy, full interview without
  video. Voice: text input always available; recording keyboard-operable;
  GreenRoom text-mode bypass. Covered by keyless e2e.

## 7. Verification

- `npm run verify` exit 0 (lint 0/0, tsc, vitest **154/154** — 2 new incl.
  dictionary parity, build 36 routes).
- New `tests/keyboard.spec.ts` (3/3): skip-link focus transfer, mic
  keyboard toggle on+off, insights default-off + opt-in.
- Chrome e2e full project re-run at gate (below). Full WCAG 2.2 AA audit
  with assistive tech remains tracked (needs manual pass + axe CI lane).

## 8. Phase 6 (V2) delta 2026-09-15 — settings preferences wired + lint zero

> V2 Phase 6 IS this report's scope (V1 Phase 9). The gate above stands;
> this delta closes the residual gaps found on re-audit: lint had drifted
> to 2 warnings, the language toggle had no accessible name, and Settings
> offered only mock/disconnected controls for the two preference domains
> the platform actually persists (language + accessibility).

- **Lint 0 errors / 2 warnings → 0/0.** `interview-chat/route.ts`
  imported `sanitizeStarSnapshot`/`sanitizeTraitsSnapshot` without using
  them; sanitization already happens inside `synthesizeServerState`
  (`state.ts:287-288`). Dead imports removed, zero behavior change.
- **LanguageToggle accessible name.** Was icon + bare `EN`/`中` text.
  Now `aria-label` (`Switch language to Chinese` / `…English`, bilingual)
  + `title`. Pinned by static contract in `i18n.test.ts`.
- **`dictionaries.settings` (16 keys, en+zh).** Language + accessibility
  copy ships in both locales; the existing key-parity test covers the new
  namespace generically, plus an explicit settings-chrome assertion.
- **Settings gains a working preferences card.** Language EN/中文 buttons
  (`setLang`, `aria-pressed`, persists `interve-lang`) + four accessibility
  toggles (Calm / LiveCaptions / Dyslexia / LiveInsights, all `aria-pressed`
  with On/Off labels, persist `accessibility-storage`). These are the same
  stores the interview room already reads — the card is a second,
  discoverable writer, not a new state system. No new routes, no visual
  rework.
- **Explicitly NOT done (honest):** full bilingual UI (interview room copy
  and all AI prompts remain Chinese-hardcoded; prompt locale
  parameterization needs keyed eval measurement — tracked, not faked);
  Profile/Notifications/Security mock sections untouched (out of scope);
  Lighthouse re-run (PERF_REPORT numbers + decor-LCP analysis stand;
  this delta touches no LCP element).

### Verification (2026-09-15)

- `npm run lint` 0/0 · `tsc` PASS · vitest **26 files / 216 PASS**
  (was 214: +1 settings chrome, +1 toggle-name contract).
- `next build` PASS (re-run at gate).
- Keyless chrome e2e on touched surfaces: `settings.spec.ts` (3/3) +
  `keyboard.spec.ts` (3/3) = **6/6**. Browser log noise (`bigint NaN`,
  `Orama index could not be restored`) is pre-existing, unrelated.
