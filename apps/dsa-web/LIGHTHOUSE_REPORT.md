# Lighthouse — dsa-web `/` (production `next start`)

- 时间：2026-09-14；页面：`http://localhost:3002/`；后端：未启动（骨架/错误态路径）
- 命令：`npx lighthouse http://localhost:3002/ --output=json --chrome-flags="--headless --no-sandbox"`

| Category | Score |
|---|---|
| Performance | **93** (≥85 ✅) |
| Accessibility | 100 |
| Best Practices | 96 |
| SEO | 100 |

结论：无需 `PERF_NOTE.md` 解释项。后续若接入真实大数据 preview，应复测 `/datasets/:id`。
