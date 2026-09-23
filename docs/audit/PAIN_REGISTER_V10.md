# PAIN_REGISTER_V10（2026-09-23）

> 生成：2026-09-23 · 执行 V10 §3 · **未改任何源码**，四代登记簿一字不动，本文件是本段唯一 Write。
> 方法：四代全文复用（ID 不重编）＋三处易腐点独立复核（`git status` / `verify` 全文 / `quota`）＋八维扫描（每项 `文件:行号` ＋ 证据等级 实测/静态/传闻）。
> Skills：`security-review`（被动）＋ `security-best-practices`（Next server＋React frontend 双 reference，只读）＋ `coding-standards` ＋ `prompt-optimizer`（意图/范围/缺口）＋ `product-capability`（约束外显：本文件即其约束产物）。

- 基线：HEAD=`1c290ce` / verify=lint 0 errors＋2既有warnings＋tsc clean＋test 50 files/369 passed＋build 44/44 exit 0＋audit 37零漂移 / quota=`zhipu 0/50 / gemini 0/20`（窗口 2026-09-22）/ 脏树=**20M＋4??（全归并行方，逐一点名见 §X）**
- 复用：四代结论摘要（各 3 行）＋ 易腐点复核（三行）见 §R
- 新增：**S-REM-01 顺延卡 1 项（OPEN·在制品·禁碰）**；其余必查五项零新痛（落处见 §N）
- 2026-final 缺口：对照表逐项见 §S（正典以 P2-08 REPORT fetch 实测 `GenAI-LLM-Top10/2026/final` 文件名为准）
- 并行交叉面：RED 旗 0 ＋ 已提交切片清单 ＋ 禁碰文件清单见 §X
- 门禁：P0=0（观测口径：`verify` exit 0 蕴含无 P0 断裂；正式关门声明权归动手人）＋ `verify` 全绿（数字见 §R）

---

## R. 复用四代摘要＋易腐点复核（实测）

- PAIN_REGISTER（V6）：P0-01 脏树 a11y 解析崩（后证伪解除）；P1×8／P2×6／P3×3 建账；门禁钥匙为 lint＋typecheck 双 exit 0（2026-09-19 复核达成，可进第二段待确认）。
- PAIN_REGISTER_V7：P0-02 并行 TDD-mid-flight 类型断裂（`health.test.ts:10,14,15` 4 参 vs 实现 2 参，禁代修）；U-评估-1/2（v7 三硬门＋19.3 四格）；P2-04／P3-03／jsx-a11y 子项 close-out。
- PAIN_REGISTER_V8：`verify` exit 0（50/367）观测口径 P0=0；编号碰撞 `P2-07-dup` 登记；P0-02 断裂消失（OBSERVED-GREEN，不代签）；P0-03 nightly 接线记入 RECONCILE（归并行方）。
- PAIN_REGISTER_V9：HEAD `1c290ce`（P2-07-dup 本系推送）＋ 11-commit 栈；`verify` exit 0（50/369）；CLOSED 批量点名；新增 P2-08（旧号标签卡，后经 P2-08 REPORT 自纠为正典口径）。
- 易腐点复核① `git status`：HEAD 仍 `1c290ce`（`git log --oneline -15` 实测，栈顶下 12 commits 回到 `aece034`，分支 main 与 origin 同步无 ahead/behind）；脏树由 V10 §0 预告的 16M＋2?? 变为 **20M＋4??**（新增 4M：`docs/SECURITY.md`、`docs/audit/S_VERIFY_V8.md`、`message-card.tsx`、`message-text.ts`＝P2-08 在制品；新增 2M：charts×2 类型收尾；新增 2??：`P2-08_REPORT.md`＋`PAIN_REGISTER_V9.md`；`orama-isolation.test.ts` ?? 连期三代）。
- 易腐点复核② `verify` 全文（`/tmp/verify-v10.log`，EXIT=0）：lint 0 errors／2 warnings（`src/app/error.tsx:74:27`＋`src/components/dashboard/SessionDetailModal.tsx:75:30`，与 §0 口径一致）／typecheck clean／test **50 files／369 passed**／build 44/44（19 API ƒ＋Proxy）／S 面子集 `orama-abuse＋orama-isolation＋security-surface` **3 files／19 passed**（`npx vitest run` 实测 2026-09-23）。
- 易腐点复核③ `quota`：`zhipu 0/50（剩50）/ gemini 0/20（剩20）`，窗口 `2026-09-22`（已滚动，全满；`.quota-ledger.json` 旧窗口 2026-09-19 used 3 为历史残留，不影响本窗口）。本段零 keyed／零免费-lane 调用，无需批文。

