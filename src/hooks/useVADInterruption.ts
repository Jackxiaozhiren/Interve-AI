import { useEffect, useRef, useCallback } from "react";
import {
  vadStep,
  averageSpectrum,
  micConstraints,
  VAD_DEFAULTS,
} from "@/lib/audio/vad";

/**
 * A hook that listens to the microphone when the AI is speaking,
 * and triggers an interruption callback if the user speaks loudly enough
 * for a sustained period.
 */
export function useVADInterruption(
  isAiSpeaking: boolean,
  onInterrupt: () => void,
  threshold = VAD_DEFAULTS.threshold,
  consecutiveFramesRequired = VAD_DEFAULTS.consecutiveFramesRequired,
  deviceId?: string | null
) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const onInterruptRef = useRef(onInterrupt);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(deviceId ?? undefined) });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;

        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
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
