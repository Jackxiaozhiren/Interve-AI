# AI_ARCHITECTURE_REPORT (Phase 5 Gate)

> Provider centralization + versioned prompt registry + mock tier.
> Behavior-preserving refactor: no prompt/model/output-shape changes
> (one documented canonicalization below). Verified by contract tests.

## 1. Provider layer (`src/ai/providers/`)

- **registry.ts** (single construction site): `MODEL_IDS` (9 canonical ids),
  singleton `zhipu()` / `google()` / `openai()`, one `thinkingFetch` injector
  (was copy-pasted in 4 routes), `DEFAULT_MAX_RETRIES=2` /
  `FALLBACK_MAX_RETRIES=1`, `resolveChatModel` / `resolveCopilotModel`
  (previously divergent openai/gemini branches), `resolveCostAwareModel` /
  `resolveInterviewModel` (previously triplicated length routing).
- **fallback.ts**: `withModelFallback()` — primary→single-flash-fallback with
  uniform logging + `x-fallback` marking. Adopted by `analyze-interview`;
  `interview-chat` keeps its explicit streaming fallback (header logic).
- **mock.ts**: `AI_MOCK=1` (disabled in production by construction) returns
  canned payloads AFTER the auth/rate-limit/validation gate — auth semantics
  preserved (anonymous still 401). JSON mocks validate against the routes'
  own output schemas (contract tests); stream mocks return `text/plain`,
  transport-compatible with `toTextStreamResponse` consumers.
- Static guard (`ai-registry.test.ts`): no route may contain `createOpenAI(`,
  direct `@ai-sdk/google` imports, hardcoded model ids, or skip the mock
  hook. Verified: 16/16 clean.

## 2. Prompt registry (`src/ai/prompts/`, 16 entries)

Every route prompt moved to `{id, version, build()}` modules; routes call
builders. Fidelity checks:
- interview-chat: machine-checked 195 distinctive HEAD phrases — 174
  byte-identical; 21 absences all accounted for (Phase 3-deleted
  cognitive-load block + renamed locals). U+FFFD corruption sequences
  preserved byte-for-byte; a test locks them so repair requires deliberate
  action + eval measurement (tracked below).
- All other prompts: interpolation unit tests per builder + full diff
  review (route diffs are pure moves: 853+/886- across 16 files).

## 3. Output schemas exported (mock + eval-harness ready)

`Behavior/Star/Chunk/Code/Practice/Alignment/Match/ParseJd/InitContext/Hints/TrendsOutputSchema`
exported from their routes. Mock contract tests validate all 15 canned
payloads (+V2 mock) against these schemas — mocks cannot drift.

## 4. Deltas from HEAD behavior (exhaustive)

1. Gemini id canonicalization: `models/gemini-2.5-flash` → `gemini-2.5-flash`
   (parse-jd, practice). Per Google provider docs both forms resolve
   identically; keyed verification pending (no keys in this env).
2. `analyze-trends`/`init-context` confirmed callerless (dead endpoints);
   hardened + mocked uniformly, removal deferred to Phase 7 (needs product
   decision, not silent deletion).
3. Mock tier is ADDITIVE (env-gated, prod-disabled).

## 5. Known issues parked (not hidden)

- Interview prompt U+FFFD corruption: repair + before/after eval in Phase 6+.
- `analyze-chunk` sentiment endpoint fate (Phase 4 note stands).
- Multi-instance rate limits (Upstash), strict CSP allowlist, keyed
  provider verification.

## 6. Verification

- `npm run verify` exit 0 (lint 0/0, tsc, vitest **107/107** — 28 new,
  build 36 routes).
- Mock-mode integration tests hit real handlers end-to-end with zero keys
  (200 + `x-mock`, auth still enforced).
- Chrome e2e project re-run at gate (below).
