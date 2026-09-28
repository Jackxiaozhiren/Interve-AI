# Supabase Migrations — 执行顺序与冻结声明（P2-03）

> 铁律：migration 只增不改旧文件 + rollback 头；破坏性变更走 expand-contract；
> 大表 `CREATE INDEX CONCURRENTLY`。本目录无例外。

## 执行顺序（SQL Editor 逐个 Run）

1. `001_init_schema.sql` —— **正典初始 schema**（7 表：assessments / achievements / evaluations / interviews / orama_index / practice_sessions / telemetry；BIGSERIAL 主键 + defaults/CHECKs + 11 indexes + open policies）。`scripts/verify-supabase-free.mjs` 与 `004` 的 USAGE 行均以它为准。
2. `002_session_ownership.sql` —— owner 列 + owner/anon bridge 策略（additive，幂等）。
3. `003_per_operation_policies.sql` —— 按操作拆分（与 002 等谓词，零行为变化）。
4. `004_practice_evidence.sql` —— practice 证据信封列（additive + nullable）。
5. `005_interview_session_columns.sql` —— interviews 的 6 个应用已在写的列
   （interview_type / custom_type_description / difficulty / time_budget_sec / plan / evaluation_v2）。
   **状态：已起草、未在任何环境应用**，且不可单独应用——生产库这 6 列实测缺失
   （`select=<col>&limit=1` → `400 42703`），补上后 email/密码路径写出的
   `user_id IS NULL` 行会落进 `003` 的 `Legacy anon select unowned`，变成任何持
   publishable key 者可读。先做 Supabase Auth cutover 或关闭该 anon bridge，再跑本文件。
   详见该文件头与 `docs/RELEASE_CHECKLIST.md`。
6. `006_close_anon_bridge_content_tables.sql` —— 关闭 003 为 5 张内容表
   （interviews / evaluations / practice_sessions / assessments / orama_index）
   留下的 `Legacy anon * unowned` 共 20 条策略；telemetry 与 achievements 的桥
   **保留**（前者按可观测性规范不含 PII 且仍被 owner-binding 测试钉住，后者写入
   尚未做 owner 强制，先关会把可用功能变成静默失败）。
   **状态：已起草、未应用**，且有顺序约束——必须在 OAuth 登录路径真的能用之后再跑；
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