---

## 八维扫描（证据等级标注；V10 必查新增落 §N）

### F 前端/UX（静态＋实测）

- God 页无变化（实测）：`src/app/interview/page.tsx:1770行 / src/app/setup/page.tsx:1533行`（`wc -l`，与 V6 一致，P2-01 延续，脏树正动禁抢）。
- 对比度/F5 余波在脏树（实测 `git diff --stat`）：6 visualizer 各 4 行级改动＋`LiveStats.tsx:39`＋`interview/page.tsx:25`＋`setup/page.tsx:11`＋checklists（`A11Y_MANUAL_CHECKLIST:30 / RELEASE_CHECKLIST:9`）；`message-card.tsx:2`（P2-08 注释行，禁碰）。
- `forwardRef`×4 现状工作（静态：`button.tsx:57 / input.tsx:48,222 / PrintableDossier.tsx:10`）；`use cache` 系＋`cacheComponents/partialPrefetching/reactCompiler` 全仓零命中（实测， law 10 合规即“未启动”，P2-02 延续）。
- `jsx-a11y` 只加不减在位（实测 `eslint.config.mjs:8-23`：core-web-vitals 6 条＋7 硬规则 error 级）；a11y-visual 本段改动仅 settled 等待注释＋`waitForTimeout(2500)`（`git diff -- tests/a11y-visual.spec.ts` 实测，方法合规，禁碰）。
- 三模式（Calm／LiveCaptions／Dyslexia）本段零改动（静态）；Lighthouse 本段未跑（沿用 V6 传闻数＋P1-07 实测 `/` 88／dashboard 78）。

### B 后端/数据（实测为主）

- 19 路由无增减（实测 `find` COUNT=19，名单与 V6 一致）；5 migrations＋README 无增减（实测 `ls supabase/migrations`）。
- `select('*')` 仍 13 处全在 `src/lib/api-client.ts:88-295`（实测 `grep -c`＝13，逐行与 V6 一致，P1-03 pin 延续，⏸待 live 数）。
- `/api/health` 双探针 4 参对齐（实测 `health/route.ts:19 buildHealthBody(db,ms,practice,ms)`＋`probe:33-48` 单语句零行并行；storage／auth 排除注释沿用，P1-07 延续）。
- `proxy.ts` 正典边界在位（实测读码：`config.matcher` 放行 static／image／favicon＋`export function proxy` 命名＋`isProtectedPage:29` 7 前缀＋`/api/dashboard:46`＋fail-closed 401／redirect）；enforcing 头已含 `worker-src 'self' blob:`（`proxy.ts` 实测，P3-04 加固 notes 部分达成），`connect-src *` 仍宽松 vs report-only 严格延续（P1-04 延续，待生产流量）。
- 缓存 law 10 合规（实测：`updateTag／revalidateTag／refresh` 全仓零命中，无混用）；`force-static` 零命中（实测）。

### A AI/评估（实测为主）

- `generateObject` 仍 10 路（实测 `grep -rl` COUNT=10，名单与基线一致，R3 冻结延续）；`experimental_repairText` 6 路由＋2 注释（实测 8 命中：`init-context:62／star:71／interview:90／behavior:50／chunk:59／match:56`＋`evaluation-contract.ts:107／strict-json.ts:9`，与 R3 口径一致，注意与 v7 删除的 `experimental_output` 本体区分——后者零命中实测）。
- `experimental_telemetry` 零命中（实测；仅剩良性 `telemetry` 三处：`csp-report/route.ts:60` 注释＋`api-client.ts:215,224` 业务表＋`logging.ts:23` 注释）。**V10 必查结论：无残留，不开痛。**
- 注册表单一构造位延续（实测 `registry.ts:1-60`：MODEL_IDS 单一表＋`never NEXT_PUBLIC_*` opt-in 注释＋免费名单 pin `ultra／structured`）；UNTRUSTED 围栏在位（实测：`match.ts:19-27／hint.ts:20-21／chunk route:17` 等）。
- evals 面齐（实测 `ls evals`：golden／practice-golden／turn-golden＋free／live＋bias／fairness／injection fixtures）；EDD 双表＋κ≥0.6＋7 天口径延续（传闻，本段 0 keyed）；`test:eval:free` 本段未跑（0 calls，账本干净）。
- ACS 三性透镜：tools 调用零（静态沿用），只记录不设门。

