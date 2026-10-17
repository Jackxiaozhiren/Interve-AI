# Supabase Migrations — 执行顺序与冻结声明（P2-03）

> 铁律：migration 只增不改旧文件 + rollback 头；破坏性变更走 expand-contract；
> 大表 `CREATE INDEX CONCURRENTLY`。本目录无例外。

## 执行顺序（SQL Editor 逐个 Run）

1. `001_init_schema.sql` —— **正典初始 schema**（7 表：assessments / achievements / evaluations / interviews / orama_index / practice_sessions / telemetry；BIGSERIAL 主键 + defaults/CHECKs + 11 indexes + open policies）。`scripts/verify-supabase-free.mjs` 与 `004` 的 USAGE 行均以它为准。
2. `002_session_ownership.sql` —— owner 列 + owner/anon bridge 策略（additive，幂等）。
3. `003_per_operation_policies.sql` —— 按操作拆分（与 002 等谓词，零行为变化）。
   **注意：本项目的生产库从未呈现过这个形状。** 2026-10-12 读 `pg_policies` 得到的是
   每表 2 条：`Owner full access`（`cmd=ALL`）与 `Legacy anon unowned access`（`cmd=ALL`），
   不是四条逐操作策略。也就是说 003 的产物在这个项目里并不存在，任何按 003 的策略名去
   判断"桥已关闭"的检查都会看错对象——`006` 因此改为按谓词 drop（见其文件头）。
4. `004_practice_evidence.sql` —— practice 证据信封列（additive + nullable）。
5. `005_interview_session_columns.sql` —— interviews 的 6 个应用已在写的列
   （interview_type / custom_type_description / difficulty / time_budget_sec / plan / evaluation_v2）。
   **状态：已应用**（2026-10-12 `information_schema.columns` 实测 6 列全部存在，
   与 2026-10-02 的 `select=<col>&limit=1` 只读探测一致）。本文件此前写的"未在任何环境
   应用 / 生产库这 6 列实测缺失（42703）"是 2026-09 的点位观测，已被上述两次实测推翻。
   仍然成立的告诫：`Legacy anon unowned access` 未关闭之前，owner 为 NULL 的行任何持
   publishable key 者都可读写（详见第 6 条与 `docs/audit/anon-bridge-evidence.json`）。
6. `006_close_anon_bridge_content_tables.sql` —— 关闭留给 5 张内容表
   （interviews / evaluations / practice_sessions / assessments / orama_index）
   的 anon 桥；telemetry 与 achievements 的桥
   **保留**（前者按可观测性规范不含 PII 且仍被 owner-binding 测试钉住，后者写入
   尚未做 owner 强制，先关会把可用功能变成静默失败）。
   **状态：已在生产应用**——2026-10-16 经 Supabase MCP `apply_migration` 跑在 project
   `bfgglzjltfvfpobzscet`（`success: true`）；随后 `scripts/sql/verify-anon-bridge.sql`
   的关闭校验返回空集，`pg_policies` 全量导出里 5 张内容表只剩 `Owner full access`
   （`cmd=ALL`、`roles={authenticated}`），anon 桥只剩 telemetry 与 achievements 两条。
   本文件此前写的"已确认未应用"是 2026-10-12 的观测，在那之前一直成立：旧版按 003 的四个
   名字动手，而生产用的是另一个名字，所以它即便"执行成功"也关不掉任何东西；补上按谓词 drop
   + 残留计数 RAISE（见文件头步骤 2 与 3）之后才真正关掉。
   **部署状态以 `docs/audit/anon-bridge-evidence.json` 为准，不以本文件为准**
   （`tests/unit/migration-order.test.ts` 会把两边的说法对齐，不一致就红；条数与采集时间
   也只在那份 artifact 里，这里不复制一份没人看的数字）。
   顺序约束已满足，不再是前提：OAuth 是登录页的主路径
   （`src/components/auth/LoginForm.tsx`，演示表单已标"不保存数据"），而这 5 张表自 002
   cutover 起就拒绝无 owner 的写入（`src/lib/api-client.ts` 的 `OWNER_REQUIRED_TABLES`
   抛 `NO_OWNER`，调用方降级为 local-only）。也就是说演示账号从来没有过可读的历史，关闭
   桥不会让任何现存活人失去读写。

## 冻结文件（只读，永不执行、永不编辑）

- `0001_initial_schema.sql`（88 行）—— 历史遗留的另一份初始 schema，
  与 `001` 同 7 表但**类型不兼容**（UUID vs BIGSERIAL；无 RLS/indexes；非幂等）。
  `001` 的 `IF NOT EXISTS` 修不了类型：在跑过任一初始的库上跑另一个
  会得到混血 schema。前端按数字 id 假设（`src/lib/db.ts:22`，`Interview.id?: number`）。
  保留仅为历史取证（`rls-policies.test.ts` 断言其存在），**新库一律从 `001` 起**。

## 新迁移 checklist

- 文件名递增（`005_*.sql` 起），头注释写 Intent + Rollback（参考 `002/003` 头）。
- 只增不改：不动 `0001/001/002/003/004` 任何一行。
- 先跑 `tests/integration/rls-policies.test.ts`（谓词等价），再跑全 `npm run test`。
