# PAIN_REGISTER_V8 — V8 §3 审计产出（只读审计，本段唯一 Write）

> 生成：2026-09-20 · 执行 V8 §3 · **未改任何源码**，原登记簿（`PAIN_REGISTER.md`、`PAIN_REGISTER_V7.md`）一字不动。
> 方法：两代登记簿全文复用（ID 不重编）＋三处易腐点独立复核（`git status` / `verify` 全文 / `quota`）＋六维扫描（每项 `文件:行号` ＋ 证据等级 实测/静态/传闻）。
> Skills：`security-review`（被动）＋ `security-best-practices`（Next server＋React frontend 双 reference，只读）＋ `coding-standards` ＋ `prompt-optimizer`（意图/范围/缺口视角）。
> 文献：V7 §2 全量沿用（2026-09-19 联网，未满 48h，无复验）＋ V8 §2 新增一条（并行 TDD 认领模式实证）。

---

## A. 独立复核真值（实测，不采信旧日志）

- **HEAD：** `aece034`（`git log --oneline -5`：`aece034 / 0954e0a / a7f13fa / cb61676 / ece3bd8`）；分支 `main`，`up to date with origin/main`。
- **脏树 40 项（33M＋7??，`git status` 实测）：** 33 个 modified（含 `src/lib/api/guard.ts`、`src/app/api/health/route.ts`、`src/app/api/analyze-practice/route.ts`、`eslint.config.mjs`、`package.json`、`scripts/perf-probe.mjs` 等）＋ 7 个 untracked（`docs/audit/PAIN_REGISTER.md`、`docs/audit/PAIN_REGISTER_V7.md`、`supabase/migrations/README.md`、`tests/unit/{guard-timeout,health,orama-abuse,orama-isolation}.test.ts`）。与 V8 §0“~40 项”一致。
- **栈（`package.json:5-8,56-59,42` 实测）：** Next `16.3.5` / React `19.2.4` / `ai 6.0.168` / `@ai-sdk/* 3.x` / `engines node 20.x`，与基线一致。
- **面（实测）：** 19 API 路由（`find src/app/api -name route.ts | wc -l = 19`）/ 19 prompts（`ls src/ai/prompts` 19 文件）/ 5 migrations＋README（`ls supabase/migrations`：`0001/001/002/003/004 ＋ README.md`）。
- **门禁（本次全文实测，脏树下）：**
  - `npm run verify` → **exit 0**（build 44/44，19 API ƒ＋Proxy）。
  - `npm run lint` → **0 errors / 2 warnings**（既有：`src/app/error.tsx:74:27`、`src/components/dashboard/SessionDetailModal.tsx:75:30` no-location-assign）。
  - `npm run typecheck` → **exit 0**（V7 的 P0-02 TS2554×3 已不在树上）。
  - `npm run test` → **50 files / 367 passed**（与 V8 §0 一致，只增不减口径成立）。
  - 并行方认领面子集（只读重跑，未碰文件）：`guard-timeout＋health＋orama-abuse＋orama-isolation` **4 files / 13 passed**。
  - `test:e2e:mock / Lighthouse / npm audit` → **本段未跑**（前两者需起服务/浏览器，本段只读审计不启动；audit 沿用 V6 实测 0 critical，标传闻）。
- **账本（`npm run quota` 实测，零新 spend）：** `zhipu 0/50（剩50）/ gemini 0/20（剩20）`，窗口 `2026-09-20`（已滚动，全满）。本段无任何 keyed / 免费-lane 调用，无需批文。

---

## B. 六维扫描（证据等级标注；V7 六维＋V8 七项必查）

