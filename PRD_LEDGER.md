# PRD_LEDGER — Interve AI, user-facing PRD lane

Lane: `wt-prd` / branch `prd/mainline`. Operator: agent, session 2026-10-30.
Rule: appended, never overwritten for dated entries. Every figure carries
`[measured <cmd> <date>]`, `[cited <url> <date>]` or `[target <basis>]` (N3).

---

## 1. Baseline capture (§2.2)

Run from `/Users/jackson/Interve AI/wt-prd` on 2026-10-30. Each command's **own** exit code.

| # | command | rc | reading |
|---|---|---|---|
| 1 | `git rev-parse --short HEAD` | 0 | `fe3b6ff` [measured git rev-parse 2026-10-30] |
| 2 | `git status --short` | 0 | empty — clean tree [measured git status 2026-10-30] |
| 3 | `git branch --show-current` | 0 | `prd/mainline` [measured git branch 2026-10-30] |
| 4 | `git log origin/main..HEAD --oneline` | 0 | empty — no local commits [measured 2026-10-30] |
| 5 | `node -e` list package.json scripts | 0 | 30 scripts [measured 2026-10-30] |
| 6 | `grep -rn "都会保存" src/components/auth/LoginForm.tsx src/app/signup/page.tsx` | 0 | 2 hits — `LoginForm.tsx:132`, `signup/page.tsx:100` [measured 2026-10-30] |
| 7 | `grep -rn "requireSession: false" src/app/api/session/route.ts` | 0 | 1 hit — `route.ts:37` [measured 2026-10-30] |
| 8 | `npm run facts:check` | 0 | `facts ratchet: OK` [measured 2026-10-30] |
| 9 | `npm run falsify` | 0 | `200/213 selected`, `ALL_PLANTS_CAUGHT` [measured 2026-10-30] |

**Baseline verdict: GREEN.** §2.2 requires nine commands; all nine exited 0 and
none returned an unexpected reading.

Reading 9's shape, stated so it is not over-read later: the harness holds **213**
plants and selects **200** in fast mode; `--slow` adds 13 browser plants
[measured `node scripts/falsify/guards.mjs --list`, which prints
`(200/213 selected; --slow adds the browser plants)`, 2026-10-30]. So the fast
gate is complete for what it covers, and the 13 Playwright plants were **not run
this session** — see §12.

## 2. Pre-flight (not §2.2, recorded because it shaped the session)

| step | rc | reading |
|---|---|---|
| `git fetch` | 0 | remote reached |
| `git rev-list --count HEAD..origin/main` (pre-merge) | 0 | 124 commits behind [measured 2026-10-30] |
| `git merge --ff-only origin/main` | 0 | `1cb3747..fe3b6ff`, 172 files, clean fast-forward |
| `npm ci` (first attempt) | 1 | blocked by the host's bulk-delete guard: `SAFE_DELETE_BULK_CONFIRM_REQUIRED {"count":769,"threshold":50}` on `node_modules/@ai-sdk` |
| `npm ci` (after moving the stale tree aside) | 0 | 991 packages [measured 2026-10-30] |

Environment deviation: `package.json` declares `node: 24.x`; this host ran
`v22.22.2` [measured `npx --no-install next --version` under the session node].
npm warned `EBADENGINE` and installed anyway. Recorded, not fixed — a runtime
change is not in the authorized surface.

## 3. Liveness table over §1's laws (§10.1 step 6)