### S 安全/合规（双 reference 被动只读；2026-final 对照见 §S）

- 输出槽位仍 2＋1（实测：`message-card.tsx:155` escape-at-sink＋`chat-background.tsx:15` 纯静态 keyframes＋`message-text.ts:37` 注释零调用；P1-08 pin 延续，子集 19/19 覆盖）。
- 密钥面干净（实测：`sk-proj-／sk-ant-` 零命中；`service_role` 仅 `health/route.ts:31` 禁区注释；`NEXT_PUBLIC_*` 仅 anon 设计值 `supabase.ts:3-4`＋3 处注释提及）。
- 供应链零漂移（实测 `npm audit --json`：1 low／31 moderate／5 high／0 critical＝37，与 §0 一致，`--audit-level=critical exit 0`）；Dependabot 周节奏在位（实测 `.github/dependabot.yml` weekly）；**CodeQL 仍无 workflow**（实测 `.github/workflows` 仅 ci／dsa／nightly-eval，`grep -ri codeql .github` 零命中——连欠多期延续，按 S4 节奏位跟踪，不新开 ID）。
- 上传链未动（静态沿用：5MB＋SVG 拒＋MIME＋size 双检，`parse-resume` 本段 diff 仅类型声明改写 `pdf-parse.d.ts`＋删 `@ts-expect-error`，逻辑零触及——`git diff` 实测，禁碰）。
- 合成标记 12-02 时钟：2026-09-23 起算剩 **70 天（约 2.3 个月）**；`src/` 内 `AI-generated／synthetic` 命中仍仅业务词（input `syntheticEvent` 误命中＋report／replay／dossier legacy caption 件，静态复核一致）；倒排（文案→检测→签字）延续 S7／G2 跟踪，紧迫度升，不新开 ID。

### P 性能（静态＋传闻）

- 包体积线未重跑探针（本段未起服务；静态：`TRANSFER_BUDGETS` 在 `perf-probe.mjs:84`＋CI gate 步 `.github/workflows/ci.yml:35-46`＋`package.json:26 perf:assert` 均在位，P2-07 延续）。
- 重型本地模型（Whisper／Kokoro）缓存／离线策略无新证据（静态沿用）；单共享 mic 流重构位沿用 P2-05（脏树区禁碰）。
- Lighthouse 双端本段未跑（传闻沿用；P1-08／P2-02 口径不变）。

### Q 质量/测试（实测）

- 基线 50／369 只增不减成立（实测 `verify` 全文；上游受控探针 `upstream_error` 日志为测试内行为，非失败）。
- e2e 12-project 矩阵延续（实测 `playwright.config.ts:23-40`：4 浏览器×3 分辨率生成式＝12 projects；本段未跑 e2e，P2-07-dup `1c290ce` retries:1 已提交）。
- a11y 稳态方法延续（settled 等待＋收敛证据注释，实测 diff 合规）；BUG-R* 配比本段无新增（无新修，无义务产生）。

### G 增长/发布（实测）

- SEO 清单门后延续：`robots.ts:1-17` 无 sitemap 行（等域名注释实测）＋`layout.tsx:10` metadataBase 门后注释（静态）；一页一意图／标题／LCP 门限均待域名＋流量（传闻）。
- i18n EN 门后（静态沿用）；tag→镜像冻结→回滚演练口径延续（传闻，本段无 tag 动作）。
- Vercel／Docker 一致性在位（实测：`vercel.json: npm install`＋`Dockerfile: node:20-alpine／npm ci`＋`next.config.ts:15 output standalone`＋health 双探针）。

### X 并行交叉面（实测，最高律）