### B1 架构/质量（静态为主）
- God 页残留：`interview/page`、`setup/page` 大文件仍在（V6 实测 1770/1533 行；本段未重数，标传闻；脏树正动其中多文件，禁评价归属）。
- `experimental_output` 残留：**有**（静态）——`experimental_repairText` 仍在 6 路由（`init-context:62 / analyze-star:71 / analyze-interview:90 / analyze-behavior:50 / analyze-chunk:59 / analyze-match:56`）＋注释 `src/ai/prompts/strict-json.ts:9`、`src/ai/evaluation-contract.ts:107`。属已知 PAIN-P1-02（E4 回滚态），非新痛。
- `generateObject`：**10 路**（实测 `grep -rl` 计数＝10），与基线一致，回滚态延续。
- 缓存：`use cache / cacheLife / cacheTag / revalidateTag / cacheComponents / partialPrefetching / reactCompiler` **全仓零命中**（静态）——缓存分层未启动，延续 P2-02 结论（架构无着力点，不开旗）。

### B2 AI 工程
- 超时面：`guard-timeout` 认领文件实测 13 子集全绿；`analyze-practice` 仍在脏树（禁碰）。
- 免费 lane：`registry.ts:93` 注释 `never NEXT_PUBLIC_*`；名单复验前置律延续（静态采信 V6，传闻）。
- 跨模态用例（必查）：`analyze-vision/route.ts:22` 仍仅收 `data:image/*` data-URL（静态），拒绝 provider 侧 fetch——LLM01 跨模态面无新敞口。

### B3 安全（双 reference 被动只读）
- 输出槽位：`dangerouslySetInnerHTML` 全仓 2 渲染站＋1 注释（`message-card.tsx:155` 经 `escapeHtml`、`chat-background.tsx:15` 纯静态 keyframes、`message-text.ts:37` 注释零调用）——P1-08 销账延续（静态复核一致）。
- 密钥面：`NEXT_PUBLIC_*` 仅 `supabase.ts:3-4` anon 设计值＋注释提及（`robots.ts:6 / layout.tsx:10 / registry.ts:93`）；`service_role` 仅注释提及（`health/route.ts:31` 禁区声明）。零硬编码密钥（静态）。
- 代理面：`src/proxy.ts:6-13` matcher 放行 `_next/static|_next/image|favicon.ico`，`isProtectedPage:29`＋`/api/dashboard:46`（静态）——CVE-2025-29927 回归面延续，fail-closed 结论沿用（传闻）。
- CSP：enforcing 宽松 vs report-only 严格延续（V6 静态结论沿用，传闻；本段未重读 proxy 全文）。

### B4 数据/后端
- RLS EXPLAIN（必查）：**未跑 live EXPLAIN**（外部依赖，无 keyed/线上动作；静态沿用 002 bridge＋003 等谓词结论，标传闻）。`supabase/migrations/README.md`（P2-03 钉）存在且未被改动（只读确认）。
- `/api/health`：`buildHealthBody` 现为 4 参（`health/route.ts:19` 实测），与 `health.test.ts:10,14,15` 对齐——V7 P0-02 的类型断裂已不在树上（见 §C）。

### B5 前端/体验
- React 19.3 采用四格（必查，静态）：`forwardRef`×4（`button:57 / input:48,222 / PrintableDossier:10`）现状工作；`use cache` 等零命中（见 B1）；结论沿用 V7 §G（补丁卡可单走、特性全 P3），本段无新证据。
- v7 gap（必查）：`experimental_output` 删除项对应的是 `experimental_repairText`（v6 残留，非 v7 删除的 `experimental_output` 本体；`grep experimental_output` 零命中）——U2 硬门 3（OPEN）结论延续。

### B6 合规/产品
- 合成标记 gap（必查，静态）：`src/` 内 `AI-generated/synthetic` 命中仅 `input.tsx:91-96` 的 React `syntheticEvent`（误命中，非 AI Act 标记）；Art.50 告知延续 V6（训练 disclaimer＋legacy caption，传闻）。宽限至 2026-12-02 到期项延续跟踪，无新代码证据。
- Practice-only 红线：本段未触及任何 verdict/评估文案（零改动）；沿用 V6 抽查结论（传闻）。

