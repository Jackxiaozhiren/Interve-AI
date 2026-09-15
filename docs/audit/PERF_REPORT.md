# PERF_REPORT (Phase 13 Gate)

> Measured on local prod build (`next build` + `next start`, Turbopack),
> desktop Chromium. Lab numbers carry ±5pt noise; treat gaps <5 as ties.

## 1. Lighthouse, public pages (CLI, desktop)

| Page | Perf | A11y | BP | SEO | LCP | Notes |
|---|---|---|---|---|---|---|
| `/` (before → after) | 86 → **92** | 85 → **100** | 100 | 80 → **100** | 4.2s → 3.5s | Meets all four targets |
| `/landing` | 86 | 95 | 100 | 100 | 4.2s | Perf 4 short (decor, see §3) |
| `/login` | 89 | 96 | 100 | 100 | 3.8s | Perf 1 short (decor LCP) |
| `/signup` | 88 | 100 | 100 | 100 | 3.9s | Perf 2 short (decor LCP) |

Fixes that moved numbers (all safe, verified by rebuild + e2e):
- Root `metadata` (title + description): fixed document-title +
  meta-description on every page (SEO 80→100).
- Secondary text `#86909C` (3.24:1) → `#5B6472` (5.98:1, computed):
  fixed all color-contrast failures; audited dark-surface usages (none).
- Footer/landing `h4`→`h3`, icon-link `aria-label`s: heading-order +
  link-name fixed (shared Footer fix covers `/` too).
- Timestamp color in chat demo → secondary.
- Removed 1s entrance animation from LCP elements (hero, auth cards):
  Perf 86→92 on `/`.
- tldraw (~1MB+) + scratchpad wrapper → `next/dynamic ssr:false`
  (drawer-gated; interview initial transfer 1032KB, was larger).
- Turbopack already optimizes imports (`optimizePackageImports` is a
  webpack-only knob per official docs — deliberately NOT added).

## 2. Guarded pages (`scripts/perf-probe.mjs`, signed session, prod)

| Page | FCP | CLS | TBT | Transfer | Heap |
|---|---|---|---|---|---|
| `/setup` | 136ms | 0 | 0 | 398KB | 10MB |
| `/dashboard` | 148ms | 0 | 0 | 701KB | 11MB |
| `/interview` (testMode) | 184ms | 0 | 0 | 1032KB | 14MB |
| `/practice` | 92ms | 0 | 0 | 470KB | 11MB |

LCP null in probe (headless entry timing gap) — Lighthouse-with-cookie
measured instead: dashboard Perf **78** (LCP 6.0s), setup **89**,
interview run crashed twice in Lighthouse trace-engine (tool limit,
recorded; probe numbers above stand in).

## 3. Why dashboard/login/signup miss Perf 90 (honest)

Single driver: the full-viewport decorative system (100px+ blurred
mix-blend blobs + SVG noise, `GlobalBackground`) is the LCP element on
every page (89% render-delay share). Altering it is a visual-design
decision, not an engineering patch — left untouched deliberately.
Tracked optimizations: static decor snapshot, reduced-motion default,
per-route decor opt-out, provider-chain deferral. TBT≈0 and CLS=0
everywhere show interaction health is already good.

## 4. AI latency breakdown (31) — now recorded per interview

- **STT latency**: Whisper post→complete turnaround (local model).
- **LLM TTFT**: submit→streaming transition (stream-start ≈ first token).
- **Follow-up latency**: covered by send→complete round trip (includes
  generation); server per-call latency already in structured logs.
- **TTS startup**: speak()/generate→first-audio, both engines.
- **Evaluation latency**: server `analyze-interview` log line (pre-existing).
- Averages persist on `deliveryStats` (`ttftMs/whisperMs/ttsStartupMs`,
  undefined when unmeasured) and render in the report Delivery section.
  Live values need keyed runs — first real numbers arrive with nightly
  evals, not guessed here.
