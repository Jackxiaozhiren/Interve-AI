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
| YYYY-MM-DD | `git rev-parse --short HEAD` | — | PASS / FAIL(route: …) | |

## Machine findings (2026-09-19, V5 F5 — human eyes still required above)

- FIXED landing axe (`a11y-visual.spec.ts:11` now green): 3× StatCard eyebrow
  `text-slate-400` → `text-slate-500` (`src/components/data/StatCard.tsx:37`,
  4.8:1 on white); landing snapshot regenerated deliberately (`-u`, spec
  allows after intentional visual changes).
- OPEN interview-room axe (`a11y-visual.spec.ts:35` still red): dark-room
  micro-labels, set varies with live state — sampled `LiveStats` "AI is
  Thinking" `text-sky-600`, "Filler"/"Status" `text-slate-500` 10px,
  "OK" `text-emerald-700` on `bg-emerald-100/50`, "Session"/"Standby"
  `text-slate-700`, status pill `bg-white/60`, "Local only"
  `bg-slate-100/70 text-slate-500` 9px (`CameraSelfView.tsx:61`), empty-state
  hint under `opacity-60` (`interview/page.tsx:1533-1537`), end-call button.
  Needs a systematic dark-token pass + human contrast spot-check (§3 above),
  not blind per-node churn — routed to the human pass, not fixed by machine.
- GREEN machine lanes: keyboard.spec全绿, login axe, login snapshot, calm
  toggle (`accessibility.spec.ts`), `jsx-a11y` 3 hard rules + core-web-vitals
  6 rules standing (`eslint.config.mjs:8-17`, lint 0 errors).