### 并行交叉面（必查，有旗即停清单）
- 有旗文件（禁碰）：`tests/unit/guard-timeout.test.ts:1-3`（P1-01 RED 声明）/ `tests/unit/health.test.ts:1-4`（P1-07）/ `tests/unit/orama-abuse.test.ts:1-5`＋`orama-isolation.test.ts:1-6`（P2-06）/ `supabase/migrations/README.md:1`（P2-03）。
- 连带嫌疑文件（同 session 改动，禁碰）：33 个 M 文件全部（含 `guard.ts`、`health/route.ts`、`analyze-practice/route.ts` 等）——归属未对账前一律视为他人在制品。
- **编号碰撞发现（静态）：V7 新增 `PAIN-P2-07`（e2e mock-journey 超时）与 V6 已有 `PAIN-P2-07`（perf assert 守卫，已关闭）同号。** 本文件不重编旧号；下文记为 `PAIN-P2-07-dup`（e2e-mock），新痛顺延自 `PAIN-P2-08` 起。

---

## C. 复用总账（开/闭逐项点名；ID 不重编；关门声明权归动手人——本文件只记观测）

| ID | 来源 | 本段观测 | 去处 |
|---|---|---|---|
| PAIN-P0-01（a11y 解析崩） | V6 | lint exit 0（0 errors），`verify` 全绿 | RESOLVED 延续，无复发 |
| PAIN-P0-02（health TDD-mid-flight） | V7 | **树上断裂已消失**：tsc exit 0，`health.test.ts` 2/2，`buildHealthBody` 4 参对齐（`health/route.ts:19`） | OBSERVED-GREEN（正式关门声明权归并行方，本文件不代签；门禁计数按 P0=0 口径，见 §E） |
| PAIN-P1-01（guard 超时） | V6 | 认领面子集 13/13 全绿（含其文件）；生产文件在脏树 | 移交 §4 R1：先等其关门声明，若未关门则禁碰 |
| PAIN-P1-02（E4/`generateObject`×10） | V6 | 残留计数仍 10（实测），`experimental_repairText`×6（静态） | OPEN，冻结延续（R3） |
| PAIN-P1-03（select 白名单） | V6 | 未复核（需 live DB，外部） | OPEN（⏸外部数前不重开延续） |
| PAIN-P1-04（CSP enforcing） | V6 | 未重读全文，需生产流量 | OPEN（外部④延续） |
| PAIN-P1-05（deepseek MVVP） | V6 | 本段 0 keyed，无新数据 | OPEN（只补数据延续） |
| PAIN-P1-06（bridge→005 cutover） | V6 | 未动迁移文件 | OPEN（外部延续） |
| PAIN-P1-07（health 浅） | V6 | 双探针实现＋测试在树且绿（只读） | 其关门声明权归并行方，本文件不代签 |
| PAIN-P1-08（innerHTML 存疑） | V6 | 槽位复核一致（静态） | CLOSED 延续（pin 常绿，子集 13/13 覆盖 orama＋health＋guard；security-surface 未重跑，§4 前补） |
| PAIN-P1-09（交叉覆盖） | V7 | 脏树 40 项（V7 时 16 项），交叉面扩大 | OPEN，§4 前须双向 diff 对账 |
| PAIN-P2-01（God 页） | V6 | 脏树正动，禁抢拆 | OPEN（R4 延续） |
| PAIN-P2-02（1032KB 线） | V6 | 未跑探针（需起服务；本段不启动） | OPEN（评估延续） |
| PAIN-P2-03（双初始钉） | V6 | README 存在，旧文件零改动（只读） | CLOSED 延续（其声明权归并行方） |
| PAIN-P2-04（供应链） | V6 | audit 未重跑 | CLOSED 延续（节奏位按 S4 跟踪，标传闻） |
| PAIN-P2-05（late-stream） | V6 | 脏树区，禁碰 | OPEN |
| PAIN-P2-06（orama 隔离） | V6/V7 | 子集内 8/8（abuse＋isolation）全绿（实测） | CLOSED 延续 |
| PAIN-P2-07（perf assert） | V6 | `perf:assert` 脚本＋`package.json:26` 仍在（静态） | CLOSED 延续 |
| PAIN-P2-07-dup（e2e mock 超时） | V7 | 本段未跑 e2e | OPEN（传闻＋实测史延续） |
| PAIN-P3-01/02/03 | V6 | P3-03（`any`×3）V7 已 close-out；余部未复核 | P3-03 CLOSED 延续；P3-01 余部/P3-02 OPEN（门后） |
| F1-01 / S1-01 | V6 第三段 | 本段未重验 | 销账延续（传闻） |

