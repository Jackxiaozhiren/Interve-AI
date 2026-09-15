# SECURITY_REPORT (Phase 12 Gate)

> Executable checklist results + documented exceptions (release gate
> permits Highs with written exceptions — each below states reachability).

## 1. Dependency audit

- Baseline (Phase 0): 62 vulns. After `npm audit fix`: **39 (1 low, 30
  moderate, 8 high, 0 critical)**. Critical (tar stack-overflow) eliminated.
- **Removed attack surface**: dead `lib/pdf-parser.ts` (zero callers) +
  `pdfjs-dist` (HIGH: JS execution on malicious PDFs) + shipped worker
  file + postinstall copy. Server parsing stays on `pdf-parse` behind
  5MB caps + OCR fallback.
- Remaining 8 highs — triaged, none reachable in production paths:
  - `next→sharp→libvips`, `sharp` direct, `onnxruntime-node→adm-zip`,
    `@huggingface/transformers→sharp`: image/ML-native chains. Our app
    aliases `sharp`/`onnxruntime-node` out of the browser bundle, never
    imports them server-side, and feeds no user images to `next/image`
    (single static logo). **Exception: upgrade with Next 16.3.4 lane**
    (non-major, contains sharp fix + serialize-javascript fix).
  - `pdfjs-dist`: REMOVED (see above).
  - `postcss` (sourceMappingURL traversal): build-time only; attacker
    cannot supply our CSS. **Exception: rides Tailwind/Next upgrades.**
  - `ws`/`uuid`/`nanoid`/`ip-address`/`fast-uri`/`browserslist`/
    `brace-expansion`/`js-yaml`/`protobufjs`: nested copies in
    dev/CLI/build tooling (mermaid, eslint, shadcn, workbox) or already
    fixed at top level (ws 8.21.3, uuid 14). Re-verify per release
    (`npm audit` is a documented release-gate step).

## 2. Secret scan

- Pattern scan (tracked tree): OpenAI/GH/AWS keys, private keys, JWTs —
  **0 hits**. `service_role`/hardcoded credentials — **0 hits**. No `.env*`
  files in repo (gitignored, verified). `.env.example` holds placeholders
  only. Server keys stay server-side (verified by import graph: no
  `process.env.ZHIPU/OPENAI` reads in client components).

## 3. SAST posture (honest)

- No dedicated SAST scanner runs in this environment (no CodeQL/Semgrep
  lane — tracked for CI). Equivalent enforced coverage TODAY: `tsc`
  strict (0 errors), ESLint incl. React-hooks rules (0/0), 16 POST-only
  route surface (static test), Zod I/O on every AI route, no
  `dangerouslySetInnerHTML` without review (message-card — tracked XSS
  hardening is Phase 13+ hardening? No: XSS sanitization tracked — see §6).

## 4. API abuse / upload / authorization tests (new)

- Gateway suite (`proxy-guard.test.ts`, 9 tests): anon redirect, forged
  legacy-cookie rejection, tamper rejection, header presence,
  interview preflight, `/api/*` 401 JSON, public passthrough, all
  AI-page guards, POST-only surface incl. session GET/DELETE allowlist.
- Upload extras: content-length lie (413 via either check), non-document
  MIME (400), SVG refusal (pre-existing, kept).
- Abuse extras: 429 asserts `Retry-After` + `x-request-id`.

## 5. Prompt-injection hardening (LLM01)

- `UNTRUSTED` fences + treat-as-data instructions added to the 5
  highest-exposure prompts (interview background, evaluation transcript,
  copilot snippets, match JD/resume, alignment resume/JD); prompt versions
  bumped (interview 1.2.0, copilot/match/alignment 1.1.0). Empty background
  emits no fences (no token waste). Effect measurement belongs to the
  keyed injection suite (Phase 11) — fences are reversible formatting.
- RLS live tests: BLOCKED (no docker daemon, no staging project) —
  static contract stands; live lane tracked since Phase 2 (unchanged).

## 6. Open items (not hidden)

- XSS output encoding for LLM markdown (`message-card`), strict CSP
  allowlist (drop `unsafe-inline`/`connect *`), Upstash rate limits,
  service-role-free RLS cutover, live RLS/IDOR tests, CodeQL/Semgrep lane,
  framework upgrade lane (Next 16.3.4).

## 7. Verification

- `npm run verify` exit 0 (lint 0/0, tsc, vitest **186/186** — 24 new,
  build 36 routes). Chrome e2e re-run at gate (proxy matcher touched).