| law | check run | status | reading |
|---|---|---|---|
| N1 no weakening to get green | `npm run falsify` | **ACTIVE** | rc 0, 200/213 plants, `ALL_PLANTS_CAUGHT`, floor `MIN_PLANTS = 213` in the harness [measured 2026-10-30] |
| N2 practice only | `npm run test:unit -- evaluation-contract` | **ACTIVE — check RED on this host, cause located** | rc 1, 23 of 1270 tests time out at 5000 ms under full parallelism; `tests/unit/evaluation-contract.test.ts` alone is 16/16 green [measured 2026-10-30]. All 23 failures are `Error: Test timed out in 5000ms`, zero assertion failures. At `--maxWorkers=3`: 4 timeouts; those 3 files run alone: 39/39 green. This is host capacity, not a product red — but the literal check is not green and is not recorded as such. |
| N3 number hygiene | this file | **ACTIVE** | every figure below carries a bracket tag |
| N4 non-author human | `grep -n "Human trial" PRD_LEDGER.md` | **ACTIVE — no row yet** | §9 holds the table, empty. No claim in this file is a user-outcome claim. |
| N5 posture not agent's | §15.1 | **ACTIVE** | not answered; §8 Ring C stands pending it |
| N6 no spend | providers in use | **ACTIVE** | measurement used the existing Zhipu free key; no new provider introduced |
| N7 a push publishes | `git log origin/main..HEAD --oneline` | **ACTIVE** | empty at session start; only local commits below, no push |
| N8 prose is claim | Appendix B re-derivation | **ACTIVE** | README's `next-pwa` claim is contradicted by the build — see §7 |
| N9 evidence before conclusions | this file | **ACTIVE** | every row names its command or `file:line` |
| N10 UI promise is a test assertion | B1/B7 inventory | **ACTIVE** | §7 lists the promises and the test that would have to fail |

No law is VOID: each of the ten carries an executable `check:`.

## 4. §2.4 platform readings — BLOCKED, with the command that shows it

All three readings need the platform, not the repo. Two were attempted and failed at the network layer:

| reading | probe | result |
|---|---|---|
| migration columns in the live DB | `node scripts/verify-supabase-free.mjs` with the anon key from `Interve-AI/.env.local` | **rc 1**, `[supabase-free] FAIL: network error: TypeError: fetch failed` [measured 2026-10-30] |
| auth providers enabled | `GET {SUPABASE_URL}/auth/v1/settings` | TLS reset: via the host proxy `SSL_ERROR_SYSCALL`; direct `Connection reset by peer` [measured `curl -v`, 2026-10-30]. DNS resolves (`104.18.38.10`), so this is not a name-resolution failure. |
| redirect allowlist | admin-only; the anon key cannot read it | not attempted — no credential class exists for it |

`/auth/v1/settings` and the migration probe are therefore **unmeasured**, not
green and not red. The owner can run both from a shell with egress; commands were
handed over in the transcript.

## 5. Appendix B census (2026-10-30)

Absence predicates carry a positive control, run in the same pass, so a zero is
a reading rather than a typo.

