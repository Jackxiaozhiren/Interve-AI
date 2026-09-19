import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { averageSpectrum } from "@/lib/audio/vad";
import { createMicAnalyser, type MicAnalyser } from "@/lib/audio/mic-analyser";

/**
 * A hook that monitors background noise levels and warns the user if it's too high.
 * Best used when the user is not actively speaking to detect ambient baseline noise.
 *
 * F3-split-1: acquisition + analyser graph + disposal live in
 * `createMicAnalyser`; this hook keeps its rAF loop, late-stream guard,
 * threshold and toast (behavior unchanged).
 */
export function useAmbientNoise(
  isActive: boolean,
  threshold = 15,
  consecutiveFramesRequired = 180 // ~3 seconds at 60fps
) {
  const analyserRef = useRef<MicAnalyser | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasWarnedRef = useRef(false);

  useEffect(() => {
    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.dispose();
        analyserRef.current = null;
      }
    };

    if (!isActive) {
      cleanup();
      // reset warning state when toggled off so it can warn again next time it's active
      hasWarnedRef.current = false;
      return;
    }

    let isMonitoring = true;

    const startMonitoring = async () => {
      try {
        // High smoothing to detect sustained ambient noise rather than sharp peaks
        const mic = await createMicAnalyser({ smoothingTimeConstant: 0.9 });
        if (!isMonitoring) {
          mic.dispose();
          return;
        }
        analyserRef.current = mic;

        const { analyser, dataArray } = mic;
        let consecutiveHighVolume = 0;

        const checkVolume = () => {
          if (!isMonitoring) return;

          analyser.getByteFrequencyData(dataArray);
          const average = averageSpectrum(dataArray);

          if (average > threshold) {
            consecutiveHighVolume++;
            if (consecutiveHighVolume >= consecutiveFramesRequired && !hasWarnedRef.current) {
              hasWarnedRef.current = true;
              toast.warning("检测到环境噪音较高", {
                description: "高环境噪音可能会影响语音识别。为了获得最佳体验，请考虑移步到更安静的环境。",
                duration: 6000
              });
            }
          } else {
            // Decay consecutive count slowly so intermittent noise builds up
            consecutiveHighVolume = Math.max(0, consecutiveHighVolume - 0.5);
          }

          animationFrameRef.current = requestAnimationFrame(checkVolume);
        };

        checkVolume();
      } catch (err) {
        console.warn("Ambient noise monitor failed to start", err);
      }
    };

    startMonitoring();

    return () => {
      isMonitoring = false;
      cleanup();
    };
  }, [isActive, threshold, consecutiveFramesRequired]);
}
