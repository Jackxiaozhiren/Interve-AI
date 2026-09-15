# MODEL_CARD — Interve AI inference components

> Phase 10 AI governance. Facts only; no capability claims beyond verified use.

## 1. Dialogue & evaluation (cloud LLMs, user content leaves the device)

| Model | Vendor / access | Used for | Notes |
|---|---|---|---|
| `glm-4.7-flash` | Zhipu BigModel, OpenAI-compatible endpoint | Long/complex interviews + evaluations (cost-aware routing) | Thinking mode injected server-side; 65k max tokens |
| `glm-4-flash` | Zhipu BigModel | Default interviews, evals, fallback tier | Primary fallback target |
| `glm-4v-plus` / `glm-4v-flash` | Zhipu BigModel | Whiteboard diagram review / document OCR fallback | `data:image/*` URLs only; remote-URL fetch refused |
| `gemini-2.5-flash` | Google AI | Alignment, code review, practice grading, JD parsing | Canonical id without `models/` prefix |
| `gemini-1.5-pro` / `gemini-1.5-flash` | Google AI | Legacy interview-chat/copilot fallbacks | Retained for compatibility |
| `gpt-4o` / `gpt-4o-mini` | OpenAI | Optional user-selected fallback | Requires user key; absent by default |

All cloud calls pass through the Phase 2 API gate (auth, Zod validation,
byte caps, per-IP rate limits, request IDs) and the Phase 5 provider
registry (single construction site, explicit retry budgets). No training
or fine-tuning is performed by this project; model behavior is steered by
versioned prompts (`src/ai/prompts/`) and fixed rubrics (`src/ai/rubrics/`).

## 2. On-device models (nothing leaves the browser)

| Model | Runtime | Used for |
|---|---|---|
| `Xenova/whisper-base` | `@huggingface/transformers`, WebGPU→WASM fallback | Local speech-to-text |
| `onnx-community/Kokoro-82M` (q8, `af_heart`) | `kokoro-js` | Local English TTS (Chinese routes to OS voices) |

## 3. Explicit non-models (heuristics, labeled as such)

- Energy-threshold VAD (barge-in), silence/filler counters, WPM arithmetic.
- Difficulty adaptation rules, STAR keyword checks in prompts.
- None of these is presented as emotion, personality, or ability measurement.

## 4. Known limits

- No calibration of LLM scores against human raters yet (tracked: eval harness).
- Prompt U+FFFD corruption in `interview-system 1.0.0` preserved byte-for-byte pending measured repair.
- Gemini `models/`-prefix canonicalization verified by docs, pending keyed runtime proof.