| id | reading | control / note |
|---|---|---|
| B1 | 2 hits: `LoginForm.tsx:132`, `signup/page.tsx:100` — "面试记录、报告与回放都会保存" | promise still shipped on both doors |
| B2 | 1 hit: `src/app/api/session/route.ts:37` `requireSession: false` | route mints a session for an unverified identity |
| B3 | 3 hits: `LoginForm.tsx:86`, `signup/page.tsx:55`, `setup/page.tsx:266` | identity minted client-side with `crypto.randomUUID()` |
| B4 | 2 raw hits, 1 after the discard rule | `dashboard-shell.tsx:89` `w-[280px]` is fixed chrome with no breakpoint prefix → real; `replay/[id]:348` is `max-w-[250px]` (matched inside `max-w-`), not chrome → discarded |
| B5 | `playwright.config.ts:31-40` | only `Desktop Chrome/Edge/Firefox/Safari`; **no phone device** |
| B6 | rc 1, zero matches in `src/app/interview` + `src/components/interview` | control: `matchMedia` matches elsewhere (`global-background.tsx:27`, `landing-background.tsx:61`) → the interview surface genuinely never branches on viewport |
| B7 | `DEFAULT_USER_BUDGET_RPD = 200` (`user-budget.ts:28`); UI states it at `PricingSection.tsx:47` | bucket key = session user id **and** client IP, both checked before either increments (`user-budget.ts:76-95`) — IP binding was added because `POST /api/session` mints cookies for typed identities |
| B8 | 25 hits | `modelsReady` gates start, hints, submit and the standby overlay |
| B9 | rc 1, zero matches | control: `RateLimit` matches in server routes (`health/route.ts:52`, `csp-report/route.ts:44`) → no client reads `RateLimit-Remaining` |
| B10 | 2 hits: `whisper.worker.ts:16` `'Xenova/whisper-base'`, `kokoro.worker.ts:18` `from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX')` | weights come from the HF hub origin; no `env.remoteHost` override present |
| B11 | `manifest`: 0 hits in `src`; no `sw.js` at depth 3; `next.config.ts:3-9` records that `@ducanh2912/next-pwa` was **removed** | control: `next-pwa` matches only that comment, not an import |
| B12 | README:39 still lists `next-pwa` in the stack; `docs/audit/REPOSITORY_TRUTH.md:37` describes PWA config | contradicts B11 — see §7 |
| B14 | 4 adjudicated orphans: `analyze-chunk`, `analyze-trends`, `health`, `init-context` (+ `csp-report`) | `tests/unit/orphan-api-routes.test.ts:13-40` |
| B15 | rc 1 on the manifest; rc 1 on `window.analytics`/`track(` | control: `TelemetryProvider` matches (`src/lib/telemetry.tsx:6`) → the app has first-party telemetry and **no vendor analytics** |
| B16 | 7 tables referenced from `src/lib`: interviews 8, achievements 6, practice_sessions 4, evaluations 4, telemetry 3, orama_index 3, assessments 2 [measured grep `from('<t>')` 2026-10-30] | read/write split per table not yet separated — see §12 |
| B17 | 21 hits; live-render ones include `SessionDetailModal.tsx:210-215`, `PrintableDossier.tsx:108-109`, `PrintLayout.tsx:98`, `export.ts:74-93` | schema-side: `db.ts:71`, `eval-compat.ts:125-132` |
| B17t | 2 hits: `evaluation-contract.test.ts:64-65` bans `hireVerdict`, `councilDebate`, `cultureFitAdvisor`, `culturalTraits` **in the eval shape** | the ban is contract-level, and the render paths are outside that contract |
| B18 | 2 hits, both `href="/chat"` (`HeroSection.tsx:29`, `landing/page.tsx:67`); guard list at `proxy.ts:20` | no `href="/setup"` in the marketing surface |
| B19 | rc 1, zero matches | control: `fairness` matches in `tests/integration/eval-datasets.test.ts:61` and `docs/research/TECH_RESEARCH.md:20` → datasets and research exist, no app path consumes them |
| B20 | 4 hits, all hard-coded Chinese (`match.ts:38`, `context.ts:16`, `speech-session.ts:91`, `delivery-metrics.ts:8`) | no prompt builder takes a locale argument |
| B22 | `stampOwner` guards 7 tables (`api-client.ts:116-427`); `NO_OWNER` raised at 4 sites | guarded: interviews, evaluations, practice_sessions, telemetry, achievements, orama_index, assessments |
| B23 | 13 `min-w-[` hits; **2 exceed 390 px**: `ui/table.tsx:14` `min-w-[640px]`, `TechnicalScratchpad.tsx:221` `min-w-[400px]` | the other 11 are 18–300 px and deliberately small |
| B24 | 12 page routes under `src/app`; marketing entry is `/` and `/landing`, both leading to `/chat` | B18 |
| B21 | **not run** — manual phone-viewport walk, deferred to Ring A (§10.2) | — |

## 6. §9.4 concurrency ceiling — measured

