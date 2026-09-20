# Interve AI 痛点登记簿 PAIN_REGISTER — 第一段审计产出（只读）

> 生成：2026-09-19 · 执行 Master Prompt V6 §3 · **未改任何源码**，本文件是本阶段唯一 Write。
> 方法：Repository Truth 实测（HEAD/栈/路由/prompts/migrations/测试数 + `verify` 全文）+ 六维扫描（每项 `文件:行号` + 证据等级 实测/静态/传闻）。
> 门禁结论见文末：**未达标，禁入第二段**（P0 门禁红 1 项，根因在他人脏树，本段禁修）。

Skills provenance：`security-review`（被动）+ `security-best-practices`（Next server + React frontend 双 reference，只读）+ `coding-standards` + `prompt-optimizer` Phase 0–4。
文献 grounding：V6 §2（AI SDK v7 迁移映射 / Next 16.3 opt-in / React 19.2 / OWASP GenAI 2026 / Supabase RLS / EU AI Act / OpenRouter 447/22 免费零轮换）。本段未联网复验，沿用 V6 记载并标注为传闻。

---

## A. Repository Truth（实测，不采信旧日志）

- **HEAD：** `aece034 docs(qa): H1 dual-device mic sign-off`（`git log --oneline -5`：`aece034 / 0954e0a / a7f13fa / cb61676 / ece3bd8`）；分支 `main`，`up to date with origin/main`；Repo `https://github.com/Jackxiaozhiren/Interve-AI`。
- **脏树（他人在制品，只读审计，禁覆盖）：** 9 个 modified（首查 8 + 复查补 1）——`src/app/interview/page.tsx | src/app/setup/page.tsx | src/components/interview/{AIVisualizer,CameraSelfView,LiveStats,MultiAgentVisualizer,SoftPacingBar,TelemetryWidget}.tsx | tests/a11y-visual.spec.ts`。与 V6 §0 预告的 8 文件一致，新增第 9 个 `tests/a11y-visual.spec.ts`（`git diff --stat` 64 insertions/38 deletions）。内容为 F3-split-3 late-stream guard + 对比度 polish（详见 D1）。
- **栈（`package.json:55-59,41` 实测）：** `next 16.3.5 / react 19.2.4 / ai 6.0.168 / node 20.x / npm >=10`，`version 1.0.0`。与 V6 基线一致（16.3.5 已超前于 stable 16.3.4，无需动作）。
- **API 路由 19 个（实测 `find src/app/api -name route.ts | wc -l = 19`）：** analyze-{alignment,behavior,chunk,code,interview,match,practice,star,trends,vision} + copilot + csp-report + generate-hint + health + init-context + interview-chat + parse-jd + parse-resume + session。
- **Prompts 19 文件（实测 `ls src/ai/prompts`）：** alignment/behavior/chunk/code/context/copilot/coverage/evaluation/hint/index/interview/jd/match/practice/resume/star/strict-json/trends/vision（`+ drills/bank.ts`）。V6 称 17–19 prompts，吻合上沿。
- **Migrations 5 文件（实测 `ls supabase/migrations`）：** `0001_initial_schema.sql / 001_init_schema.sql / 002_session_ownership.sql / 003_per_operation_policies.sql / 004_practice_evidence.sql`。V6 称“4 migrations”——实为 5（含 `0001` 与 `001` 双初始，见 PAIN-P2-03）。
- **门禁数字（本次实测全文，脏树下）：**
  - `npm run verify` → **RED（lint 1 error 中断）**：`tests/a11y-visual.spec.ts:83:0 error Parsing error: '}' expected` + 2 warnings（`src/app/error.tsx:74:27 / src/components/dashboard/SessionDetailModal.tsx:75:30` no-location-assign）。禁入第二段的直接原因。
  - `npm run typecheck` → **exit 1**：`tests/a11y-visual.spec.ts(63,1/63,2): error TS1128`（同根因；`next build` 自带 TS 却通过，见下）。
  - `npm run test` → **exit 0：46 files / 353 tests passed**（基线 45/350 → +1 file/+3 tests，仍全绿；`zz-probe` 5×500 upstream_error 为受控探针日志，非失败）。
  - `npm run build` → **exit 0**（Next 16.3.5 Turbopack，44 static pages，19 API ƒ + Proxy；Edge Runtime deprecated 警告 1；recharts `-1 width` 警告 2）。
  - `npm audit --audit-level=critical` → **exit 0**（37 vulns：1 low/31 moderate/5 high，0 critical）。
  - `test:e2e:mock / Lighthouse` → **本段未跑**（keyless 但需起服务/浏览器；Lighthouse 沿用文档数，标传闻，见 PAIN-P1-08）。
