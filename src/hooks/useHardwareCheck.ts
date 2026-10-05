"use client";

import { useEffect, useRef, useState } from "react";
import { micConstraints } from "@/lib/audio/vad";
import { probeHardware } from "@/lib/interview/hardware-probe";

/**
 * The wizard's step-6 device check, moved out of src/app/setup/page.tsx so the
 * page is not 1500 lines with a microphone lifecycle inside it. The block is
 * verbatim, including the late-stream guard that stops a getUserMedia result
 * arriving after the candidate has left the step, and the level meter's own
 * failure path (an AudioContext that will not start must not report the
 * candidate's devices as broken).
 *
 * `enabled` is the page's `currentStep === 6`: the effect must not open a camera
 * or a microphone while the candidate is still filling in step 3.
 */
export function useHardwareCheck({ enabled }: { enabled: boolean }) {
  // Hardware check state
  const [micStatus, setMicStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [camStatus, setCamStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [networkStatus, setNetworkStatus] = useState<"checking" | "good" | "poor" | "offline">("checking");
  const [speakerTestPlaying, setSpeakerTestPlaying] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // F3-split-3 late-stream guard (mirrors M4/M5): if the step changes or
    // the page unmounts while getUserMedia is pending, the late stream is
    // stopped immediately instead of leaking a live track into /interview
    // (T2.6 handoff contention). Signed green — structural close, no behavior
    // change on the green path.
    let cancelled = false;
    if (!enabled) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setTimeout(() => {
        setMicStatus("idle");
        setCamStatus("idle");
      }, 0);
      return;
    }

    const testHardware = async () => {
      await Promise.resolve();
      setMicStatus("testing");
      setCamStatus("testing");
      setNetworkStatus("checking");
      
      // Network check
      if (!navigator.onLine) {
        setNetworkStatus("offline");
      } else {
        const conn = (navigator as unknown as { connection?: { rtt: number; downlink: number } }).connection;
        if (conn && (conn.rtt > 300 || conn.downlink < 1)) {
          setNetworkStatus("poor");
        } else {
          setNetworkStatus("good");
        }
      }

      const probe = await probeHardware(
        (constraints) => navigator.mediaDevices.getUserMedia(constraints),
        micConstraints()
      );
      if (cancelled) {
        probe.stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      setMicStatus(probe.mic);
      setCamStatus(probe.cam);
      if (probe.message) setErrorMessage(probe.message);
      if (!probe.stream) return;

      streamRef.current = probe.stream;
      if (videoRef.current) {
        videoRef.current.srcObject = probe.stream;
      }

      // The meter is decoration on top of a working microphone, so it gets its
      // own failure path: an AudioContext that will not start must not report the
      // candidate's devices as broken, which is what happened when it sat inside
      // the same try as getUserMedia.
      try {
        const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        setAnalyser(analyserNode);

        const source = audioContext.createMediaStreamSource(probe.stream);
        source.connect(analyserNode);
      } catch (err) {
        console.warn("Mic level meter unavailable:", err);
        audioContextRef.current = null;
      }
    };

    testHardware();

    return () => {
       cancelled = true;
       if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        // Cleared as well as closed: the next run of this effect reads the ref,
        // and closing an already-closed context rejects instead of no-oping.
        audioContextRef.current = null;
      }
    };
  }, [enabled]);

  return { micStatus, camStatus, networkStatus, speakerTestPlaying, setSpeakerTestPlaying, analyser, errorMessage, videoRef };
}

export type HardwareCheckState = ReturnType<typeof useHardwareCheck>;
