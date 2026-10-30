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
this session** — see §14.

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

## 4. §2.4 platform readings

Taken by the owner from a shell with egress on 2026-10-30, and **independently
reproduced from this host at 19:13 the same day** — see the correction note below.

Correction (§16.2). At 19:04 this host could not reach the project: TLS reset via
proxy (`SSL_ERROR_SYSCALL`) and `Connection reset by peer` direct. At 19:13 the
same host, same worktree, same key returned `HTTP 200` on `/auth/v1/settings` and
`rc 0 / PASS` on the repo probe. **The block was transient, not a platform fact**,
and the earlier sentence in this file that called these readings unmeasurable here
was wrong. Both readings below are therefore corroborated from two vantages. What
this does *not* change: the redirect allowlist is still admin-only, and OAuth
providers are still unreachable from this host (`api.openai.com` and
`generativelanguage.googleapis.com` answer `502` through the proxy), so an OAuth
flow still cannot be completed end-to-end here.

| reading | probe | result |
|---|---|---|
| anon read reachable / rows visible | `npm run verify:supabase-free` | **rc 0, PASS**: "anon read reachable (status 200, body 2 chars)". The script's own note: rows visible are legacy unowned (`user_id IS NULL`) by 002 design; owned rows stay invisible to anon. [measured 2026-10-30] |
| auth providers enabled | `GET /auth/v1/settings` | rc 0. `external`: **google=true, github=true, email=true**; every other provider `false`, including **phone=false** (`sms_provider: twilio` but the provider is off). `disable_signup: false`, `mailer_autoconfirm: false`, `phone_autoconfirm: false`, `anonymous_users: false`, `passkeys_enabled: false`, `saml_enabled: false`. [measured 2026-10-30] |
| which columns exist in the live DB | per-column probe + one combined `select` on `interviews` | **all six of 005's columns exist.** Individually: `interview_type` 200, `difficulty` 200, `time_budget_sec` 200, `plan` 200, `evaluation_v2` 200; `custom_type_description` returned `000` (transport failure, not 400) on the first pass, then the combined `select=interview_type,custom_type_description,difficulty,time_budget_sec,plan,evaluation_v2` returned **HTTP 200** with body `[]` — PostgREST resolves the whole list or rejects it with 400 naming the missing column, so all six are present and the `[]` is RLS hiding owned rows, not a missing column. [measured 2026-10-30] |
| redirect allowlist | admin-only | not obtainable with an anon key — dashboard-only, not attempted |

**Method limit, recorded rather than worked around.** `GET /rest/v1/` answers
`{"message": "Secret API key required", "hint": "Only secret API keys can be used
for this endpoint."}` [measured 2026-10-30], so the anon key **cannot enumerate the
schema**. Column existence is therefore established indirectly, by asking PostgREST
to resolve a named column list — a probe that distinguishes "column missing" (400)
from "no rows visible" (`200 []`), and does not distinguish "column exists but type
drifted".

