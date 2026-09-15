# AUDIO_REPORT (Phase 8 Gate)

> Conversational interview audio: barge-in that works, STT you can inspect,
> delivery numbers that are measured. No psychometric packaging.

## 1. Re-audit (19): pipeline as found → as left

| Stage | Before | After |
|---|---|---|
| Microphone | 3 concurrent `getUserMedia({audio:true})` (recorder/VAD/ambient), no echo cancellation, no device choice, GreenRoom fatal on denial | Same 3-stream topology (documented below) + `echoCancellation/noiseSuppression/autoGainControl` everywhere + persisted device select + GreenRoom retry |
| MediaRecorder | Tracks released per-recording; LEAK on unmount-mid-recording | Unmount teardown + `unmountedRef` guard in `onstop` |
| STT | Interim/final text only; confidence dropped; no reconnect handling; no stats | `SttSession`: partials/finals/confidence/lang-mix/reconnects; bounded (3×) auto-restart on `network` errors only |
| VAD/barge-in | Energy threshold, no pending-stream guard, TTS stops on trigger (worked) | Pure `vadStep` + generation guard; trigger counted as `interruptions`; same 25/5 thresholds (unchanged behavior) |
| TTS | Kokoro/native routing, stops on barge-in | Unchanged (startup-latency tracking needs keyed perf env — deferred) |
| Echo | None | Browser AEC via constraints; residual multi-stream risk documented |
| Device switching | None (toast on unplug only) | GreenRoom device picker (persisted); unplug toast pre-existed |
| Permission recovery | Fatal error panel | Retry button re-requests access |
| Delivery analytics | WPM + filler only, advice attributed nervousness/confidence | + interruptions, avg answer sec, round-trip ms, STT confidence/finals/reconnects; advice rewritten to observable language; unmeasured renders "—" |

## 2. Observable-only doctrine (19.3), enforced

Persisted `deliveryStats`: `{wpm, fillerWords, interruptions?, avgAnswerSec?, avgRoundTripMs?, sttAvgConfidence?, sttFinals?, sttReconnects?}` (all additive/optional). `summarizeDelivery` returns nulls, never guesses. DeliveryCoach copy attributes nothing to psychology; thresholds presented as conventional bands.

## 3. Deliberately NOT done (honest)

- **Single shared mic stream**: the correct architecture (one acquisition → Analyser taps + recorder) but a cross-cutting refactor of recorder/VAD/ambient/GreenRoom timing. Queued behind keyed e2e (needs real-device CI to prove no regressions). Triple-stream cost/echo documented.
- **pauseRatio**: needs VAD-integrated metering; a fake approximation was refused. Segments + interruptions give the honest subset.
- **TTS latency breakdown / echo measurements**: need keyed perf runs on real devices.

## 4. Verification

- `npm run verify` exit 0 (lint 0/0, tsc, vitest **158/158** — 17 new, build 36 routes).
- Keyless chrome e2e re-run at gate (GreenRoom bypass/device UI, interview flows).
- Static: no new `Math.random` in audio paths; no `{audio:true}` bare acquisitions remain (grep).