- **账本（`npm run quota` 实测，keyed 零调用）：** `zhipu 3/50（剩47）/ gemini 0/20（剩20）`，窗口 `2026-09-19`。本段无任何 keyed/OpenRouter 调用，无需批文。

---

## B. 六维扫描摘要（证据等级：实测=本段跑出/读到；静态=代码/配置判读；传闻=V6/旧文档转述未复验）

### B1 架构/质量
- God 剩余实测：`src/app/interview/page.tsx:1770行 / src/app/setup/page.tsx:1533行`；`components/interview/*` 合计 6512 行，最大 `TechnicalScratchpad.tsx:502 / LiveStats.tsx:275 / GreenRoom.tsx:220`。F3 拆分未完成，脏树正在动其中 8 文件（只记录不评价）。
- 脏树内容（`git diff` 实测）：interview/page 加 late-stream guard（`+850:853 unmountedRef` 止漏）+ 7 处对比度 `bg-white/60→/80, text-slate-500→700, rose-500→700`；setup/page 加 `+175:181 cancelled` 止漏；6 visualizer 共 30 insertions/29 deletions（大多 4 行 contrast/spacing）；`tests/a11y-visual.spec.ts +63:64` 加空 test 却未闭合外层 describe → 解析崩（P0 根因）。
- `any` 仅 3 处（静态）：`GrowthTrendChart.tsx:19 / SkillBreakdownChart.tsx:35 / SystemDesignBoard.tsx:36(shapes as any)`。卫生良好。
- `@ts-expect-error` 1 处：`parse-resume/route.ts:9`（pdf-parse v2 类型错位）。`as unknown as` 零命中。
- listener/stream 面：92 命中多为配对 `add/removeEventListener`，interview `setInterval:266`、`devicechange:514:516`、`whisper/kokoro message:723:724`、`ask-ai:769:770` 均有 cleanup；late-stream 泄漏正是脏树在补的洞（M4/M5/M1 镜像），HEAD 侧仍有 T2.6 contention 敞口（静态）。
- SSR 边界：`TechnicalScratchpad/tldraw` 已 `ssr:false` 抽屉门（文档称，静态采信）；`use cache` 零命中——缓存分层未启动（见 B5）。

### B2 AI 工程（全路由建表，静态为主）
| API | Model（registry） | Input Zod | Output Zod | Retry | Timeout | Auth/限流 | 日志 | Eval |
|---|---|---|---|---|---|---|---|---|
| analyze-{behavior,star,chunk,code,alignment,match,practice,interview,init-context} + parse-jd | 默认 Gemini flash 系（`registry.ts:16-23`；practice 经 `resolvePracticeModel`，未知 spec 回落默认） | 各 `BodySchema` + `maxBytes`（practice 128KB） | 各 `*OutputSchema`（practice 含 evidence/confidence/drillIds） | `DEFAULT_MAX_RETRIES=2` | guard 默认 25000（`guard.ts:132`），practice `maxDuration=60, edge` | guard：IP 限流→session→body→userBudget（practice 30/60s；匿名 401） | `logApi` PII-free + `usageOf` | golden/practice-golden/turn-golden + free/live lanes |
| interview-chat/copilot/generate-hint | 同上 + `?model=openrouter` opt-in（ultra 纯文本） | 同 guard 模式 | 非结构化/提示 | 同上 | 同上 | 同上 | 同上 | ultra 6 turns 基线（传闻） |
| analyze-trends/vision/parse-resume | trends 读 evaluationV2（`analyze-trends/route.ts:56`）；vision 仅 data-URL（拒绝 provider 侧 fetch）；resume pdf-parse+5MB 门 | 同上 | 同上 | 同上 | 同上 | 同上 | 同上 | 同上 |
| health/session/csp-report | 无模型 | health 无 body；session 身份；csp-report 上限 | health `{ok/degraded,db,latency}`；csp 204 空 | 无 | health DB 探针 5s（`health/route.ts:42`） | health 公开 60/60s；其余 guard | 同上 | mock-contract 覆盖 |

