import { useEffect, useRef, useCallback } from "react";

/**
 * A hook that listens to the microphone when the AI is speaking,
 * and triggers an interruption callback if the user speaks loudly enough
 * for a sustained period.
 */
export function useVADInterruption(
  isAiSpeaking: boolean,
  onInterrupt: () => void,
  threshold = 25,
  consecutiveFramesRequired = 5
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

    const startVAD = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
          if (!isAiSpeaking || isInterrupted) return;

          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;

          if (average > threshold) {
            consecutiveHighVolume++;
            if (consecutiveHighVolume >= consecutiveFramesRequired) {
              isInterrupted = true;
              onInterruptRef.current();
            }
          } else {
            consecutiveHighVolume = Math.max(0, consecutiveHighVolume - 1);
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

    return cleanup;
  }, [isAiSpeaking, threshold, consecutiveFramesRequired, cleanup]);
}