- RED 旗清单：**0**（`tsc` clean 蕴含无 TDD-mid-flight 断裂；全树测试已提交，无 mid-flight 文件）。
- 已提交切片（归动手人，禁摘／禁 squash／禁代签）：`1c290ce` 栈顶 P2-07-dup＋其下 12 commits（P1-01／P1-07／P1-08／P2-06／P2-03／P2-02-07／F1-01／CI-01 链＋P2-08 标签行，`git log --oneline -15` 实测；V10 §0 称 11-commit 系实测为 12（不含栈顶），差 1 记方差非痛点）。
- 禁碰文件清单（20M＋4?? 全归并行方）：`docs/{A11Y_MANUAL_CHECKLIST,RELEASE_CHECKLIST,SECURITY}.md`、`docs/audit/S_VERIFY_V8.md`、`src/app/api/parse-resume/route.ts`、`src/app/{interview,setup}/page.tsx`、dashboard charts×2（GrowthTrend／SkillBreakdown）、interview 组件×6＋message-card、message-text、pdf-parse.d.ts、a11y-visual.spec＋??（`P2-08_REPORT.md`、`PAIN_REGISTER_V7.md`、`PAIN_REGISTER_V9.md`、`orama-isolation.test.ts`）。
- P1-09 常驻对账义务延续（合并前双向 diff 对账；登记簿各归各 session，append 不改他人结论——本文件新增独立文件，合规）。

---

## N. 新增痛（顺延编号；旧号碰撞沿用 `-dup` 后缀）

| ID | 维度 | 现象 | 证据（文件:行号／命令＋等级） | 等级 | 严重度 | 归属（含认领旗） | 建议修法＋门禁 |
|---|---|---|---|---|---|---|---|
| S-REM-01 | S 安全 taxonomy | 2026-final 重映射标签卡未关门：P2-08 实质进展（6 编辑：message-card／message-text／SECURITY.md／S_VERIFY_V8.md 拆行＋V9 登记簿重写）**全在脏树／未提交**（REPORT 本体 ??），残留 `SECURITY_REPORT.md:190` “H4.4 LLM10 Unbounded Consumption”笔误（应为 LLM06） | 实测：`git status --short`（4M＋1?? 在列）＋`git diff -- docs/SECURITY.md docs/audit/S_VERIFY_V8.md`（拆行／LLM05→LLM10 一致）＋`grep -n H4.4 docs/audit/SECURITY_REPORT.md:190`（笔误仍在）＋`P2-08_REPORT.md:25-29`（自述未动项）；等级：实测 | 实测 | P2（纯标签，零逻辑风险；对外不可引用前不关门） | 并行方（其在制品＋其 REPORT；`orama-abuse/isolation` LLM09 标签经对版确认正确、无需改） | 修法：其提交 P2-08 四文件＋REPORT 后，改 `SECURITY_REPORT.md:190` LLM10→LLM06 一词（独立一卡，零逻辑）；门禁：`grep LLM05` 输出语境零残留＋旧号零残留＋全 test 绿（50／369 只增不减）＋本表对照 §S 全勾 |

- 其余必查新增零新痛：19.3 升级面→U3 补丁卡（仍 19.2.4 实测，`package.json:59-60`）；v7 可用性→U1／U2（`ai ^6.0.168`＋engines 20.x 实测，Node22 硬门未过）；`experimental_telemetry`→无残留（上文）；ASI／ACS→tools 零调用评估位延续；12-02 时钟→S7／G2 跟踪延续（剩 70 天）。
- 计数：P0 0 ／ P1 沿用 ／ P2 沿用＋S-REM-01（顺延指定 ID）／ P3 沿用。

---

## S. 2026-final 缺口对照（S-REM-01 附表；正典 `GenAI-LLM-Top10/2026/final` 文件名口径）

