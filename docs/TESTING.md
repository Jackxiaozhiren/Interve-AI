# TESTING

Pyramid: unit → integration → API/DB/RLS → AI eval → E2E → a11y → visual regression → security.

| Lane | Command | What it proves |
|---|---|---|
| Unit | `npm run test:unit` | registry static guards, rubrics, contracts, state rules, coverage, drills, progress, i18n parity, audio pure fns |
| Integration | `npm run test:integration` | 401×17, 400/413/429 matrices, session forge matrix, RLS static contract, truthfulness (no Math.random metrics), prohibitions (no hire/culture/emotion), mock contracts, eval datasets, loop contracts, proxy guards |
| AI eval | `npm run test:eval` | keyless: dataset contracts + metric math (live suites self-skip, exit 0); free live: `npm run test:eval:free` (≤3 flash calls, needs free `ZHIPU_API_KEY`); full keyed: 31+3 calls nightly/manual on free quota (1-concurrency), never per-PR |
| E2E smoke | `npm run test:e2e:smoke` | 12 spec files on `chrome-1280x720` with fake media devices: landing, setup, interview(+flow), dashboard, replay, settings, privacy, `e2e/interview-greenroom`, `e2e/interview-interactive`, and chat.spec.ts — which self-skips without `E2E_MOCK` and is collected by the journey lane instead |
| E2E axe | `npm run test:e2e:axe` | axe serious/critical scan of `/`, `/login` and the interview room; the same file's two snapshot legs are excluded, see below |
| E2E journey | `npm run test:e2e:mock` | `mock-journey.spec.ts` + `chat.spec.ts`, keyless against a dev server booted with `AI_MOCK=1` |
| Full E2E (local only) | `npm run test:e2e` | 12-project matrix (chrome/edge/firefox/safari × 3 viewports). **Not a CI lane, and not one that could be**: the workflow installs chromium only, `chrome`/`edge` select proprietary channels and `safari` maps to WebKit, and at the smoke lane's measured 5.4 s/test on the single CI worker the matrix's 420 executions need ~38 min against a 30-min job ceiling |
| a11y | `npm run test:a11y` | convenience wrapper for `accessibility.spec.ts` alone; CI already gets that file through smoke. Full AT pass tracked |
| Security | `npm audit`, secret scan, gateway/upload/abuse suites | 39 (1L/30M/8H/0C) triaged; 0 secret hits; abuse extras green |
| Perf | Lighthouse + `scripts/perf-probe.mjs` | `/` 92/100/100/100; misses explained in `docs/audit/PERF_REPORT.md` |

### Specs no CI lane collects

`tests/unit/ci-lane-claims.test.ts` enumerates every `*.spec.ts` under `tests/`,
subtracts the files each CI command names, and fails on any remainder not listed
here — so a new spec cannot join the silent majority. Delete a row once its file
is wired in; the guard fails on stale rows too.

| Spec (tests) | Why it is not collected |
|---|---|
| `tests/a11y-visual.spec.ts` → "Visual regression" (2) | Baselines are committed as `*-darwin.png` and Playwright keys snapshot filenames by platform, so an ubuntu runner can never resolve them. The file's three axe legs do run, via `npm run test:e2e:axe`. |
| `tests/keyboard.spec.ts` → "mic button is keyboard-operable" (1) | Failed on its first-ever runner execution after being added to smoke. The mic button is `disabled={!modelsReady \|\| isLoading}`, so Enter is swallowed until the Whisper worker reports ready, and on a cold runner that never happened inside the budget; the test previously asserted only *visibility*, which a disabled button satisfies. Its three sibling tests do pass on the runner and are collected by `npm run test:e2e:keyboard`. Whether `modelsReady` is reachable in CI at all is still open — no other CI test has ever started a recording. |
| `tests/e2e/core-visual-consistency.spec.ts` (1) | Contains zero assertions: it navigates, writes PNGs under `artifacts/`, and logs PASS/ERROR. It cannot fail for a product reason, so collecting it would buy runtime rather than coverage. |

Golden journey: Signup→Setup→resume+JD→Preflight→answer→complete→analysis→Replay→Drill→delete-session. `testMatch:**/*.spec.ts` keeps Playwright off vitest files. `E2E_MOCK=1` runs `tests/mock-journey.spec.ts` keyless.

### A spec whose verdict follows the browser's Supabase env

`tests/interview-flow.spec.ts` signs in with `loginAs()`, which mints only the app's own session
cookie. `stampOwner()` refuses to write an ownerless `interviews` row — policy, not a bug — so the
spec's outcome depends on which persistence path the browser bundle takes:

| dev server env | smoke result |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` absent — the shape every CI `gate` step uses, since `.github/workflows/ci.yml` passes only `CI: true` to `test:e2e:smoke` | passes |
| `NEXT_PUBLIC_SUPABASE_URL` present via `.env.local` on a developer machine | fails on the room assertion with `refusing to write "interviews": there is no Supabase auth session to own the row` |

Measured on the same commit both ways (2026-10-05): emptying the two variables in the server's
process env gives `npx playwright test tests/interview-flow.spec.ts --project=chrome-1280x720`
→ `1 passed`; with `.env.local` in force the same command fails at
`tests/interview-flow.spec.ts:68`. `tests/interview.spec.ts`'s room test passes in both shapes, so
only this one file is env-split.

Read that local red as "this machine has credentials the runner does not", not as a code signal.
The durable fix is `seedSupabaseSession()` from `tests/helpers.ts`, which gives the browser a real
Supabase identity; it is deliberately not applied here, because that path cannot be observed green
on this machine — the local `.env.local` credentials are stale, and the REST calls they produce
answered `406` during the run recorded above — and a change nobody can verify is not a change to
make blindly.
