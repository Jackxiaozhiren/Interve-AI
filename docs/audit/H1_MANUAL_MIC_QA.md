# H1 设备级手动 QA 脚本（真机 mic 流程，Phase H1.3）

> 前提（V4 H1.3）：e2e 覆盖不到 mic/audio；transport/recording/playback/analysis
> 拆分之前，先以本文档 checklist 在真机上建基线。拆分动手的入口条件：
> 本表在 2 台设备（桌面 Chrome + 移动 Safari/Chrome 各一）全绿一次。
> 全程 keyless，不耗 Gemini/Zhipu 额度（STT/LLM 步骤走 mock 或只验录音链路，见 T5）。

## T0 前置

- [ ] 真机 + 真 mic（禁虚拟音频线）；移动端用 Safari 与 Chrome 各测一次
- [ ] 站点经 HTTPS 或 localhost（`getUserMedia` 安全上下文要求）
- [ ] 浏览器 mic 权限重置为“每次询问”（验首次授权弹窗文案）
- [ ] 打开 DevTools→ Aisde，记录 console error 基线（0 新增为过）

## T1 权限与设备

| # | 步骤 | 预期 |
|---|---|---|
| T1.1 | 首次进 `/interview` 点开始，选“允许” | GreenRoom 电平条跳动，设备下拉出现当前 mic |
| T1.2 | 拒绝 mic 权限 | 出现文字绕行（text bypass）入口，不白屏不卡死 |
| T1.3 | 插拔耳机/切换输入设备 | 设备列表刷新，不掉已录片段 |
| T1.4 | 锁屏 10s 后回来（移动） | 录音会话可恢复或给出明确重试，不静默丢音 |

## T2 录制链路（三流并发：recorder + VAD + ambient）

| # | 步骤 | 预期 |
|---|---|---|
| T2.1 | 正常说话 60s | 波形/LiveStats WPM 推进，无回声啸叫（echo cancel 生效） |
| T2.2 | 静音 10s 再说话 | VAD 不误打断；AmbientNoise 不抢主 mic 独占 |
| T2.3 | 中英混读各 30s | STT 文本语言一致（ZH 浊音/EN Kokoro 分流正确） |
| T2.4 | 通话中接系统电话/切后台再回 | 会话 bounded-restart，不 triple-hold（单 mic 持有） |

## T3 打断与播报（barge-in）

| # | 步骤 | 预期 |
|---|---|---|
| T3.1 | TTS 播报时开口说话 | 播报立即停（barge-in stop），不叠音 |
| T3.2 | 连续打断 3 次 | 每次都停播，无 TTS 队列堆积 |

## T4 结算与回放

| # | 步骤 | 预期 |
|---|---|---|
| T4.1 | 结束面试进 report | Delivery 区 STT/LLM/TTS 延迟四项有数或明确 null（永不编数） |
| T4.2 | replay 页拖 Timeline | 音频与事件对齐 seek，无串 session（`persistenceKey` 隔离） |
| T4.3 | 整场 localStorage 配额 | 5MB 上限内不抛未捕获异常（满额给出提示） |

## T5 零额度模式（默认）

- STT/LLM/Eval 不跑 keyed：`?testMode=true` 或 mock 链路只验录制/打断/结算 UI。
- 如需验真 Whisper/Kokoro 下载：记包体（worker 数百 MB/82M）与耗时，不计入通过/失败。

## F3 刷新（2026-09-19，V5 Phase F3 文档先行步）

> 只补 evidence（代码锚点 + P1 探针），不改 T0–T5 结论。执行签字仍需真机人力（外部第③项）。

### mic 获取点地图（5 audio + 1 video，P1 多实例争抢面）

| # | 获取点 | 申请处 | 释放处 | 备注 |
|---|---|---|---|---|
| M1 | setup 设备检查（audio+video） | `src/app/setup/page.tsx:218` | `:180/:276` stop、`:184/:279` close | 进 interview 前必须释放，否则与 M3 争抢 |
| M2 | GreenRoom 预检（audio） | `src/components/interview/GreenRoom.tsx:36` | `:38/:93/:107/:119` stop、`:89/:104/:116` close | `?testMode=true` 跳过（`src/app/interview/page.tsx:101,135`） |
| M3 | interview 主录制（audio） | `src/app/interview/page.tsx:852` | `:816/:945` stop；AudioContext `:584/:951` 建、`:750` 关 | 与 M4/M5 三流并发（见 T2） |
| M4 | VAD 打断（audio） | `src/hooks/useVADInterruption.ts:59` | `:32/:61` stop、`:36` close；`:53` late-stream 防护 | 约束统一走 `micConstraints`（`src/lib/audio/vad.ts:48`） |
| M5 | 环境噪声（audio） | `src/hooks/useAmbientNoise.ts:46` | `:26/:48` stop、`:30` close | 只做电平，不管独占（T2.2 覆盖） |
| M6 | 自画面（video-only） | `src/components/interview/CameraSelfView.tsx:27` | `:29/:47` stop | 不争 audio，但占摄像头（移动端与 M1 video 互斥注意） |

### 新增 P1 探针（并入 T2 执行）

| # | 步骤 | 预期 | 锚点 |
|---|---|---|---|
| T2.5 | GreenRoom 点“进入”→interview 开始录音，全程 DevTools 查 `navigator.mediaDevices` 活跃流数 | 同一时刻仅 1 条 live audio track（M2 已释、M3 持有；M4/M5 若同持则记为争抢红） | M2→M3 交接 |
| T2.6 | setup 页做完设备检查后点“开始”（不刷新）进 interview | 无“设备忙/Device in use”异常；旧流已释（M1 释放先行） | M1→M3 交接 |
| T2.7 | 录音中开第二 tab 同站再进 interview（或点浏览器 mic 图标看持有数） | 老 tab 收到 `ended`/明确提示，不双活静默录音 | 多实例争抢 P1 主项 |

## 记录表（签字即 H1.3 入口具备）

| 日期 | 设备×浏览器 | 执行人 | 结果（绿/红+issue 链） |
|---|---|---|---|
| 2026-09-19 | 桌面 Chrome | jackson（用户自述） | 绿，无 issue |
| 2026-09-19 | 移动 Safari/Chrome | jackson（用户自述） | 绿，无 issue |