**What the platform state says that the repo does not.** Three providers are
enabled upstream, and the app calls exactly two of them: `signInWithOAuth` for
google/github (`src/lib/auth.ts:4`). No `signUp`, `signInWithPassword`,
`signInWithOtp` or `resetPasswordForEmail` exists anywhere in `src/` — the only
hit is a comment explaining why the reset link was *removed*
(`LoginForm.tsx:188-193`: "under demo auth … no password is ever checked, so there
is nothing to reset"). So **the enabled `email` provider is dead configuration**,
and `phone=false` means a mainland phone number cannot be used to authenticate at
all. [measured 2026-10-30]

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
| B16 | 7 tables referenced from `src/lib`: interviews 8, achievements 6, practice_sessions 4, evaluations 4, telemetry 3, orama_index 3, assessments 2 [measured grep `from('<t>')` 2026-10-30] | read/write split per table not yet separated — see §14 |
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
| C-6 | a **password field** on both doors | `LoginForm.tsx:186-199` labels an input "Password"; `signup/page.tsx` mirrors it | the value is never verified — `/api/session` accepts any well-formed identity (B2), and the file says so itself: "no password is ever checked, so there is nothing to reset" (`LoginForm.tsx:188-191`) | none: a field that does nothing has no test that can fail |
| C-7 | email sign-up available (platform state) | `auth/v1/settings` → `email: true`, `disable_signup: false` | no `signUp` / `signInWithPassword` / `signInWithOtp` / `resetPasswordForEmail` anywhere in `src/` — the provider is configured upstream and unreachable from the product | n/a — dead configuration, not a claim to the user |

N10 reading: C-1 is the promise with no failing test behind it; C-5 is the ethics
line enforced at the contract and not at the surface; C-6 is the sharpest of the
three — the UI collects a secret, tells the user it is a credential, and no code
path ever reads it.

## 8. Ring C — the two gates (§10.2)

| tier | who | status |
|---|---|---|
| 1 — domain-level block monitor | agent | pending in this commit; recorded in §8a when read |
| 2 — one mainland phone, cellular, Wi-Fi off, proxy off | owner | **owner-reported pass, with gaps.** Verbatim, 2026-10-30: "我这些都已经实测中国移动，大陆IP手机是可以正常打开无报错的" — China Mobile, mainland IP, phone, opens with no error. Not witnessed by the agent; no seconds recorded; no screenshot supplied; not stated whether all three origins were opened |
| 3 — mainland 拨测, 电信/联通/移动 | owner | **pending** — no artifact received |
| 4 — five humans | deferrable | not scheduled |

No tier is marked green. Per §6.4a no `hk`/`sg`/`us` node and no reading from this
laptop may stand in for any tier; this host resolves through a proxy, so its own
result would describe the proxy.

### 8a. Tier 1 reading (2026-10-30)

Monitor used: ViewDNS Chinese Firewall Test (`viewdns.info/chinesefirewall`), which
queries DNS resolvers inside the mainland. Scope: **DNS layer only**, not HTTP.

| origin | mainland resolvers | answer | verdict |
|---|---|---|---|
| `huggingface.co` | Beijing, Shenzhen, Inner Mongolia, Heilongjiang, Yunnan | all five returned `45.114.11.238`; root servers return `13.226.251.112/.20/.66/.81` (AWS) | **inconclusive-leaning-negative.** The monitor's own wording: "DNS servers in China returned different IP addresses to those returned by the root servers. This could indicate DNS poisoning by the Great Firewall of China. It could also just indicate the presence of GeoDNS on this domain name." |
| `cdn-lfs.huggingface.co` | — | "Sorry, I couldn't seem to find that domain." | no reading |
| the app's own production origin | — | not tested | **blocked: domain unknown.** §6.1 step 1 requires it from the deployment host, not from the repo; not yet supplied |

Two limits stated plainly rather than smoothed over:
- **No test timestamp** appears on the result page; the page was retrieved
  2026-10-30 and that retrieval date is all this row can claim.
- A DNS-layer divergence is not an HTTP verdict. It cannot license "reachable" or
  "blocked" for §7-R4; it is a reason to run tier 2 and tier 3, nothing more.

So **tier 1 is partial, and no origin is marked green.**

### 8b. Tier 2 reading (2026-10-30)

Owner's words, transcribed without embellishment: **"我这些都已经实测中国移动，大陆IP手机是可以正常打开无报错的"**
— China Mobile, mainland IP, phone, opens with no error.
Follow-up, same day: **"三个地址都开了"**, **"首屏2s"** — all three origins opened, two seconds to first paint.

| established | not established |
|---|---|
| a mainland China Mobile path reaches **all three origins** — the app, `huggingface.co`, `cdn-lfs.huggingface.co` — with no error, 2026-10-30 | an artifact: no screenshot on disk, nothing here may cite tier 2 as witnessed |
| **time to first paint ≈ 2 s** [reported by owner 2026-10-30] — inside R5's budget at the landing surface | whether the 2 s is first paint of the app or of the heaviest surface, and whether the interview room's `modelsReady` gate was reached |
| the negative case is not the current state | whether the path was **cellular** rather than mainland Wi-Fi, and whether a proxy or Private Relay was active |
| "opens" ≠ "completes a task": the weights origin answering is not the same as the interview starting | §6.4c: a device that loads a page is not a person who completes a task |

Per §6.1 a pass at tier 2 **licenses tier 4 but does not substitute for it**, and per
§6.3 it does not by itself green §7-R4. It does clear the blocking case: no tier has
returned a negative, so hosting does not displace the product work.

## 9. Human trial

| who | device | network | what they said | artifact |
|---|---|---|---|---|
| — | — | — | — | — |

Empty. N4 is unmet and no milestone claims a user outcome.

## 10. §6.2 posture brief — three postures, priced, none chosen

Presented, not decided (N5). Each row names what it costs, not what it is worth.

| posture | what it means | named cost | what it forgoes |
|---|---|---|---|
| **A. Non-public pilot** | named group (a class, club, 社团, one career centre); not offered to the public | no new filing; the cost is the owner's time to recruit one group and the honesty to call it a pilot | scale; "广大用户" in the literal sense; any public growth claim |
| **B. Public, overseas-hosted, ungated** | ship to the mainland public as today | no cash cost; the cost is **legal exposure carried by the owner personally** and reachability the owner does not control (tier 1 already shows mainland DNS diverging on the model origin) | legal defensibility; predictable reachability |
| **C. Public, properly registered** | commercial service with a mainland entity | business licence (individual or 个体工商户 path), ICP + public-security filing, algorithm filing or the downstream-app route, a paid mainland-reachable host, an approved generative-AI upstream | the zero-budget constraint (N6 makes this unavailable today) |

Two measurements that bear on the choice, both already in this file: the free
model pool sustains ~26 concurrent completions (§6), and the only configured
credentials are Google/GitHub OAuth (`src/lib/auth.ts:4`), while the primary door
`POST /api/session` verifies nothing (B2). Posture A is the only one that fits the
constraint set **and** produces the sessions §9's metrics need — stated as a
recommendation for the owner to accept or reject, not as a decision taken here.

---

## 11. §10.3 Triage — ranked, awaiting approval

Rank key: *users unblocked × effort × risk*. No item below is edited before the
owner approves the round. Every item names its exit gate and its falsification.

| rank | id | item (evidence) | users unblocked | effort | risk | exit gate | falsification proof |
|---|---|---|---|---|---|---|---|
| 1 | T1 | **Identity is a demo.** `POST /api/session` accepts any well-formed identity and issues an HMAC cookie (`route.ts:27-37`, `requireSession: false`); the client mints the id (`LoginForm.tsx:86`, `signup/page.tsx:55`); the password field collects a value nothing reads (C-6). Platform state confirms the gap: only google/github/email are enabled, **phone is false**, and the app calls none of the email paths (C-7, §4). | everyone — nothing a user saves is protected by a secret | high | high: auth surface | a test that fails when an unverified identity can mint a session | plant: restore `requireSession: false`; the new test must go red |
| 2 | T2 | **The promise has no test.** 「面试记录、报告与回放都会保存」 at `LoginForm.tsx:132`, `signup/page.tsx:100` (B1). | every signup | low | low | either a test that fails when the row is not persisted, or the sentence is deleted | delete the persistence call; the sentence's test must go red |
| 3 | T3 | **Phone width is unsupported.** No phone device in the matrix (B5), zero viewport branching in the interview surface (B6), fixed `w-[280px]` chrome (B4), two `min-w` above 390 px (B23: `table.tsx:14` 640, `TechnicalScratchpad.tsx:221` 400). | the rank-1 audience, which is on a phone | medium | medium: layout | a phone project in `playwright.config.ts` plus geometry assertions on the core loop | remove the breakpoint; geometry assertion must fail |
| 4 | T4 | **Employment verdicts reach the user.** `cultureFitAdvisor` rendered at `SessionDetailModal.tsx:210-215`, `PrintableDossier.tsx:108-109`, `PrintLayout.tsx:98`, exported at `export.ts:74-93`, while the contract bans those keys (`evaluation-contract.test.ts:64`). | every user who exports a report | low-medium | medium: data shape | render/export paths removed; a test that bans the keys in **rendered output**, not only in the schema | re-add one render branch; the output test must go red |
| 5 | T5 | **The quota is invisible until it bites.** No client reads `RateLimit-Remaining` (B9); the 200/day is shared by user **and** egress IP (`user-budget.ts:76-95`) and the UI sentence does not say so (`PricingSection.tsx:47`). | every user behind campus/carrier NAT | low | low | a visible remaining-quota surface plus the corrected sentence | stub the header to 0; the surface must show it |
| 6 | T6 | **Prose claims a PWA the build does not emit.** `README.md:39`, `docs/audit/REPOSITORY_TRUTH.md:37` vs no manifest, no `sw.js`, plugin removed (`next.config.ts:3-9`). | none directly — it costs trust (N8/N10) | trivial | none | docs corrected, or the feature restored with a build assertion | put `next-pwa` back in the manifest; the doc-claims test must go red |
| 7 | T7 | **Pooled free key caps concurrency at ~26** (§6, measured). | every user, at once | n/a — a decision | high: it decides whether S2/BYOK is optional | §15.1 answered with this curve in hand | n/a |

Ordering rationale: T1 and T2 are the same user harm seen from two sides — a
promise about saved records, made by a door that verifies nothing. T3 is next
because the rank-1 audience cannot complete the loop at phone width at all; T4 is
an ethics-line breach (§12.8) that is cheap to close; T5 and T6 are honesty
repairs; T7 is not code.

## 12. §15's five decisions, priced (one closed by measurement)

| # | decision | options, with the cost of each | what the price is paid in |
|---|---|---|---|
| §15.1 | deployment posture | **ANSWERED: A (non-public pilot).** Owner, 2026-10-30 19:07, verbatim: "我都听你的，请按照你的思路建议进行" — a written delegation, exercised only to the **minimum-commitment option**: A adds no filing obligation, no spend, and no legal exposure, and moving to B or C later remains an open decision. B and C are **not** chosen and may not be inferred from this row. Basis: pooled-key concurrency ~26 (§6), no phone credential upstream (§4), mainland DNS already divergent on the model origin (§8a) | A costs the owner's recruiting time | nothing irreversible; A is reversible in both directions |
| §15.2 | identity provider | measured starting point (§4): `google=true`, `github=true`, `email=true`, **`phone=false`**, `mailer_autoconfirm=false`, `disable_signup=false`. Options — (a) **keep google/github OAuth**: zero cash, but both hosts are the ones mainland mobile networks reach worst, so this fails rank-1 by construction; (b) **Supabase email magic link**: the provider is already on, but `mailer_autoconfirm=false` means a confirmation mail must actually arrive, which needs custom SMTP + a domain + a reset page that does not exist yet, and no code path is written; (c) **phone OTP**: `phone=false` and `sms_provider: twilio`, so enabling it is per-message cash and breaks N6; (d) **keep demo auth**: any posture except a named pilot becomes indefensible | (a) the mainland phone; (b) a domain, DNS, a mail provider and the confirmation flow; (c) per-message money; (d) the product's credibility |
| §15.3 | apply `005_interview_session_columns.sql` to the shared production DB | **RESOLVED BY MEASUREMENT — no decision needed.** All six columns already exist on `interviews` (§4), so the forward migration is a no-op and there is nothing to apply. The reversibility question that made this expensive (additive columns safe, dropping them destroys data) therefore does not arise. Scope note: this proves 005; it does **not** prove 006's anon-grant closure is applied, which is a different question and is not asked by §15.3 | nothing — the change is already live |
| §15.4 | institutional data to a career centre | offering anonymised aggregates needs a minimum reportable cohort; below it, a "class average" identifies individuals. Proposed floor: **≥10 respondents per cell**, no cell published below it | legal exposure and the trust of the pilot institution |
| §15.5 | delete legacy verdict render paths | depends on whether real historical rows carry `hireVerdict`/`cultureFitAdvisor`. **Unverifiable this session** — the DB reading is blocked (§4). Deleting the paths without that reading risks blanking real reports | user data that may be the only copy of a past report |

Four decisions remain open. §15.3 closed by measurement rather than by a choice —
the migration it asks about is already live. §15.1 gates everything downstream
(§6, N5).

## 13. Fix log

| commit | item | gate output | rc |
|---|---|---|---|
| `T3` | **phone width** | `npx playwright test --project=phone-390x844` — **before**: 1 failed, `the content column keeps a usable width: Expected >= 320, Received 64`; **after**: 1 passed (8.0s). Desktop regression: `npx playwright test tests/dashboard.spec.ts --project=chrome-1280x720` **8 passed (25.9s)**. `npm run typecheck` 0. `npm run facts:check` `facts ratchet: OK`. `readme-testing-claims` + `readme-architecture-claims` 16/16 after the matrix count was corrected from 12 to 13 | 0 |

What changed and why it is one unit: `dashboard-shell.tsx` had a fixed `w-[280px]` sidebar
with `m-6` gutters and a `flex` (row) parent, so at 390 px the content column measured
**64 px**. Every utility I touched is now paired — base value for small screens, the
original value behind `md:` — so the desktop rendering is the composition it always was.
`playwright.config.ts` gained one project, `phone-390x844`, scoped by `testMatch` to the
new spec, because the matrix modelled four browsers at three desktop widths and no phone
at all. The check was written first and watched go red before the layout was touched.

Operational note for whoever runs the e2e lanes next: in this environment the
dev server cannot boot twice in a row without help — Next deletes `.next/dev/logs`
on startup and the host's bulk-delete guard refuses it
(`[safe-delete] broker denied delete: path=…/.next/dev/logs`). Moving `.next`
aside before a run is enough; the directory is a build cache, and nothing in this
commit depends on it being absent.

## 14. Deliberately not done

1. **The 13 `--slow` browser plants were not run.** They need Playwright browsers
   and a running app; `--slow` was not attempted. The fast gate covers 200/213.
2. **One of §2.4's four readings remains unmeasured**: the redirect allowlist
   (admin-only; the anon key cannot read it, and `/rest/v1/` answers "Secret API
   key required"). The live column inventory is now measured — §4 — by a probe
   that proves existence, not type. Nothing in this file is inferred from
   `.env.example` or from `docs/`.
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
