// F3-split-1: shared mic acquisition + analyser graph + disposal.
//
// M4 (`useVADInterruption`) and M5 (`useAmbientNoise`) grew identical
// lifecycles (getUserMedia → AudioContext → MediaStreamSource → Analyser →
// track-stop/context-close). This module owns that shared shape; hooks keep
// their rAF loops, late-stream guards, thresholds and toasts (behavior
// unchanged — see `docs/audit/H1_MANUAL_MIC_QA.md` T2.5–T2.7).
import { micConstraints } from "./vad";

export interface MicAnalyserOptions {
  deviceId?: string | null;
  fftSize?: number;
  smoothingTimeConstant: number;
}

export interface MicAnalyser {
  stream: MediaStream;
  ctx: AudioContext;
  analyser: AnalyserNode;
  // Sized from `analyser.frequencyBinCount`, hence ArrayBuffer-backed.
  dataArray: Uint8Array<ArrayBuffer>;
  dispose: () => void;
}

function resolveAudioContextCtor(): typeof AudioContext {
  const w = window as unknown as {
    AudioContext: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext || w.webkitAudioContext!;
}

export async function createMicAnalyser(options: MicAnalyserOptions): Promise<MicAnalyser> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: micConstraints(options.deviceId ?? undefined),
  });
  const Ctor = resolveAudioContextCtor();
  const ctx = new Ctor();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = options.fftSize ?? 512;
  analyser.smoothingTimeConstant = options.smoothingTimeConstant;
  source.connect(analyser);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stream.getTracks().forEach((t) => t.stop());
    if (ctx.state !== "closed") {
      ctx.close().catch(() => {});
    }
  };

  return { stream, ctx, analyser, dataArray, dispose };
}
