import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * A hook that monitors background noise levels and warns the user if it's too high.
 * Best used when the user is not actively speaking to detect ambient baseline noise.
 */
export function useAmbientNoise(
  isActive: boolean,
  threshold = 15,
  consecutiveFramesRequired = 180 // ~3 seconds at 60fps
) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasWarnedRef = useRef(false);

  useEffect(() => {
    const cleanup = () => {
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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMonitoring) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;

        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        // High smoothing to detect sustained ambient noise rather than sharp peaks
        analyser.smoothingTimeConstant = 0.9;

        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let consecutiveHighVolume = 0;

        const checkVolume = () => {
          if (!isMonitoring) return;

          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;

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
