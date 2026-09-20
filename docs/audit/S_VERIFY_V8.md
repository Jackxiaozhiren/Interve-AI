# S_VERIFY_V8 — S lane 被动复验（只读，HEAD b6c3127）

> 动机：并行方连推安全敏感提交（guard/health/orama/CSP 相关），本 session 独立重扫十项＋供应链，确认无新口子。**零源码改动**。
> Skills：`security-review`（被动）＋ `security-best-practices`（Next server＋React frontend 双 reference，只读）。

## 十项（2026 编号律）

| # | 结论 | 证据 |
|---|---|---|
| LLM01 注入 | 守住。vision 仍仅 `data:image/*`；注入条款＋fixtures 未动 | `analyze-vision/route.ts:22`（静态） |
| LLM02 披露 | 守住。health 双探针后仍只记 class（`db_degraded`），无 error 文本；csp-report 恒 204 面未动 | `health/route.ts:61-68`（实测读码） |
| LLM03/06 Agency/Unbounded | 增强且 sound。手写 `combineSignal`：clearTimeout＋unref 守卫＋`once:true`＋预 abort 处理，无泄漏向量；practice 45s 预算在位 | `guard.ts:43-63,145`（实测读码） |
| LLM04 供应链 | 零漂移。audit 37（1 low/31 mod/5 high，0 critical），`--audit-level=critical exit 0`；tiptap HIGH×2 仍为 P2-04 接受态；DOMPurify advisory 为传递依赖，`src/` 零引用 | `npm audit` 实测＋`grep dompurify` 零命中（静态） |
| LLM05 投毒 | 未动（白名单 `normalizePracticeDrills` 沿用 V6，传闻） | — |
| LLM07 误导 | 未动（evidence 信封沿用，传闻） | — |
| LLM08 隐藏上下文 | 未动；其在制品 `parse-resume` diff 经只读审查仅为类型声明改写（`@ts-expect-error` 删除＋v2 形 `PDFParse` 类），5MB 门＋SVG 拒＋白名单逻辑零触及 | `git diff -- parse-resume/route.ts pdf-parse.d.ts`（实测） |
| LLM09 向量 | pin 常绿（abuse＋isolation 8/8，§4-4 子集内） | 实测 |
| LLM10 输出处理 | 槽位仍 2＋1（escape-at-sink＋纯静态＋注释）；**新增观察见 P3-04** | `message-card.tsx:155` 等（静态） |

## 前端 spec 规则抽查

- REACT-XSS-001/002：无新增 `dangerouslySetInnerHTML`；无 `innerHTML/document.write` 汇点（静态）。
- REACT-AUTH-001：`localStorage` 仅存 UI 展示副本（id/email/username/avatar），authority 为 HttpOnly HMAC cookie（`AuthContext.tsx:15-34` 注释即契约）。干净。
- REACT-POSTMSG-001：仅同源 worker 生命周期消息（whisper/kokoro `load/dispose`），无 `window.postMessage(*)`（静态）。
- NEXT-CACHE-001：`force-static/use cache/unstable_cache` 仍零命中（静态）。
- NEXT-INJECT-002/密钥：`exec/spawn` 零命中；`sk-proj-/sk-ant-/NEXT_PUBLIC_SECRET` 零命中；`service_role` 仅 `health/route.ts:31` 禁区注释（静态）。

## 新增观察 PAIN-P3-04（code-runner 纵深，accepted-risk）

- 事实：`useCodeExecutor.ts:54` `new Function(e.data.code)()`，调用方唯一 `TechnicalScratchpad.tsx:329`（Monaco 手输＋明确点击 Run 才执行），Worker 内无 DOM（`useCodeExecutor.ts:43-67`），3s 超时熔断（`:70-82`）。自 V1 初 commit 存在（`cf000ec`），V6 漏扫未覆盖。
- 定级 P3：利用需受害者亲手粘贴＋运行恶意代码（self-XSS 类）， Worker 隔离＋手势门＋超时三重收敛。
- 加固 notes（不动码，仅记录）：① Worker 可 `fetch`——enforcing CSP 落地时（P1-04）记得 `worker-src/connect-src`；② 若将来出现“AI 生成代码一键运行”链路，需重评为 P1（当前 AI 路由只产评估文本，无此链路，静态确认）。

## 门禁/账本

- `npm audit` 37 零漂移＋critical exit 0（实测）；`dangerouslySetInnerHTML` 等 grep 面与 §3 一致。
- 套件数沿用 §4-4 同 HEAD 实测（50/369＋e2e 1×2＋build 44/44）；本卡零改动，无需重跑。
- keyed：0（全程 keyless，无 spend）。