| 新编号 | 旧标签对照 | 仓内状态 | 证据 |
|---|---|---|---|
| LLM01 提示注入 | — | 合规延续 | `analyze-vision/route.ts:22` data-URL 拒绝＋UNTRUSTED 围栏（静态） |
| LLM02 敏感信息披露 | — | 合规延续 | PII-free 日志＋health class-only＋csp-report 204（静态） |
| LLM03 过度代理 | 2025 LLM08（Agency 旧位） | 已拆行（脏树，待提交） | `S_VERIFY_V8.md` 拆行 diff＋`security-surface.test.ts:34`（实测） |
| LLM04 供应链 | — | 合规＋接受态延续（CodeQL 仍缺） | audit 37 零漂移（实测）＋tiptap P2-04 接受（传闻） |
| LLM05 数据与模型投毒 | 旧 LLM10 系误标已纠 | 合规延续 | 白名单 `normalizePracticeDrills`（传闻） |
| LLM06 无界消耗 | 2025 LLM10（Unbounded 旧位） | 已拆行（脏树，待提交）；**残留笔误 1 处** | `S_VERIFY_V8.md` 拆行 diff（实测）＋`SECURITY_REPORT.md:190` 笔误（实测） |
| LLM07 误导信息 | 2025 LLM09（Misinformation 旧位） | 合规延续 | evidence 信封（传闻）＋`security-surface.test.ts:123`（实测） |
| LLM08 隐藏上下文暴露 | 2025 LLM07（Leakage 旧位更名拓宽） | 合规延续 | `security-surface.test.ts:73`（实测） |
| LLM09 向量与嵌入弱点 | 2025 LLM08 系误标已证伪 | **标签正确，无需改** | `orama-abuse.test.ts:1,50`＋`orama-isolation.test.ts:1,16` LLM09（实测）＋P2-08 自纠（虚惊） |
| LLM10 不当输出处理 | 2025 LLM05 系误标已纠 | 已改 3 处（脏树，待提交） | `message-card.tsx:140／message-text.ts:35／SECURITY.md:9` LLM05→LLM10（实测 diff）＋`security-surface.test.ts:164`（实测） |
| ASI01–ASI10／ACS 三性 | 新增 companion | 评估位（只记录不设门） | tools 零调用（静态沿用） |

---

## E. 门禁结论（进 §4 的唯一钥匙）

- [x] 登记簿存在（本文件 `docs/audit/PAIN_REGISTER_V10.md`）。
- [x] P0=0 存疑项 —— 观测口径达成（`verify` EXIT=0 蕴含无 P0 断裂；P0 定义：数据丢失／越权／可远程利用漏洞／verify 变红；正式关门声明权归动手人，本文件不代签）。
- [x] `verify` 全绿贴数 —— 达成：lint 0 errors（2 既有 warnings：`error.tsx:74:27`＋`SessionDetailModal.tsx:75:30`）／ typecheck clean ／ test 50 files／369 passed ／ build 44／44 exit 0 ／ audit 37（1L／31M／5H／0C）零漂移；keyed 0（`zhipu 0/50＋gemini 0/20`，窗口 2026-09-22）。
- **结论：钥匙齐，可进 §4（待用户确认开卡顺序；§4 首卡须先查认领旗——S-REM-01 在并行方脏树中，若其未提交则禁碰，顺延下一痛；CLOSED 项禁重开）。**

---

## 取证索引

`git log --oneline -15`（1c290ce 系）· `git status --short`（20M＋4??）· `git diff --stat`（20 files）· `package.json:5-8,26-27,42,56-60` · `/tmp/verify-v10.log`（EXIT=0，50／369，44／44）· `npm run quota`（0／50＋0／20，窗口 2026-09-22）· `npm audit --json`（1／31／5／0＝37）· `grep generateObject`（10）· `grep experimental_repairText`（6＋2）· `grep experimental_telemetry／experimental_output`（零）· `grep cache系`（零）· `grep dangerouslySetInnerHTML`（2＋1）· `grep NEXT_PUBLIC_／service_role／sk-*`（设计值＋注释，零硬编码）· `grep forwardRef`（×4）· `src/proxy.ts` 全文（worker-src 在位／connect-* 宽松）· `playwright.config.ts:23-40`（12 projects）· `.github/{dependabot.yml,workflows/ci.yml:35-46}`（周节奏＋perf gate；CodeQL 缺）· `P2-08_REPORT.md` 全文（正典＋自纠＋未动项）· `SECURITY_REPORT.md:190`（笔误实锤）·子集（3／19）· `registry.ts:1-60` · `health/route.ts:19,33-48` · `api-client.ts:88-295`（13×select）· `robots.ts`（无 sitemap）· `vercel.json／Dockerfile／next.config.ts:15`（一致性）。

---

## 附注 F1（§4 P1-09 卡取证时追加，原结论不动；2026-09-23）

- 树移动：本 session 内并行方（或用户本人）提交 `88aca65`（P2-08，13:25，ahead origin 1 未推送）→ 现 HEAD=`88aca65`，脏树现为 **16M＋3??**（4M＋2?? 被收纳；本文件为新增 ?? 之一）。本文件 §R／§X 的“20M＋4??／HEAD=1c290ce”系审计时刻真值，保留不改。
- S-REM-01 推进：P2-08 六编辑已本地提交（`git show --stat 88aca65` 实测，零逻辑；message 自声明 `H4.4 typo left for owner`）；四文件残留 diff 归零（`git diff` 实测空）。未关门项收敛为：未推送（待用户批文“推”）＋`SECURITY_REPORT.md:190` 1 词残留（owner 自留）＋正式关门声明（禁代签）。
- 对账卡 P1-09 见 `docs/audit/RECONCILE_V10.md`（本 session 第二产出，仍零源码改动）。

