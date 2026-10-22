# PAIN_REGISTER_V9 — V9 §3 审计产出（只读审计，本段唯一 Write）

> 生成：2026-09-22 · 执行 V9 §3 · **未改任何源码**，三代登记簿一字不动。
> 方法：三代全文复用（ID 不重编）＋三处易腐点独立复核（`git status` / `verify` 全文 / `quota`）＋六维扫描（`文件:行号`＋实测/静态/传闻）。
> Skills：`security-review`（被动）＋ `security-best-practices`（双 reference 只读）＋ `coding-standards` ＋ `prompt-optimizer`。

---

## A. 独立复核真值（实测）

- **HEAD：** `1c290ce`（本系 P2-07-dup，已推送）；下为其 11-commit 栈；分支 `main` 同步。
- **脏树 16M＋2??（`git status` 实测，全归并行方）：** 16 个 modified（F3/F5 余波：`interview/page`、`setup/page`、6 visualizer、charts、checklists、`parse-resume/route`、`pdf-parse.d.ts`、`a11y-visual.spec`）＋ untracked（`PAIN_REGISTER_V7.md`、`orama-isolation.test.ts`）。本系文件已全部提交，树上零我方在制品。
- **栈（`package.json` 实测）：** Next `16.3.5` / React `19.2.4` / `ai ^6.0.168` / `engines node 20.x`——19.3 与 v7 均已发布但均未采用（U 轨道件，见 §D）。
- **面（实测）：** 19 API 路由 / 19 prompts / 5 migrations＋README / `generateObject` 10 路（冻结）/ `experimental_repairText` 8 文件（6 路由＋2 注释）/ `experimental_telemetry` **零命中** / `use cache` 系＋`updateTag` **零命中**。
- **门禁（本次全文实测 `/tmp/verify-v9.log`，脏树下）：** `verify` **exit 0**——lint 0 errors（2 既有 warnings）/ typecheck clean / test **50 files / 369 passed** / build 44/44。
- **账本（`npm run quota` 实测，零新 spend）：** `zhipu 0/50 / gemini 0/20`，窗口 **`2026-09-22`**（已滚动，全满）。

---

## B. 六维扫描（V9 必查项结论）

- **2026 final 对版结论（正典 `2026/final/LLM*.md` 文件名，fetch 实测；V9 自纠：初版误信过期 Slack 频道名，已更正）：** V8 映射全对，S1-01 的 S1–S10 全对，`orama-abuse.test.ts:1` 的 LLM09（向量）亦合正典、无需改。真实残留仅 4 处——`message-card.tsx:140`＋`message-text.ts:35`＋`SECURITY.md:9` 把输出处理标成 LLM05（2025 残留，应为 LLM10）＋`SECURITY_REPORT.md` H4.4 “LLM10 Unbounded”笔误（应为 LLM06，待 owner，禁碰）；注明 2025 系的历史行文（TECH_RESEARCH/MASTER_AUDIT） intentionally 保留。见 §D P2-08（范围已收敛）。
- **19.3 升级面：** 仍 19.2.4（实测）；19.3（09-09，VT/Fragment stable）未装。机会非痛点，归 U3 补丁卡，不新开痛。
- **v7 可用性：** `ai ^6.0.168`＋node 20.x（实测）；v7 硬门（Node22+）未过，skill/codemods 不可跑。归 U1/U2，不新开痛。
- **ASI/ACS agent 面：** 仓内 tools 调用零（沿用）；ACS 三性仅评估位，不设门。
- **12-02 标记时钟：** Art.50 legacy 宽限剩约 2.3 个月（窗口 09-22 起算）；S7/G2 跟踪延续，紧迫度升，无新证据。
- **RLS EXPLAIN：** 仍外部（无 live 动作），沿用 002 bridge＋003 等谓词（传闻）。
- **输出/密钥/缓存面（静态复核无漂移）：** `dangerouslySetInnerHTML` 2＋1（`message-card.tsx:155` escape-at-sink 等）；`sk-*` 零命中，`service_role` 仅禁区注释；`force-static` 零命中。
- **并行交叉面：** 无 TDD-mid-flight RED 旗文件（其测试均已提交）；在制品 16M＋2?? 全禁碰；P1-09 对账义务常驻。

---

## C. 复用总账（开/闭逐项点名；关门声明权归动手人）

- CLOSED（不动）：P0-01/P0-02/P0-03、P1-01/P1-07/P1-08、P2-02/P2-03/P2-04/P2-06/P2-07（perf 版）/P2-07-dup（`1c290ce` 本系）、F1-01/S1-01（旧编号口径，标签重映射见 P2-08）。
- OPEN 带锁：P1-02（E4 冻结；v7 发布≠解冻，仍需 bump 实装或 MVVP＋批文）/ P1-05（只补数据，需 funded-key nightly＋批文）/ P1-03（⏸待 live 数）/ P1-04（待生产流量；联动 19.3 Trusted Types）/ P1-06（外部 cutover）/ P2-01·P2-05（其文件区）/ P1-09（常驻）/ P3-01 余部·P3-02（门后）/ P3-04（code-runner accepted-risk，加固 notes 待 enforcing CSP）。
- **计数：P0 0 / P1 沿用 / P2 沿用＋1 新增 / P3 沿用。**

---

## D. 新增痛（顺延编号）

| ID | 等级 | 证据 | 根因 | 影响 | 修法 | 验证 |
|---|---|---|---|---|---|---|
| PAIN-P2-08 | P2 | 实测：`message-card.tsx:140`＋`message-text.ts:35`＋`SECURITY.md:9` 将输出处理标成 LLM05（2026 final＝**LLM10**）；`S_VERIFY_V8.md:12` LLM03/06 合并行需拆分；`SECURITY_REPORT.md` H4.4 “LLM10 Unbounded”笔误（应为 LLM06，待 owner，禁碰）。静态：零逻辑影响（纯注释/文档） | 2025 系残留（当年输出处理＝LLM05）＋V9 初版误信过期 Slack 频道名（已自纠，以正典文件名为准） | 纯标签卡：自家＋无主旧文件注释修正（本卡）；其提交文件（H4.4）须其点头 | grep 输出处理语境零 LLM05＋全 test 绿 |

---

## E. 门禁结论（进 §4 的唯一钥匙）

- [x] 登记簿存在（本文件）。
- [x] P0=0（`verify` exit 0 蕴含）。
- [x] `verify` 全绿贴数：lint 0 errors / tsc clean / test 50/369 / build 44/44；keyed 0（账本 0/50＋0/20，窗口 2026-09-22）。
- **结论：钥匙齐，可进 §4。** 首卡推荐 P2-08（自家文件先行＋其文件先请示；纯注释卡，TDD 以 grep 新旧号＋全绿为 GREEN，历史 RED＝本表）。

---

## F. 取证索引

`git log --oneline -5`（1c290ce 系）· `git status`（16M＋2??）· `package.json`（16.3.5/19.2.4/6.0.168/node20）· `/tmp/verify-v9.log`（exit 0，50/369）· `npm run quota`（0/50＋0/20，窗口 2026-09-22）· `grep generateObject`（10）· `grep experimental_repairText`（8）· `grep experimental_telemetry/use cache/updateTag`（零）· `grep dangerouslySetInnerHTML`（2＋1）· `orama-abuse.test.ts:1`（LLM09 合正典，无需改）· 正典对版（V9 自纠记录见 §B）。
