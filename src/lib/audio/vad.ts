// Phase 8: voice-activity detection primitives (19.1 barge-in).
//
// Energy-threshold VAD (not a model): triggers only after sustained loud
// frames, so TTS echo blips and key clicks don't interrupt. Pure + tested;
// hooks own the WebAudio lifecycle.

export const VAD_DEFAULTS = {
  threshold: 25,
  consecutiveFramesRequired: 5,
} as const;

export interface VadStep {
  consecutive: number;
  triggered: boolean;
}

/** One analyser frame: decay-or-accumulate consecutive over-threshold count. */
export function vadStep(
  prevConsecutive: number,
  average: number,
  threshold = VAD_DEFAULTS.threshold,
  required = VAD_DEFAULTS.consecutiveFramesRequired
): VadStep {
  if (average > threshold) {
    const consecutive = prevConsecutive + 1;
    return { consecutive, triggered: consecutive >= required };
  }
  return { consecutive: Math.max(0, prevConsecutive - 1), triggered: false };
}

/** Mean of a frequency-data array (0-255 spectrum). */
export function averageSpectrum(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / data.length;
}

/** Browser echo/noise suppression — applied to every mic acquisition. */
export const MIC_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const;

const MIC_DEVICE_KEY = "interve_mic_device";

/** Builds getUserMedia audio constraints (optional persisted device). */
export function micConstraints(deviceId?: string | null): MediaTrackConstraints {
  if (deviceId) {
    // `ideal` (not `exact`): prefer the device, never hard-fail without mic.
    return { ...MIC_CONSTRAINTS, deviceId: { ideal: deviceId } };
  }
  return { ...MIC_CONSTRAINTS };
}

export function getPreferredMicDevice(): string | null {
  try {
    return localStorage.getItem(MIC_DEVICE_KEY);
  } catch {
    return null;
  }
}

export function setPreferredMicDevice(deviceId: string): void {
  try {
    localStorage.setItem(MIC_DEVICE_KEY, deviceId);
  } catch {
    // storage unavailable — device selection simply won't persist
  }
}