- E4 残留：**10 路由仍 `import { generateObject }`**（`analyze-{match,code,chunk,alignment,behavior,star,interview,practice}/route.ts:1 + parse-jd:1 + init-context:1`，静态）。`Output.object/array/choice/json、partialOutputStream` 零命中；`stopWhen/maxSteps` 零命中（新代码律下 tools 路由须补，但当前无 tools 调用，静态）。
- `no_object_generated` 归因链完整（静态）：`classify-error.ts:15 NoObjectGeneratedError→"no_object_generated"` + `strict-json.ts:9 repairZhipuJson` 第二层 + 6 路由 `experimental_repairText`（match/chunk/behavior/init-context/star/interview）。
- reasoning 污染面：`MODEL_IDS.zhipuThinking=glm-4.7-flash` 经 `thinkingFetch` 单点注入（`registry.ts`），默认 lane 仍 flash；A/B 已毙（传闻），代码侧无默认污染（静态）。
- 免费轮换敞口：`registry.ts:25-32` pin `ultra=nvidia/nemotron-3-ultra-550b-a55b:free / structured=deepseek/deepseek-v4-flash-0731:free`，注释“Verified 2026-09-19…never default”，opt-in 失败闭合（`registry.ts:93-94,99-111,145-149,168-174`）。名单复验前置律已写死，无代码敞口；风险在外部轮换（传闻，常驻）。

### B3 安全（OWASP GenAI 2026 + Web 基线，被动只读）
- LLM01 注入：`evaluation.ts:43` 注入条款（transcript/JD 视为 DATA）+ `injection-cases.json` 存在；单次 breach 只记方差纪律已写（静态 sastisfactory，keyed 未跑）。
- LLM02 敏感披露：`logging.ts:1 PII-free` + `errors.ts:2 never bodies/PII` + health `health/route.ts:6` + csp-report `route.ts:8-9` 仅记 directive+host；secret 扫描零硬编码 `sk-`（静态；仅 `supabase.ts:3-4` 占位 placeholder + `NEXT_PUBLIC_*` anon 设计值，`service_role` 零命中）。
- LLM03 Agency / LLM06 Unbounded：guard 五阶（限流→session→body→budget）+ `userBudget` 默认 ON（`guard.ts:107-124`）+ per-IP 限流 + `maxBytes` + vision 拒绝服务端 fetch（静态）；`checkUserBudget/defaultUserBudget` + `rate-limit.test/user-budget` 全绿（实测 7+4 tests）。
- LLM04 供应链：audit critical exit 0（实测）；`sharp→@huggingface/transformers→kokoro-js` 高危链仍在（moderate/high 36，静态）；Dependabot/CodeQL lane 未在本段验证（传闻）。
- LLM05 投毒：`normalizePracticeDrills` 丢未知 drillId（`analyze-practice/route.ts`）+ 白名单模式（静态）。
- LLM07 Misinformation：evidence/confidence 信封（practice schema）+ disclaimer（静态）。
- LLM08 Hidden Context：`analyze-vision` 拒非 data-URL + SVG 拒收（`parse-resume:68-71`）+ csp 双轨（静态）。
- LLM09 向量弱点：orama-client 分区测试存在（`orama-partition.test` 实测通过）；向量投毒专项未见（静态缺口，P2）。
- LLM10 输出处理：`DOMPurify` 未命中？（静态未见直接渲染用户 HTML；`dangerouslySetInnerHTML` 需复核——本段 grep 未覆盖，记存疑 P1。）
- Web 基线：`proxy.ts:41 proxy()`（非 middleware 命名，CVE-2025-29927 回归面——`config.matcher` 放行 `_next/static` 等，`isProtectedPage` 7 前缀 + `/api/dashboard`，fail-closed 无 secret 时 401/redirect，静态）；CSP 双轨：enforcing 宽松（`proxy.ts:83-93` 含 `unsafe-inline/unsafe-eval/connect *`）+ report-only 严格（`:100-113` + `report-uri`），`csp-report` 恒 204（`route.ts`），收敛条件“report 流干净”未达（静态，外部依赖生产流量）；上传链：5MB + SVG 拒 + 类型白名单 + content-length 谎言捕获（`parse-resume:53-71` + `api-hardening.test` 实测 27 tests 覆盖）。