---

## 附注 F3（V10 收尾回填：关门清单，2026-09-23）

- §0 三数回填：HEAD=`88aca65`（`origin/main` 同步，已推送，推动者非本 session，外部事件）／ `verify` 全绿沿用 `/tmp/verify-a11y.log`（EXIT=0：lint 0 errors＋2既有／tsc／50 files-369 passed／build 44-44；其后源码零 delta，结账有效）／ `quota` 全满（`zhipu 0/50 / gemini 0/20`，窗口 2026-09-22；累计 keyed spend＝0）。
- §3 登记簿链接：本文件＋`RECONCILE_V10.md`（P1-09）＋`LIGHTHOUSE_V10.md`＋`U2_ASSESSMENT_V10.md`（§5 证据）；四代旧簿一字未动。
- §4 关门：P1-09（对账报告，GREEN）／ S2-01（`codeql.yml` 新建，GREEN；供应链 SAST lane 关门）；S-REM-01 推进（`88aca65` 已推送，残留 H4.4 一词＋正式声明归 owner）。
- §5 关门：U3（React 19.3.0，GREEN）／ LH 双端（99/86/99/88，GREEN）／ U1（Node 24 全套，GREEN）／ U2 评估（可排期，迁移另卡）／ login-a11y（axe 0 violations，GREEN）。
- 未关（带锁延续）：P1-02（E4 冻结）／P1-03／P1-04／P1-05／P1-06（外部）／P2-01·P2-05（其文件区）／P3 门后项／U2 迁移（缺 keyed-MVVP＋R3 裁决，$0 下不开工）／H4.4 一词（owner）。
- 工作区：26M＋7?? 全点名（我方 10M＋5??：U1×8／U3 同文件／login×2／4 报告＋codeql；其余 16M＋2?? 归并行方）。签字：改了什么（上文逐卡）／没改什么（他人在制品＋CLOSED＋远端历史）／剩什么（上文未关）／门禁数字（上文）／方差（各卡已记）／provenance（各卡 skill＋实测）。
- $0 决算：keyed 调用 0／免费 lane 调用 0／ 最接近钱的操作是公开 npm registry 读（版本解析＋包下载）与 npx 公开包执行（lighthouse／codemod／playwright），均 $0。

---

## 附注 F4（E2E 回归复跑：U1/U3 运行时变更后，2026-09-23）

- `test:e2e:mock`（chrome-1280x720，本地 prod :3100，React 19.3＋Node 24 下）：第 1 跑 1 failed（signup 段，失败上下文已被第 2 跑覆盖，P2-07-dup 已知 flake 形状）→ 第 2 跑 **1 passed（47.2s）**，retries:1 按设计吸收。
- EDD 裁决：n=1 breach 只记方差，不调参、不改码；P2-07-dup 保持 CLOSED；U1/U3 无回归信号。keyed 0。

---

## 附注 F2（§4 S2-01 立项，用户已批“按建议进行”；只增）

| ID | 维度 | 现象 | 证据（等级） | 严重度 | 归属 | 建议修法＋门禁 |
|---|---|---|---|---|---|---|
| S2-01 | S 供应链 SAST | CodeQL／Semgrep lane 连欠多期：无 workflow，SAST 只有 tsc＋ESLint | 实测：`test -f .github/workflows/codeql.yml` 缺席（RED）＋`SECURITY_REPORT.md:48-50,170,279,390` 自述 OPEN／deferred；静态：`.github/workflows/` 仅 ci／dsa／nightly-eval | P2（纵深缺口；audit 0 critical 故非 P1） | 无主（新文件，零认领旗；与 CI-01 相邻但零改动既有 workflow） | 修法：新建 `.github/workflows/codeql.yml`（官方 starter 形：checkout@v4＋codeql-action v3 init／autobuild／analyze，js-ts；最小权限；周 cron＋push／PR）；门禁：YAML 可解析＋结构断言（jobs／language／permissions／triggers）＋`verify` 全绿（50／369 只增不减）＋零既有文件改动 |
