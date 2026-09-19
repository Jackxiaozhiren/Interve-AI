import { useEffect, useRef, useCallback } from "react";
import {
  vadStep,
  averageSpectrum,
  VAD_DEFAULTS,
} from "@/lib/audio/vad";
import { createMicAnalyser, type MicAnalyser } from "@/lib/audio/mic-analyser";

/**
 * A hook that listens to the microphone when the AI is speaking,
 * and triggers an interruption callback if the user speaks loudly enough
 * for a sustained period.
 *
 * F3-split-2: acquisition + analyser graph + disposal live in
 * `createMicAnalyser`; this hook keeps its rAF loop, generation
 * (late-stream) guard, vadStep state machine and callback ref
 * (behavior unchanged).
 */
export function useVADInterruption(
  isAiSpeaking: boolean,
  onInterrupt: () => void,
  threshold = VAD_DEFAULTS.threshold,
  consecutiveFramesRequired = VAD_DEFAULTS.consecutiveFramesRequired,
  deviceId?: string | null
) {
  const analyserRef = useRef<MicAnalyser | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const onInterruptRef = useRef(onInterrupt);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.dispose();
      analyserRef.current = null;
    }
  }, []);

  useEffect(() => {
    onInterruptRef.current = onInterrupt;
  }, [onInterrupt]);

  useEffect(() => {
    if (!isAiSpeaking) {
      cleanup();
      return;
    }

    let isInterrupted = false;
    // Generation guard (Phase 8): if the effect re-runs or unmounts while
    // getUserMedia is still pending, the late stream is stopped immediately
    // instead of leaking.
    let cancelled = false;

    const startVAD = async () => {
      try {
        // smoothing 0.4: barge-in wants fast attack (ambient uses 0.9).
        const mic = await createMicAnalyser({
          deviceId: deviceId ?? undefined,
          smoothingTimeConstant: 0.4,
        });
        if (cancelled) {
          mic.dispose();
          return;
        }
        analyserRef.current = mic;

        const { analyser, dataArray } = mic;
        let consecutiveHighVolume = 0;

        const checkVolume = () => {
          if (!isAiSpeaking || isInterrupted || cancelled) return;

          analyser.getByteFrequencyData(dataArray);
          const average = averageSpectrum(dataArray);

          const step = vadStep(consecutiveHighVolume, average, threshold, consecutiveFramesRequired);
          consecutiveHighVolume = step.consecutive;
          if (step.triggered) {
            isInterrupted = true;
            onInterruptRef.current();
          }

          if (!isInterrupted) {
            animationFrameRef.current = requestAnimationFrame(checkVolume);
          }
        };

        checkVolume();
      } catch (err) {
        console.warn("VAD failed to start (mic access denied or unavailable)", err);
      }
    };

    startVAD();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isAiSpeaking, threshold, consecutiveFramesRequired, deviceId, cleanup]);
}
