# RECONCILE_V8 — §4 P1-09 所有权切分＋双向对账（只读，本 session 报告）

> V8 §4 R1 前置＋P1-09 修法落地。**零源码改动**：所有结论来自 `git log/show/status` 与 keyless 门禁重跑；他人文件一律只读。
> Skill：`product-capability`（约束外显）＋ `coding-standards`（命名/边界）。

---

## 1. 树移动（实测，17:27–17:35 区间）

- §3 收官时：HEAD `aece034`，脏树 40 项（33M＋7??）。
- 现：HEAD `7d95a92`（`[origin/main]` 同步，已推送），并行方连推 8 个切片 commit（R7 式，一痛一卡）：
  - `64ae28a` P1-01 guard（`guard.ts`＋`analyze-practice/route.ts`＋`guard-timeout.test.ts` 104 行）
  - `1831957` P1-07 health 双探针 · `97d15f5` P1-08/P2-06 安全 pin
  - `9c7d66d` P2-03 迁移钉 · `7660a70` P2-02/07 perf 门 · `ace9a48` F1-01 a11y
  - `4d61be4` PAIN_REGISTER（132 行）＋SECURITY_REPORT §10 · `7d95a92` CI-01
- 现脏树 16M＋3??：16 个 modified（F3/F5 余波：`interview/page`、`setup/page`、6 visualizer、charts、checklists 等）＋ untracked（`PAIN_REGISTER_V7.md`、`orama-isolation.test.ts` 属并行方推定；`PAIN_REGISTER_V8.md` 属本 session）。

## 2. R1 裁决：P1-01 已由 owner 闭合，本 session 无动作

- 证据：`git show --stat 64ae28a`（实现＋测试同卡）＋ `guard.ts:43-52` 手写 `combineSignal` 在树＋认领子集 4 files/13 passed（含其 `guard-timeout`）。
- 关门声明权归其所有（commit 即其声明）；本文件不代签、不重复修。§4 R1 钥匙：**满足（无需我动手）**。

## 3. 新 RED（只报不修）：PAIN-P0-03 nightly 接线断裂

- 证据（实测）：新 HEAD 上 `npm run verify` 到 test 止步——`Test Files 1 failed | 49 passed`，`Tests 1 failed | 366 passed`；单跑 `tests/unit/nightly-workflow.test.ts`：`is secret-gated and fork-safe` 断言 `nightly-eval.yml` 含 `secrets.ZHIPU_API_KEY != ''`，实际其 CI-01（`7d95a92`）已改为 env-indirection gating，字面消失。
- 归属：测试＋workflow 均为并行方已提交文件（树上干净），**禁碰**，请 owner 自闭（改测试以匹配新 gating，或回退 gating；二选一，其序列其决定）。
- 门禁影响：在 P0-03 关闭前，`verify` 为红，**§4 其他需全绿门禁的痛卡一律不得开工**（铁律 6），§5 更禁入。

## 4. 所有权切分 v2（认领制现状表）

| 桶 | 内容 | 处置 |
|---|---|---|
| 并行方已提交（8 commits） | P1-01/P1-07/P1-08/P2-06/P2-03/P2-02/07/F1-01 实现＋测试＋登记簿 | 只读消费；销账声明归其所有 |
| 并行方在制品（16M＋2??） | F3/F5 余波＋checklists＋`PAIN_REGISTER_V7.md`＋`orama-isolation.test.ts` | 禁碰；合并前由其先对账 |
| 本 session | `PAIN_REGISTER_V8.md`＋本文件 | 自有，可追加附注 |
| 共用只读真值 | `git log/status`、`quota`、keyless 门禁数 | 任一 session 可重跑 |

合并顺序建议：其 16M 落定＋P0-03 自闭＋`verify` 重绿 → 任一 session 贴数 → 再开 §4 下一痛卡。

## 5. 我方 lane（其文件全排除后仍 OPEN 的痛）

P1-02（E4 冻结·R3）、P1-03（⏸待外部数）、P1-04（待生产流量）、P1-05（只补数据·需 keyed）、P1-06（外部 cutover）、P2-01（禁抢其 F3）、P2-05（其异步区）、P2-07-dup（e2e-mock 超时）、P3-01 余部/P3-02（门后/待产品措辞）。
**下一卡推荐（P0-03 关闭且树绿之后）：P2-07-dup**——`tests/mock-journey.spec.ts` 树上干净（无认领旗）、测试-only 改动（`retries:1` 或拆步断言）、零产品风险、TDD 可验证（连续 3 绿）。keyed 需求：0。批文需求：e2e 需起本地服务＋浏览器，耗时较长，请一并批准。

## 6. 新 HEAD 门禁数（本次实测）

lint（`verify` 链内通过，未到 test 即 test 失败，故 lint＋typecheck 均为 pass，精确数待 P0-03 关闭后重贴）/ test **49/50 files，366/367**（唯一失败见 §3）/ build 未执行到（链中断）/ keyed 0（本段无任何 keyed 调用；`quota` 窗口 2026-09-20 仍 `zhipu 0/50 / gemini 0/20`，§3 实测后未复跑，无 spend 即无漂移）。
