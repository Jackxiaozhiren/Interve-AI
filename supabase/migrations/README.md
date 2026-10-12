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
   **状态：已确认未应用**——2026-10-12 读生产目录：7 张表全部仍带
   `Legacy anon unowned access FOR ALL TO anon USING (user_id IS NULL)`，包含本该被本文件
   关闭的 5 张内容表。本文件的 `DROP POLICY IF EXISTS` 按 003 的四个名字动手，而生产用的是
   另一个名字，所以旧版即便"执行成功"也关不掉任何东西；现已补上按谓词 drop + 残留计数 RAISE。
   **部署状态以 `docs/audit/anon-bridge-evidence.json` 为准，不以本文件为准**
   （`tests/unit/migration-order.test.ts` 会把两边的说法对齐，不一致就红）。
   仍有顺序约束：必须在 OAuth 登录路径真的能用之后再跑；
   否则演示登录用户会同时失去读写（fail-closed，不是危险，但等于历史/报告/回放不可用）。

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
