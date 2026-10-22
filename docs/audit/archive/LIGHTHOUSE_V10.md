# LIGHTHOUSE_V10 — §5 F 双端新鲜数（只读评估卡，零源码改动）

> 方法：`npm run build`（React 19.3.0 栈现构建）→ `next start -p 3100`（`SESSION_SECRET=perf-smoke-lh`，沿 CI perf 门先例）→ lighthouse 13.5.0（npx 实测）＋系统 Chrome → 4 组 JSON（`/tmp/lh-*.json`）。
> 口径：本卡为只读 spike（沿 P2-02“只评不开旗”先例），无 RED 对象；GREEN＝4 组分数产出＋方法可复现。EDD 纪律：单次测量只记方差，不调参、不归因。
> 与 V9 P1-07（`/` 88／dashboard 78，desktop）在同一工具链不同时间窗，不直接拼表，差值记方差。

## 分数（2026-09-23）

| 页面 | 端 | Perf | A11y | BP | SEO | LCP | FCP | TBT | CLS | finalUrl |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | desktop | 99 | 100 | 96 | 100 | 0.9s | 0.29s | 0 | 0 | `/` |
| `/` | mobile | 86 | 100 | 96 | 100 | 4.2s | 1.06s | 0 | 0 | `/` |
| `/dashboard` | desktop | 99 | 94 | 96 | 100 | 0.8s | 0.29s | 0 | 0.001 | `/login?from=/dashboard`（会话门，by-design） |
| `/dashboard` | mobile | 88 | 94 | 96 | 100 | 3.9s | 1.06s | 3ms | 0 | 同上 |

## 扣分点（观察，非新痛）

- login 页 a11y 94：`target-size=0`（移动端点按目标）＋`landmark-one-main=0`（主地标）——P3 polish 建议，不新开 ID（F1-01 已关门且 scope 为当时全仓；若修则独立一卡）。
- BP 96：`inspector-issues=0`（第三方 Cookie 废弃等控制台 issue，良性传闻面）。
- mobile LCP 4.2s／3.9s 为 MotoG4 模拟节流值（lab 数据）， ahead of 1032KB 传输线评估（`perf:assert` 仍在位，见 PAIN_REGISTER_V10 §P）。

## 门禁 влиять

- 本卡零源码改动；`npm run lint` sanity（本卡唯一门禁动作，见 §4 报告）；test／build 沿用 U3 卡 EXIT=0（20 分钟内同树，md-only delta 不编译）。
- keyed：0。
