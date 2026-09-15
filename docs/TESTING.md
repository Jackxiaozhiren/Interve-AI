# TESTING

Pyramid: unit → integration → API/DB/RLS → AI eval → E2E → a11y → visual regression → security.

| Lane | Command | What it proves |
|---|---|---|
| Unit | `npm run test:unit` | registry static guards, rubrics, contracts, state rules, coverage, drills, progress, i18n parity, audio pure fns |
| Integration | `npm run test:integration` | 401×17, 400/413/429 matrices, session forge matrix, RLS static contract, truthfulness (no Math.random metrics), prohibitions (no hire/culture/emotion), mock contracts, eval datasets, loop contracts, proxy guards |
| AI eval | `npm run test:eval` | keyless: dataset contracts + metric math (live suites self-skip, exit 0); free live: `npm run test:eval:free` (≤3 flash calls, needs free `ZHIPU_API_KEY`); full keyed: 31+3 calls nightly/manual on free quota (1-concurrency), never per-PR |
| E2E smoke | `npm run test:e2e:smoke` | landing/setup/interview(+flow)/dashboard/replay/settings/a11y/chat-fixme on `chrome-1280x720` with fake media devices |
| Full E2E | `npm run test:e2e` | 12-project matrix (chrome/edge/firefox/safari × 3 viewports) — CI lane, needs browsers + keys for AI paths |
| a11y | `npm run test:a11y` + `keyboard.spec.ts` | skip-link focus, mic keyboard toggle, insights default-off, axe passes; full AT pass tracked |
| Security | `npm audit`, secret scan, gateway/upload/abuse suites | 39 (1L/30M/8H/0C) triaged; 0 secret hits; abuse extras green |
| Perf | Lighthouse + `scripts/perf-probe.mjs` | `/` 92/100/100/100; misses explained in `docs/audit/PERF_REPORT.md` |

Golden journey: Signup→Setup→resume+JD→Preflight→answer→complete→analysis→Replay→Drill→delete-session. `testMatch:**/*.spec.ts` keeps Playwright off vitest files. `E2E_MOCK=1` runs `tests/mock-journey.spec.ts` keyless.