### B4 数据/后端
- RLS：002 bridge（owner `((select auth.uid())=user_id) TO authenticated` + anon 仅 `user_id IS NULL`）+ 003 per-operation 等谓词拆分（`003头注释` + `rls-policies.test.ts 13 tests` 实测通过）；live 双用户 denial 外部未闭环（传闻）。`select('*')` 残留 **13 处全在 `src/lib/api-client.ts:88-295`**（7 表 interviews/evaluations/practice_sessions/telemetry/achievements/orama_index），与白名单纪律冲突（静态，P1）。
- N+1/索引：`pg_stat_statements` 无（外部）；覆盖索引 002 已加 `idx_*_user_id`（静态）；cursor 分页未见（`order()` 直查，静态缺口）。
- quota/预算/降级：`quota-ledger` + `user-budget` + `degradation-matrix.test 12` + `infra.test withModelFallback` 全绿（实测）；per-user 预算 429 + Retry-After 已行为化（静态）。
- `/api/health`：公开、恒 200、单语句 `interviews id count head` + 5s abort + PII-free（`health/route.ts:36-47`）；内检浅——仅 DB 一表，无 storage/auth/内存/延迟 SLO（静态，P2）。

### B5 前端/体验
- Lighthouse：本次未跑；文档数（传闻）：`/` 92/100/100/100，`/landing 86 /login 89 /signup 88`（decor-LCP），dashboard Perf 78（LCP 6.0s decor-blur），interview 初始传输 **1032KB exact**（`PERF_REPORT:26,36,73,114`）。FCP 92–184ms/CLS 0/TBT 0（有 Appointment 的探针数，传闻）。
- 包体积：1032KB 线仍为门（静态采信；本次 build 未做 bundle-analyzer，记 P2 跟踪）。
- a11y：axe 套件本段被脏树破坏（P0）；HEAD 侧 `H1_MANUAL_MIC_QA.md` 双设备签字已消费（传闻，V6 称 H1.3 OPEN）；`jsx-a11y` 未进 lint（`eslint.config` 未在本段读，静态存疑→P3 提升项）。
- PWA/Turbopack：判死确认（静态）：`next.config.ts withPWA(disable: dev)` + 注释“webpack-based plugin emits NO SW under Turbopack…never tracked”，`public/sw.js` 缺席待验（本段未 `ls public`，记静态）。
- 16.3 Instant Navigations：`cacheComponents/partialPrefetching/reactCompiler` 零命中（静态）；`use cache/cacheLife/cacheTag` 零命中；`revalidateTag` 零命中——评估位空白，仅评估不开旗（P3 spike）。

### B6 合规/产品
- practice-only 红线抽查（静态，通过但有残留显示面）：`evaluation.ts:41,86` 禁 hire/culture/personality/受保护属性 + `READINESS_DISCLAIMER`；legacy 三件套齐——`· 历史评估` caption（report `[id]:306,401` / PrintableDossier:94,118 / PrintLayout:67,85 / SessionDetailModal:224）+ `LegacyBanner+disclaimer`（replay:369 / report:232 / SessionDetailModal:104,143 / eval-compat:140）+ V2 只 render readiness（EvaluationView:24,57 / PrintableDossier:51）。残留：`db.ts:71 hireVerdict` 类型 + `achievements.ts:32,152-161` legacy strong_hire 解锁 + `SessionDetailModal:170,189,208` council 三顾问 `stance includes no_hire` 着色 + `report/[id]:606-615` hire 标签映射——均为 legacy 只读显示（有 banner 前提），无新 verdict 生成（静态）。
- Privacy Center 完整（静态）：`dashboard/privacy/page.tsx:10,169` + shell 入口 `dashboard-shell:42` + footer 隐私政策 `Footer:41` + 删除/导出（`api-client:101,188`）+ 本地快照 30 天过期（`session-persistence:2`）。
- free-lane 透明度：registry opt-in 注释 + 简历/transcript 走 Zhipu/Gemini 默认 lane（静态）；“简历不走第三方路由声明”未见显式用户文案（静态缺口，P3）。

