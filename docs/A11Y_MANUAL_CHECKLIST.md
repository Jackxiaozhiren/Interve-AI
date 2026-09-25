# A11Y_MANUAL_CHECKLIST (Phase F3 — human pass, machine cannot do this)

> Automated coverage (green in CI, do NOT re-do by hand): axe
> serious/critical = 0 on landing/login/interview-room
> (`tests/a11y-visual.spec.ts`), skip-link focus, mic-button keyboard
> operation, AI-estimates opt-in (`tests/keyboard.spec.ts`), calm-mode
> toggle (`tests/accessibility.spec.ts`).
>
> What remains needs eyes, ears, and hands. One human, one keyboard, one
> screen reader (NVDA/JAWS on Windows or VoiceOver on macOS). Check each box
> with build under test + date + initials. Any FAIL blocks practice-only
> launch for the affected route.

## 0. Setup (5 min)

- [ ] Prod build: `npm run build && npm run start` (never dev — animations and source maps differ).
- [ ] Fresh profile, no extensions. Display 100% scaling first, then 200% zoom pass (reflow, no horizontal scroll on `/`, `/login`, `/dashboard`).
- [ ] `prefers-reduced-motion: reduce` ON for the full pass (decor must freeze; content must stay complete).

## 1. Keyboard full flow (no mouse, Tab / Shift+Tab / Enter / Space / Esc)

- [ ] Landing → login → dashboard via keyboard only; every interactive element reachable, focus VISIBLE at all times (no focus loss into `body`).
- [ ] Setup form: all fields labeled (name announced), validation errors announced AND linked to fields (`aria-describedby`, not color-only).
- [ ] Interview room: start/pause mic, text input submit, hint button, end-call — all operable; Esc closes scratchpad/design drawers and returns focus to the invoking button.
- [ ] Report/replay: drill links, export, delete (destructive action has a confirm step reachable by keyboard).
- [ ] Skip link (`SkipLink`) lands in `#main-content` on every route (automated on landing only — repeat on `/dashboard`, `/interview`, `/practice`).
- [ ] No keyboard traps: Tab cycles out of every modal/drawer/tour overlay (OnboardingTour included).

## 2. Screen-reader critical path (VoiceOver/NVDA, listing + browse modes)

- [ ] Page titles announced per route (`%s · Interve AI` template resolves, no "untitled document").
- [ ] Interview room live region: AI replies announced (polite), streaming cursor NOT announced per-token (assertive spam = FAIL).
- [ ] Scores/readiness announced with context ("readiness developing, training estimate, not an employment decision" — disclaimer must be IN the reading order, not visually-hidden-only).
- [ ] Legacy rows announce "Legacy assessment" BEFORE the verdict (caption-first ordering; see F1).
- [ ] Images/canvas (tldraw board, charts): have text alternatives or are skipped with a summarized equivalent — never silent data loss.
- [ ] Form controls expose accessible names (mic button is NOT "button" — automated once, re-verify after any UI change).

## 3. Visual/reading checks (10 min)

- [ ] Contrast spot-check on new/changed text since Phase 13 (target ≥4.5:1; secondary text already at 5.98:1 — don't regress).
- [ ] 200% zoom: report tables, sidebar nav, interview controls reflow without overlap.
- [ ] Reduced-motion: no liquid-morph/blob drift, no entrance animations on LCP elements; interview timers still understandable without animation cues.

## Sign-off

| Date | Build | Tester | Result | Notes |
|------|-------|--------|--------|-------|
| 2026-09-19 | `8bbf3fa`+dirty | owner（in-session 签字） | PASS | keyboard/reader/contrast human pass; machine axe 5/5 ×2 same day |
| 2026-09-25 | `e07f33b`+this tree | taking-over session | MACHINE ONLY | The 09-19 row is an in-session sign-off, so the human half is **not independently verifiable** and is re-opened here rather than inherited. Machine half re-run warm and mocked: axe lane green 5/5 serial; one `color-contrast` failure observed on a *cold* Turbopack first-compile of `/interview`, not reproduced in 12+ further scans (incl. immediate, pre-settle) → recorded as a cold-start artifact, and the fix stays "re-run a human pass", not "delete the settle". |

## Machine findings (2026-09-19, V5 F5 — human eyes still required above)

- FIXED landing axe (`a11y-visual.spec.ts:11` now green): 3× StatCard eyebrow
  `text-slate-400` → `text-slate-500` (`src/components/data/StatCard.tsx:37`,
  4.8:1 on white); landing snapshot regenerated deliberately (`-u`, spec
  allows after intentional visual changes).
- CLOSED interview-room axe (`a11y-visual.spec.ts:35` green 2× consecutive,
  2026-09-19): deterministic token pass — micro-labels slate-500→600,
  badges deepened (emerald/rose-700→800, amber-600→700, sky/rose-600→700),
  badge/translucent bgs solidified (/50–/70→/70–/95 + pill white/95),
  toolbar defaults `bg-white/60 text-slate-500`→`bg-white/80 text-slate-700`
  (7 toggles), end-call rose-500→700, empty-state `opacity-60` removed,
  Local-only badge solidified; each fix verified by node disappearance
  across 11 probes. Residual single-node flicker traced to
  AnimatePresence mid-fade scans (settled scans CLEAN, computed pill
  fg/bg ≈ 9:1) → spec now settles 2.5s pre-axe (WCAG steady-state rule,
  commented in-test; NOT a threshold tune — §6: multi-probe convergence,
  real nodes fixed first).
- GREEN machine lanes: a11y-visual 5/5, keyboard.spec全绿, login axe,
  login + landing snapshots, calm toggle (`accessibility.spec.ts`),
  `jsx-a11y` 3 hard rules + core-web-vitals 6 rules standing
  (`eslint.config.mjs:8-17`, lint 0 errors).
