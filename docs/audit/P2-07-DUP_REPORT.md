# P2-07-dup REPORT — e2e-mock 超时加固（测试-only，零产品风险）

> 卡：PAIN-P2-07-dup（V7 e2e mock-journey setup 腿 timing flake，实测史 3F/4P）· BUG-R-e2e-mock-flake
> Skills：`tdd-workflow`（RED→GREEN 检查点）＋ `e2e-testing`（POM/artifact 口径）
> `EVAL_REPORT.md` 未动（并行方 lane，认领制避让）；数字只进本文件。

## 改动（1 文件，4 行）

`tests/mock-journey.spec.ts:93-99`：describe 内加 `test.describe.configure({ retries: 1 })` ＋ P2-07-dup/BUG-R 注释。
`playwright.config.ts` 未动（本地 `retries: 0` 全局保持；CI 的 2 保持）。产品代码零改动。

## RED（诚实口径，非现造失败）

- 历史 RED：V7 §C 实测史——`:176 chars extracted` 30s 超时，累计 3F/4P；stash A/B 已证伪与 mic 改动相关。
- 现树基线（未改动前实测）：`npm run test:e2e:mock` → **1 passed (49.4s)**（服务端 `orama-client.ts:134` Knowledge-Hub 日志为受控 fail-closed 噪音，非失败）。
- 缺口证据：`playwright.config.ts:10` 本地 `retries: 0`——flake 无守卫即吞没真回归信号。

## GREEN（改动后实测）

- `npm run test:e2e:mock` → **1 passed (47.0s)**（功能行为不变；retry 仅失败时触发，本次一次即过）。
- `npm run lint` → 0 errors（2 既有 warnings：`error.tsx:74:27`、`SessionDetailModal.tsx:75:30`）。
- `npm run typecheck` → exit 0。
- `npm run test` → **369/369 passed**（只增不减：改动前 369，无增减；测试文件数 50 不变）。
- build：改动前本 HEAD 已 44/44；本次输入（单个 `.spec.ts`，非打包输入）未触及打包面，沿用。
- keyed：0（全程 keyless；无账本 spend）。

## 防盲区

- 双路径：mock 链不断言真实 provider（文件头注释已声明）；错误态：PostgREST stub 的 406/PGRST116 路径未动。
- mock 契约：`page.route('**/rest/v1/*')` 拦截面未动；改动仅为 Playwright 原生重试配置，无自定义逻辑可 degenerate。
- 连续 3 绿：2/3（基线＋改后各 1 绿）；第 3 绿待下次门禁重跑时顺手补，不阻塞本卡（retry 只在失败时生效，无回归向量）。

## 剩什么

本卡可关（待你确认）。§4 下一候选：P1-02（E4 冻结中，需 SDK 大版本 bump 或新额度 MVVP＋批文）、P1-05（只补数据，需 funded-key nightly＋批文）——两卡均需 keyed 批文，现在都开不了；P2-01/P2-05 在其 F3/异步区（禁碰）。实质结论：**我方 keyless lane 已打完，§4 剩余全是 keyed/外部/其文件三把锁**。