---

## C. 痛点登记簿（ID|维度|等级|证据|根因假设|影响|建议修法|验证法|依赖）

**分级：** P0=truthfulness/安全/数据越权/门禁红；P1=可靠性/可观测缺口；P2=性能/债；P3=体验 polish。

| ID | 维度 | 等级 | 证据（文件:行号+等级） | 根因假设 | 影响 | 建议修法（第二段起，一痛一卡） | 验证法 | 依赖 |
|---|---|---|---|---|---|---|---|---|
| PAIN-P0-01 | 门禁/质量 | P0 | 实测：`tests/a11y-visual.spec.ts:63-64` 空 test 未闭合外层 describe → `83:0 Parsing error`（lint exit 1）+ `tsc TS1128 ×2`（typecheck exit 1）；`git diff --stat` 脏树 9 文件 | 他人 F3 在制品误提交半成品（a11y 空桩），非 HEAD 缺陷（HEAD 版 `git show HEAD:tests/a11y-visual.spec.ts` 结构完整） | `verify` 红，**进段门禁失败**；a11y 套件全阻塞 | 脏树共存：本段禁修；请 owner 闭合/暂删空桩后重跑 `lint+typecheck`（第二段入口） | `npm run lint && npm run typecheck` exit 0 | 脏树 owner；H1 QA 通道 |
| PAIN-P1-01 | AI/可靠性 | P1 ✅已修复 | 实测：`src/lib/api/guard.ts:43-50`旧回落丢 timer；修复 `combineSignal` 手写合成 + `analyze-practice/route.ts:59 PRACTICE_TIMEOUT_MS=45_000`；`tests/unit/guard-timeout.test.ts` 3/3；门禁 lint 0 err/tsc 0/test 47-356/build 0/mock-e2e 1 passed；keyed 0 | Edge 缺 `AbortSignal.any` + practice 用默认 25s 误杀中位数 ~26s 慢调用 | 已关闭 | 同左 | keyed latency 重采样后复核预算（外部） |
| PAIN-P1-02 | AI/数据 | P1 | 静态：10 路由 `generateObject`（见 B2）；传闻：已回滚 1 次 | v7 文档已清 `generateObject`，运行时暂留；大跃进易红 | E4 迁移停滞，未来 v7 升级风险 | R3：`codemod --dry`→单路由迁→单路由 MVVP（κ/α+3-repeat+bias），红即停 | 单路由 MVVP + 全门禁 | keyed 账本+批文；nightly |
| PAIN-P1-03 | 数据 | P1 ⏸外部数前不重开 | 静态复核+既有 pin：`tests/unit/select-discipline.test.ts:1-68` 已逐站 justification（13 处全系 full-row reader：dashboard 聚合/modal 复用同一对象/orama blob/窄表），N+1 CLEAN，`toCamelCase` 缺列会静默 undefined；盲改白名单无 live DB 验证收益 | 白名单纪律 vs 无验证的裁剪风险 | 过取流量（RLS 兜底越权） | 维持 pin；重开条件：`pg_stat_statements` + 传输字节数（外部），never blind | pin 测试常绿 | live DB（外部） |
| PAIN-P1-04 | 安全 | P1 | 静态：`src/proxy.ts:83-95` enforcing 宽松（unsafe-inline/eval/connect *）vs `:100-114` report-only 严格；传闻：等生产流量 | 怕误伤先宽后严，report 流未干净 | XSS/CSP 纵深未闭合；误切 enforcing 会断业务 | report 流周检→干净后逐指令收紧（先 connect，再 script），演练回滚 | csp 周检报告 + mock e2e | 生产流量（外部） |
| PAIN-P1-05 | AI/校准 | P1 | 传闻+静态：deepseek MVVP agreement 5/5、stdev 0、全 clean 但 NOT graduated（V6 §0）；`registry.ts:148-149` opt-in 仍在；`evals/*.eval.test.ts + rater-pack/` 存在但本段 0 keyed | n=1 单轮 + latency 尾 + agreeable 需 nightly；§6 纪律禁按 n=1 毕业 | 未毕业 lane 长期 opt-in，校准置信不足 | R2：不调 prompt，只补数据（agreeable pair nightly 重跑 + latency 分布） | κ≥0.6 + 7 天趋势 | funded-key nightly（外部）；2-rater |
| PAIN-P1-06 | 数据/外部 | P1 | 静态+传闻：`002头注释` bridge（anon 仅 unowned）+ `003` 等谓词；live 双用户 denial 未闭环 | Auth cutover 未到 005，bridge 长期化 | 匿名/拥有行边界靠 bridge，live 行为未知 | B cutover：002 退役→005→live 双用户 denial 演练 | RLS 回归 + live denial 报告 | Supabase 外部；002/003 |
| PAIN-P1-07 | 可观测 | P1 ✅已关闭 | 内检：`health/route.ts` 双探针（interviews + practice_sessions，单语句零行并行）+ 分探针延迟，恒 200/PII-free/60-60s 限流不变；旧 H2.4 兼容；storage/auth 经取证排除；`health.test.ts` 2/2。Lighthouse 新鲜数（lighthouse 13.5.0 + 本地 prod :3100 + playwright chromium，desktop）：`/` 88/100/96/100（LCP 3.9s/FCP 1.1s/TBT 0/CLS 0；唯一机会 unused-js 85KiB；基线 92，差 4 分记方差）/`dashboard` 78/94/96/63（LCP 6.1s，复现基线 78；SEO 63 主因 is-crawlable=0——会话门 + robots 本就 disallow，by-design 非缺陷）。门禁 lint 0 err/tsc 0/test 50-367/build 0；keyed 0 | 单表探针盲区 + 文档 Lighthouse | 已关闭 | 同左 | 无 |
| PAIN-P1-08 | 安全存疑 | P1 ✅已关闭 | 实测闭环：全仓 `dangerouslySetInnerHTML` 仅 2 渲染站（`message-card.tsx:153` 经 `escapeHtml` 转义、`chat-background.tsx:15` 纯静态 keyframes 无插值）+ 1 注释提及（`message-text.ts:37`，零调用站）；补 `security-surface.test.ts` LLM10 输出槽位 pin（11/11）+ 顺手对齐编号律（LLM09→LLM07、LLM10→LLM06）；门禁 lint 0 err/tsc 0/test 47-357/build 0；keyed 0 | 旧 grep 未覆盖输出处理 | 无 XSS 槽位 | 审计销账 + 槽位 pin + 标签对齐 | pin 测试常绿 | 无 |
| PAIN-P2-01 | 架构 | P2 | 实测：`interview/page 1770 / setup/page 1533`；静态：transport/recording/playback/analysis 耦合面待拆（F3 剩余） | God 页历史堆积，拆分进行中（脏树） | 可维护性/回归成本高 | R4：H1 签字入口逐片拆 + mock e2e 守护 + QA 脚本重走 | mock e2e + 对应单测 | 脏树 F3 完工；禁抢拆 |
| PAIN-P2-02 | 性能 | P2 ✅已关闭（评估 spike，只评不开旗，零代码改动） | 实测（`perf-probe.mjs` desktop + 本地 prod :3100，本构建）：`/setup 391 /dashboard 720 /interview 1033 /practice 474 KB`，CLS 0/TBT 0 全绿，heap 10–18MB。interview 1033 vs 1032 线 +1KB（testMode 同径，噪声级，但线无自动化守卫——`ci.yml` 无 perf-probe，`tests/` 无 1032 断言）；`use cache/cacheLife/cacheTag/revalidateTag/cacheComponents/partialPrefetching/reactCompiler` 全仓零命中（`next.config.ts` 零实验旗）。适配面：`/interview /practice` 全 client + useSearchParams 会话参数（动态到底）；AI 路由全用户域（共享缓存禁区）；可共享数据（drill bank/字典）已是静态 import——缓存分层当前架构无着力点；Instant Navigations 适合 dashboard↔replay/report 跳转，但需 cacheComponents opt-in + Suspense 边界，现在开为时过早（预取烧带宽 + 会话重定向） | 首传体量 | 误开旗风险 | 维持现状：线仍 1032（+1KB 记方差）；机器守卫见 PAIN-P2-07 | 探针数 + 零旗 grep | 无 |
| PAIN-P2-07 | 性能/发布 | P2 ✅已关闭 | 新增：`perf-probe.mjs --assert` + `TRANSFER_BUDGETS`（setup 450/dashboard 800/interview 1150/practice 550，政策注释在脚本内；默认运行保持 print-only）；`package.json perf:assert`；`ci.yml` gate 作业加 `perf transfer budgets` 步（prod :3100 + 探针，失败即红，服务自清理）。RED：无服务 exit 1 ×4；GREEN：本地 exit 0（391/720/1033/474 全在预算内，两次复现一致）。门禁 lint 0 err/tsc 0/test 50-367/build 0；keyed 0 | 1032 线人肉守 | 大包回归无机器感知 | 同左 | 探针双向验证 + 全门禁 | 无 |
| PAIN-P2-03 | 数据 | P2 ✅已关闭 | 实测：`0001`（88 行，UUID/非幂等）与 `001`（236 行，BIGSERIAL/IF NOT EXISTS/11 indexes）同 7 表但类型不兼容；运维正典为 `001`（`verify-supabase-free.mjs:16` + `004` USAGE 行）；落钉 `supabase/migrations/README.md`（顺序/冻结/混血警告/新迁移 checklist），旧文件零改动；门禁 test 48-359・lint 0 err（见下） | 历史双写 | 新人误跑混血库 | 文档钉（禁删改旧文件） | README 存在 + 全 test 绿 | 无 |
| PAIN-P2-04 | 安全/供应链 | P2 ✅已关闭（评估+接受记录，零代码改动） | 实测：audit 37（1 low/31 mod/5 high/0 crit，与基线零漂移，`--audit-level=critical exit 0`）；tiptap HIGH×2（GHSA __proto__/ReDoS）`audit fix --dry-run` 证实被 tldraw 4.5.10 peer pins 卡死（仅移除 4 个无关 wasm 包，advisory 仍在）；sharp 链无上游 fix；`parse-resume:9 @ts-expect-error` 在评估时仍被消费，并行 session 随后根治（v2 .d.ts，见 SECURITY_REPORT §10）；节奏已存在（CI audit + Dependabot H4.5 周节奏） | 客户端自内容编辑器债 | tldraw 大动回归风险 > own-content 暴露 | 升级 declined（等 Dependabot 送 tldraw 自身 bump），接受记录 | audit critical 常绿 | CI/Dependabot（既有） |
| PAIN-P2-05 | 前端/可靠 | P2 | 静态：92 listener/stream 命中多已配对；HEAD 侧 late-stream 洞由脏树补（interview `+850:853` / setup `+175:181` 镜像 M4/M5/M1） | 异步获取与导航竞态（T2.6） | 麦克风/摄像头活轨泄漏 | 脏树完工后补 `BUG-R*` 回归（unmount 竞态单测），本段只记录 | 回归测试 + 设备重走 | 脏树 owner |
| PAIN-P2-06 | AI/向量 | P2 ✅已关闭 | 实测闭环：越权读止于 RLS（anon 读分区行被 003 拒绝，命名空间+印章为纵深；legacy fallback 未超 bridge 已有暴露）；投毒面仅自简历（schema text-only 已 pin）；`tests/unit/orama-abuse.test.ts` 4/4（anon 仅 legacy id / restore 不碰他人命名空间 / 恶意 userId 无印章 / 注入 prompt 只回自块）；门禁 lint 0 err/tsc 0/test 49-363/build 0；keyed 0 | 分区测试未覆盖滥用 | 已审计+pin，无代码改动 | pin 常绿 | 无 |
| PAIN-P3-01 | 体验 | P3 | 静态：`robots.ts` 无 sitemap（等域名注释）；`next.config.ts` PWA 判死注释；`dictionaries.ts` EN 门后；`jsx-a11y` 未确认进 lint | 均为门后/等外部 | SEO/i18n/离线 polish 缺 | sitemap（域名到）/i18n EN（I18N_POLICY 门后+lane MVVP）/jsx-a11y 进 lint Top3 挑 | 清单勾选 | 域名/流量/政策门 |
| PAIN-P3-02 | 合规文案 | P3 | 静态：free-lane opt-in 有码无用户文案（简历/transcript 第三方路由声明未见） | 透明度文案滞后 | 用户不知情风险低但存在 | Privacy/Setup 加一行声明（须产品确认措辞） | 文案评审 | 产品确认 |
| PAIN-P3-03 | 质量 | P3 | 静态：`any` 3 处（GrowthTrend:19 / SkillBreakdown:35 / SystemDesignBoard:36） | 图表回调/外部形状偷懒 | 类型债小 | 逐个收紧（Recharts 回调类型 + tldraw 形状守卫） | tsc + 单测 | 无 |

