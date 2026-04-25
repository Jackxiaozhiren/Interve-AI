# 面试系统核心功能完善与性能优化 (Phase 3)

我们将基于上一阶段（架构优化与稳定性增强）的成果，进一步完善用户系统、知识库呈现、UI图表渲染以及边缘计算的性能监控。

## User Review Required

> [!IMPORTANT]
> 1. **认证系统结构化**：由于目前项目仍处于开发阶段且无真实后端用户数据库，我们将通过引入标准化的 `AuthContext` (React Context) 配合 `useAuth` 钩子来**模块化**当前的模拟认证。这将使得未来迁移到 `NextAuth.js` 或 `Clerk` 时，只需替换Context的实现即可，做到无缝切换。
> 2. **知识库内容渲染**：知识库页面将读取您在首页上传的简历和职位描述。当刷新页面且 Zustand 状态丢失时，会提示返回首页上传。

## Open Questions

> [!NOTE]
> 1. 认证成功后，您希望重定向到 `/dashboard` 还是之前被拦截的路径？（当前计划默认重定向到 `/dashboard`）
> 2. 对于性能监控，我们当前计划在控制台(Edge Server Logs)中打印 API 请求的耗时 (Latency)，是否需要在UI面板上也添加耗时展示？（当前计划仅后端日志打点）

## Proposed Changes

---

### Auth Integration (认证系统解耦与标准化)

为了解决前一次测试中发现的 **[P0] Auth Bypass** 漏洞，我们将创建一套基于 React Context 的可插拔式认证系统，包含严格的客户端路由守卫。

#### [NEW] `src/lib/auth-context.tsx`
- 创建 `AuthContext` 和 `AuthProvider`。
- 提供核心状态和方法：`user` (存储当前登录的用户信息), `login(email, password)`, `logout()`, `isLoading`。
- 状态持久化：为了方便演示和后续切换 `NextAuth`，我们初步采用 `localStorage` (存储一个 mock-token) 来维持登录状态。

#### [NEW] `src/components/auth/ProtectedRoute.tsx` (可选或在 Layout 中处理)
- 或者是创建一个 HOC / Wrapper，在页面加载时检查 `user` 状态。
- 若 `!user && !isLoading`，通过 `next/navigation` 的 `useRouter` 自动将用户重定向回 `/login`。

#### [MODIFY] `src/app/layout.tsx` & `src/components/providers.tsx`
- 在 `Providers` 组件中引入 `<AuthProvider>` 并包裹 `{children}`，让全站皆可访问 `useAuth` 钩子。

#### [MODIFY] `src/app/dashboard/layout.tsx`
- 接入 `useAuth` 钩子，并在未登录时触发 `router.push('/login')`，彻底封堵未授权访问。
- 将 Logout 按钮连接至 `useAuth().logout()`。

#### [MODIFY] `src/app/login/page.tsx`
- 替换现有的硬编码表单提交逻辑，调用 `login` 方法，并在成功后自动跳转到 `/dashboard`。
- 增加友好的加载动画和 Toast 提示。

---

### Knowledge Base (知识库功能开发)

将全局存储的简历、JD 和提取的技能点渲染到知识库面板。

#### [MODIFY] `src/app/dashboard/knowledge/page.tsx`
- 引入 `useInterveStore` 获取 `resumeText`, `jobDescription` 和 `topPredictions`。
- 如果存在数据：展示简历预览卡片、JD 目标以及 AI 提取的重点技能 (Skills & Topics)。
- 如果为空：保持现有的 Empty State，引导用户去首页创建新的面试上下文。

---

### UI Polish (UI细节打磨)

修复控制台 Recharts 由于容器高度未定导致的警告。

#### [MODIFY] `src/app/dashboard/report/[id]/page.tsx`
- 为 `RadarChart` 的 `ResponsiveContainer` 设置具体的 `height={280}`，或者确保父容器具有固定的 `height`（当前使用的是 `h-[280px]` 配合 `height="100%"`，部分版本可能触发警告，将显式修正高度设置策略）。

#### [MODIFY] `src/components/dashboard/SkillBreakdownChart.tsx` & `GrowthTrendChart.tsx`
- 替换 `height="100%"` 为具体的像素或安全比例，消除 "height is not a valid number" 警告。

---

### Performance Monitoring (性能监控)

为 Edge Runtime AI 路由添加耗时日志，便于监控。

#### [MODIFY] `src/app/api/analyze-trends/route.ts`
- 引入 `performance.now()` 测量 `generateText` 的调用耗时。
- 在响应头中加入 `X-Response-Time`。
- 在控制台打印 `[Performance] AI Trend Analysis took XXXms`。

#### [MODIFY] (若存在) `src/app/api/chat/route.ts` 或其他核心 AI 路由
- 同样增加执行时间的 Edge 日志，确保我们在 Vercel Logs 中能够精准评估各模型响应速度。

## Verification Plan

### Automated Tests
- TypeScript 编译无报错 (`npm run build`)。

### Manual Verification
- 访问 `/login`，模拟登录后检查是否正确跳转 `/dashboard`，并且注销功能正常。
- 首页上传简历后，进入 `Dashboard -> Knowledge Base` 查看数据是否准确渲染。
- 打开控制台，确认 `dashboard` 和 `report` 页面的图表渲染不再报 "Recharts Height Warning"。
- 在终端查看 API 被调用时的 `[Performance]` 日志输出是否正常。