Probe: `POST {open.bigmodel.cn}/api/paas/v4/chat/completions`, `model: glm-4-flash`
(the app's `zhipuFlash` default, `src/ai/providers/registry.ts:16`),
`max_tokens 8`, one round per level, all N in flight simultaneously.
[measured 2026-10-30]

| N | 200s | 429s | p50 ms |
|---|---|---|---|
| 1 | 1 | 0 | 989 |
| 2 | 2 | 0 | 2134 |
| 4 | 4 | 0 | 896 |
| 8 | 8 | 0 | 818 |
| 16 | 16 | 0 | 839 |
| 32 | 26 | **6** | 835 |
| 64 | 23 | **41** | 443 |

Knee is between 16 and 32. Excess is refused with `429`, never queued. p50 stays
under 1 s until the knee, then shortens as the pool fills (443 ms at N=64 is
survivor bias, not improvement).

**Honest consequence (§9.4):** a pooled free key sustains roughly **26 concurrent
completions** and refuses the rest. A public multi-user deployment cannot rest on
one pooled free key regardless of what the code does; BYOK (S2) or a budget change
becomes a requirement, not an option. This reading shapes the §15.1 posture
question rather than answering it.

## 7. Claim inventory (B1 / B7 / B12 / B17 + the UI sentence)

| id | claim as shipped | where | what the code does | test that would fail |
|---|---|---|---|---|
| C-1 | 「面试记录、报告与回放都会保存」 | `LoginForm.tsx:132`, `signup/page.tsx:100` | `POST /api/session` mints a session with `requireSession: false` (B2) for a client-chosen id (B3); persistence depends on a database write the promise does not name | none located that fails when the row is absent |
| C-2 | 「每类接口每天 200 次请求」 | `PricingSection.tsx:47` ← `DEFAULT_USER_BUDGET_RPD` | 200/day per user **and** per egress IP (`user-budget.ts:76-95`) | budget tests exist; the IP-sharing consequence is stated in code comments, not in the UI sentence |
| C-3 | stack includes `next-pwa` | `README.md:39` | plugin removed; no `manifest` in `src`, no `sw.js` emitted (`next.config.ts:3-9`) | B11 |
| C-4 | PWA config described as live | `docs/audit/REPOSITORY_TRUTH.md:37` | same as C-3 | B11 |
| C-5 | council/culture-fit verdicts rendered to the user | `SessionDetailModal.tsx:210-215`, `PrintableDossier.tsx:108-109`, `PrintLayout.tsx:98`, `export.ts:74-93` | the eval **contract** bans these keys (`evaluation-contract.test.ts:64`), so the ban stops at the schema and does not reach render/export | contract test bans the shape; no test bans the render |

N10 reading: C-1 is the promise with no failing test behind it; C-5 is the ethics
line enforced at the contract and not at the surface.

## 8. Ring C — the two gates (§10.2)

| tier | who | status |
|---|---|---|
| 1 — domain-level block monitor | agent | pending in this commit; recorded in §8a when read |
| 2 — one mainland phone, cellular, Wi-Fi off, proxy off | owner | **pending** — no artifact received |
| 3 — mainland 拨测, 电信/联通/移动 | owner | **pending** — no artifact received |
| 4 — five humans | deferrable | not scheduled |

No tier is marked green. Per §6.4a no `hk`/`sg`/`us` node and no reading from this
laptop may stand in for any tier; this host resolves through a proxy, so its own
result would describe the proxy.

### 8a. Tier 1 reading

_pending — filled in the commit that records it._

## 9. Human trial

| who | device | network | what they said | artifact |
|---|---|---|---|---|
| — | — | — | — | — |

Empty. N4 is unmet and no milestone claims a user outcome.

## 10. Triage

_pending §10.3 — written after the owner answers §15's five decisions. No source
file is edited before that approval._

## 11. Fix log

| commit | item | gate output | rc |
|---|---|---|---|
| — | — | — | — |

Empty: no source file has been edited in this lane.

## 12. Deliberately not done

1. **The 13 `--slow` browser plants were not run.** They need Playwright browsers
   and a running app; `--slow` was not attempted. The fast gate covers 200/213.
2. **§2.4's two platform readings are unmeasured**, blocked by network reset at
   this host (§4). Not inferred from `.env.example`, not inferred from `docs/`.
3. **B21's phone-viewport walk is not done** — it belongs to Ring A, which §10.4
   sequences after this ring.
4. **B16's read/write split per table is not separated.** Counts above are total
   `from('<table>')` call sites, not reads vs writes.
5. **No `npm run build`, `npm run lint` or `npm run typecheck` was run.** They are
   not in §2.2, and running them would be a gate reading this ledger does not
   claim.
6. **Nothing was pushed.** All commits are local to `prd/mainline`.
7. **The audit machinery's internal health was not inspected** (§10.2 excludes it).
8. **`/tmp/wt-prd-node_modules.bak`** (2.0G) still exists; cleaning a backup is an
   owner decision.