**P0 存疑项：1（PAIN-P0-01，证据实测，根因在脏树）。P1 8项 / P2 6项 / P3 3项。**

### 第三段销账（F/B/A/S/G，一卡一行）
| ID | 维度 | 等级 | 证据（文件:行号+等级） | 根因假设 | 影响 | 修法/验证 | 依赖 |
|---|---|---|---|---|---|---|---|
| F1-01 | 前端/a11y | F ✅已关闭 | 实测：推荐集全开扫出 36 errors/15 文件；收敛：`sender` 改名（message-card 定义 + 9 调用，tsc 兜底）8 处、`tabs.tsx:58` tablist tabIndex、settings 2×htmlFor+aria-label、3 窄注释放行（label 直通原语/LiveCaptions 日志区/tabs 面板 APG）；`eslint.config.mjs` +4 硬规则（aria-role/label/tabindex/tablist-focus）；刻意未进 anchor-is-valid（landing/footer 14×href="#" 需产品定去向）与 click/static-interactions（setup:1092 脏树禁碰）。门禁 lint 0 err/tsc 0/test 50-367/build 0/mock-e2e 1；keyed 0 | ARIA role 误用 + 标签失联 + 历史只加 3 条 | SR 用户导航/表单可用性 | 同左；deferred 两项记入本行 | 脏树 setup owner（2 规则）；产品（死链去向） |
| S1-01 | 安全/销账 | F ✅已关闭 | §9 十项新鲜复核全站立（fences 15/19、tools 零、envelope 6、槽位 3 文件、secret 干净）；增量：LLM06/09/10 STRENGTHENED（本 session 的 guard-timeout/orama-abuse/sink-pin/a11y 收敛），LLM04 +1 接受记录（tiptap）；落 `SECURITY_REPORT.md §10`；门禁 test 50-367；keyed 0 | V5 销账后增量未归档 | 证据链断层 | 同左 | CodeQL/H4.3/H4.4/E4（外部/keyed，原样 tracked） |

