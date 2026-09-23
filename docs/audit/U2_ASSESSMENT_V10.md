# U2_ASSESSMENT_V10 — AI SDK v7 只读评估（零源码改动，不过线不迁）

> V10 §5 U2 前置评估位（沿 V7 U-评估-1 方法）。结论先行：**硬门 Node22 已由 U1 满足（engines 24.x，本地／CI 均为 24）；codemod dry 零提案；迁移是纯手动语义活，且 generateObject 一项官方口径与仓内政策存在分歧——决议留给迁移卡，本卡只列清单。**
> 取证：Context7 官方迁移指南（`vercel/ai` content/docs/08-migration-guides/23-migration-guide-7-0.mdx，3 次 scoped 查询）＋ `npx @ai-sdk/codemod v7 --dry [--verbose]`（官方，dry，先后两次，树零污染已验）＋ 仓内 grep 实测。
> 官方 skill（`npx skills add vercel/ai --skill migrate-ai-sdk-v6-to-v7`）真实存在，本卡未安装（Context7＋codemod 已够评估；留给迁移卡）。

## 硬门重验（实测）

| 门 | 状态 |
|---|---|
| Node22+ | OPEN→**满足**：`package.json engines 24.x`＋本地 node 24.15＋CI 三 workflow 24（U1 卡） |
| ESM | AJAR 延续（`package.json` 无 `type`，沿 V7 结论；U1 联带未爆雷：`verify` 全绿） |
| `experimental_output` 本体 | 零命中延续，无需迁移 |

## codemod dry（实测）

- `v7 --dry`／`--dry --verbose` 均 `complete` 且**零文件提案、树零污染**（前后 `git status -- src/` 均为并行方原 13M）。
- 解读（诚实口径）：官方 v7 codemods 在本仓无自动可改项——迁移（如做）几乎全手动。不预断原因（未读 codemod 源码）。

## 语义清单（官方指南对照 × 仓内实测）

| # | 语义项 | 官方口径（迁移指南实测） | 仓内现状（实测） | 迁移卡处置 |
|---|---|---|---|---|
| 1 | `system`→`instructions` | 改名；`system` 仍为 deprecated fallback（instructions 优先）；适用 generateText／streamText／generateObject／streamObject／streamUI＋prepareStep＋repairToolCall | `system:` ×11 路由 | 逐路由改名（一卡一条，fallback 期可混用；禁整仓替换） |
| 2 | `experimental_telemetry`→`telemetry` | 毕业改名；旧名 deprecated alias 可用，无行为差，可增量混用 | **零命中**（仅业务 telemetry 表／注释） | 无项（本表即关闭证据） |
| 3 | `generateObject` 去留 | **指南仍把 generateObject 列为接受新 `instructions` 的现行函数**（非删除项）；`generateText＋Output.object` 为推荐新写法（指南＋cookbook 双实证） | 10 路回滚态（R3 冻结） | **决议项**：V10 新代码律（禁 generateObject）vs 官方“仍支持”——存量 10 路迁不迁、按何顺序，由迁移卡按 R3 解冻条件裁决，本卡不预断 |
| 4 | `experimental_repairText`（我仓第二层 repairZhipuJson） | 指南片段未见 repairText 去留（仅见 repairToolCall 转 instructions）；codemod 零提案 | 6 路由＋2 注释 | 迁移卡逐条确认；手动 safeParse  fallback 已存在（strict-json），禁硬转（沿 §1.9） |
| 5 | `useChat onFinish`（`interview/page.tsx:299`） | 本卡未查到 useChat 回调改名证据（3 次查询限额已用尽，不臆断） | 1 处（脏树文件，禁碰） | 迁移卡读指南逐条确认＋其 F3 完工后 |
| 6 | 依赖 bump | `ai ^6.0.168`→v7（＋`@ai-sdk/* 3.x` 联动大版本） | 未动 | 迁移卡首步；bump 即 R3 语境的“SDK 大版本 bump 实装”（解冻条件之一，另一为 MVVP＋批文） |

## 解冻链（诚实记录）

- R3（E4）解冻条件（V10 §4）：bump 实装 **或** 新额度 MVVP＋批文。U2 迁移一旦 bump 即满足前者——但“迁多少”（尤其 #3 存量 10 路）仍需迁移卡逐项＋门禁（单路由 MVVP＋全绿），禁整批跳步。
- 本卡之后：U2 进入“可排期”（V10 §2 口径），不是“已批准动手”。下一动作是迁移卡立项（用户批），不是本 session 擅迁。

## 门禁影响

- 本卡零源码改动；`npm run lint` sanity（见 §4 报告）；test／build 沿用 U1 卡 EXIT=0（同树，评估 artifact 均为 md／tmp）。
- keyed：0（codemod 下载为公开 npm 包，零 keyed 调用）。