**计数：P0 0（观测口径，正式关门待 owner 声明）/ P1 9＋09（沿用）/ P2 7＋dup（沿用）/ P3 3（沿用）。新增痛：0。**

---

## D. 新增痛（顺延编号）

无。七项必查均落入已有 ID（19.3→U3/P3-01、v7 gap→P1-02/U2、`experimental_output`→P1-02、RLS→P1-03/06、跨模态→LLM01 延续、合成标记→S7/G2 到期跟踪、并行交叉→P1-09）。编号碰撞（`P2-07-dup`）已在 §B/C 登记，不另开 ID。

---

## E. 门禁结论（进 §4 的唯一钥匙）

- [x] 登记簿存在（本文件 `docs/audit/PAIN_REGISTER_V8.md`）。
- [x] P0=0 存疑项 —— 观测口径达成（`verify` exit 0 蕴含无 P0 断裂；V7 P0-02 的类型断裂已不在树上；正式关门声明权归并行方）。
- [x] `verify` 全绿贴数 —— 达成：lint 0 errors（2 既有 warnings）/ typecheck exit 0 / test 50/367 / build 44/44 exit 0 / 认领面子集 4/13 全绿；keyed 0（`zhipu 0/50 / gemini 0/20`，窗口 2026-09-20）。
- **结论：钥匙齐，可进 §4（待用户确认开卡顺序；§4 首卡须先查认领旗——P1-01 若其未关门则禁碰，顺延下一痛）。**

---

## F. 取证索引

`git log --oneline -5`（aece034 系）· `git status`（33M＋7??）· `package.json:5-8,26-27,56-59` · `npm run verify`（exit 0，44/44）· `npm run lint`（0 errors/2 warnings）· `npm run typecheck`（exit 0）· `npm run test`（50/367）·子集（4/13）· `npm run quota`（0/50＋0/20，窗口 2026-09-20）· `src/app/api/health/route.ts:19,31` · `tests/unit/{guard-timeout:1-3,health:1-4,orama-abuse:1-5,orama-isolation:1-6}` · `supabase/migrations/{ls＋README.md:1}` · `grep generateObject`（10）· `grep experimental_repairText`（6 路由＋2 注释）· `grep cache`（零命中）· `grep NEXT_PUBLIC_/service_role`（设计值＋注释）· `grep dangerouslySetInnerHTML`（2＋1）· `grep forwardRef`（×4）· `src/proxy.ts:6-13,29,46` · `analyze-vision/route.ts:22`。

---

## G. 附注（2026-09-20 §4-1 追加，原结论不动）

- 树移动：并行方连推 8 commits（`64ae28a…7d95a92`，HEAD 现为 `7d95a92` 已同步 `origin/main`）；脏树 40 项→16M＋3??；`PAIN_REGISTER.md` 已由其提交（132 行），`PAIN_REGISTER_V7.md` 仍为 untracked。
- P1-01：owner 以 `64ae28a` 自闭（实现＋测试同卡），本 session 无动作，R1 钥匙满足。
- 新 RED：PAIN-P0-03（nightly 接线，`nightly-workflow.test.ts` 1 failed，新 HEAD test 366/367）已记入 `RECONCILE_V8.md` §3，归属并行方，禁碰。在其关闭前 §4 其余痛卡停工（铁律 6）。