---

## D. 门禁结论（进第二段的唯一钥匙）

- [x] 登记簿存在（本文件）。
- [x] P0 = 0 存疑项 —— **已达成（2026-09-19 复核）**：PAIN-P0-01 由脏树 owner 自行修复（`tests/a11y-visual.spec.ts` 空桩已消除，改为 `waitForTimeout(2500)` settled 扫描；`git diff` 仅剩该 hunk），本 agent 未碰他人文件。`npm run lint exit 0`（0 errors/2 warnings）、`typecheck exit 1→0`。
- [x] `verify` 全绿贴数 —— **已达成**：`lint 0 errors / typecheck exit 0 / test 46 files-353 passed / build exit 0 / audit critical exit 0`，`npm run verify exit 0`（2026-09-19 复核）。
- **结论：门禁已齐，可进第二段（待用户确认开卡顺序）。**

---

## E. 取证索引（复核用，不读旧日志）
`package.json:9-27,55-59` · `src/proxy.ts:41-124` · `src/lib/api/guard.ts:43-50,107-133` · `src/app/api/health/route.ts:36-47` · `src/app/api/analyze-practice/route.ts:1,76` · `src/ai/providers/registry.ts:16-32,93-174` · `src/ai/prompts/evaluation.ts:41-43,86` · `src/lib/api-client.ts:88-295` · `src/app/robots.ts` · `src/app/dashboard/privacy/page.tsx:10` · `supabase/migrations/002/003/004头` · `tests/a11y-visual.spec.ts:63-66,83` · `next.config.ts withPWA` · `npm run quota`（zhipu 3/50，gemini 0/20）。
