# H1 USE_CLIENT 审计清单（Phase H1.1，2026-09-18 keyless）

> 方法：`grep '"use client"' src/` + 逐路由读 page/layout 头三行。理由按“哪个 client-only 能力强迫 client”记录。
> Server 自调 Route Handler 审计见 §3（0 违规，无需抽模块）。

## 1. 路由边界表（`src/app`）

| 路由 | 形态 | 强迫 client 的理由 |
|---|---|---|
| `/landing` | **Server（H1.1 改）** | 全静态；交互岛全是 client 组件（TopNav/NavLink/Button/MessageCard） |
| `/` | Client（defer，见 §4） | 内联 `document.getElementById().scrollIntoView` handler 传给 client  nav——Server 不能传函数，需先抽 `HomeNav` 岛 |
| `/login`、`/signup` | Client | `LoginForm`：`useAuth` + `useRouter`/`useSearchParams` + password show-state |
| `/setup` | Client | wizard state + `fetch(/api/analyze-alignment, /api/parse-resume)` + PDF 解析 |
| `/practice` | Client | Dexie 读 + 本地 state |
| `/practice/[id]/page` | **Server + `client.tsx` 岛（全站参照）** | `generateStaticParams` + `await params`；交互全在 client 岛 |
| `/interview` | Client | mic/camera/workers/VAD/TTS + transport snapshot + 15+ 本地 state（God，H1.3 只补 QA 不拆） |
| `/chat` | Client | `useChat` + transport `useMemo` + 流式 state |
| `/dashboard/layout` | Client（defer，见 §4） | `useAuth` 门 + `usePathname` 导航高亮 + modal context state + framer-motion |
| `/dashboard/page` 及子路由 | Client | Dexie 聚合 + charts（recharts 需 DOM）+ modal/keyboard 交互 |
| `/recruiter*` | Client | Mock 表单 state + `fetch(/api/parse-jd)` |
| `loading.tsx` / `template.tsx` / `error.tsx` | Client | framer-motion / error boundary 语义（Next 要求 error 为 client） |
| `not-found.tsx` | Client（可后动） | 仅 Links+icons，理论可 Server；本次不动（Lighthouse 非守卫路由，小步排后） |
| `layout.tsx`（root） | Server（保持） | 仅 metadata + Providers（client 岛在内） |

原子层：`interve-ui/*`、`ui/*`、`data/*`、`interview/*` 全 client——理由：motion/DOM/浏览器 API；`Footer`、`home/HeroSection` 等 6 个 home section（除 `StatsStrip`）为 Server，可被 Server 页直接引用。

## 2. H1.1 改动

- `src/app/landing/page.tsx:1`：删 `"use client"` + 注 island 关系。子组件全 client islands，无 handlers 穿透，零行为变更。

## 3. Server 自调 Route Handler 审计：0 违规

`fetch("/api/…")` 全部位于 client 文件（抽查）：
`AuthContext.tsx:20,84`、`interview/page.tsx:459,635,677`、`Navbar.tsx:27`、
`practice/[id]/client.tsx:71`、`setup/page.tsx:307,357`、`CopilotPanel.tsx:41`、
`assessments/page.tsx:30`、`TechnicalScratchpad.tsx:173`、`SystemDesignBoard.tsx:102`、
`useInterviewSettlement.ts:68`、`KnowledgeMatchLoader.tsx:16`。
Server 文件（`layout.tsx`、`practice/[id]/page.tsx`）零 `fetch(/api`。结论：无需抽共享模块。

## 4. 有意不动 + 依据

- `/` Server 化：需先抽 `HomeNav` client 岛（含 4 个 scroll handler），与 landing 同模式但多一个新文件；本阶段只做 landing 试点，`/` 列下一小步（H1 收尾或 H2 前）。
- `dashboard/layout` 拆分：E3 已 defer（auth 门 + pathname + motion 确需 client）；正确拆法是抽 `DashboardNav`（pathname 岛）+ `AuthGate`（useAuth 岛）+ modal context 岛，留待独立小步（动 auth 门需 e2e 全回归）。
- 手动 memo：零改动（编译器纯度律——无 Profiler 数据不动，见 H1.2）。

## 5. H1.2 Compiler 化（keyless 取证，无改动）

- 开关：`next.config.ts:1-41` 无 `reactCompiler` 键 = **OFF**。本地 Next 16.3.5 文档（`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactCompiler.md`）确认 stable 但默认关闭，需显式 opt-in。有意不开：开启即全量重编译行为变更，无 Profiler 基线时违反纯度律。
- memo 审计：`useMemo/useCallback/memo(` 共 42 处（dashboard 聚合、chat transport、40+ 可视化 `React.memo`）。无 Profiler 实测 → 全部保留（删 memo 在 Compiler OFF 时是纯回归风险）。
- 表单：`useActionState/useOptimistic/useFormStatus` 在 `src/` 零命中。试点评估：`LoginForm` 系 auth-critical（不可做试点）；settings 系即时持久化 toggles（转 server action 加延迟零收益）。结论：本阶段不试点，试点候选（非关键、 peak 简单）留待 H1 收尾小步。

## 6. H1.4 设计品质（无代码改动，依据）

- 视觉 POV（Luminous Light，不平均化）：`/`=营销叙事（hero→features→demo→stats→pricing→about→cta）；`/landing`=招聘侧精简版；dashboard=控制台 bento（Total/Avg/Latest + Growth/Radar + Telemetry）；interview=沉浸深色排练场；practice=题库练习；settings=偏好表单。每路由已有独立 POV，不做视觉改动。
- CSP：`src/proxy.ts:95` enforcing（宽松，现行）+ `:114` report-only（严格）双轨；收紧 enforcing 以 report 流干净为准——无生产流量信号，本阶段不动。
- mobile 4x 探针：`scripts/perf-probe.mjs` 加 `--mobile`（390×844 + CDP 4x CPU 节流），`node --check` 过；实测数随门禁跑。
