"use client";

/* eslint-disable react-hooks/immutability, react-hooks/refs --
   These hooks deliberately operate on refs owned by the caller: the room shares
   one MediaRecorder / Worker instance across slices, so the ref object is a
   handle, not immutable state. React's own ref contract allows writing
   `.current` outside render; the compiler rule assumes hook arguments are
   immutable, which is not true for refs by design. Every write below happens in
   an event handler or an effect, never during render. */

import { toast } from "sonner";
import { micConstraints, getPreferredMicDevice } from "@/lib/audio/vad";
import { decodeRecordingToMono16k } from "@/lib/audio/decode-recording";
import { computeWpm, countFillers } from "@/lib/interview/delivery-metrics";
import { startSpeechSession, type SpeechRecognitionLike, type WindowWithSpeech } from "@/lib/interview/speech-session";
import { useInterveStore } from "@/store/useInterveStore";

/**
 * S4 slice 8: the recording loop. startRecording/stopRecording moved verbatim
 * from page.tsx, together with the recorder refs they own (mediaRecorder,
 * audioChunks, speechRecognition). The page still owns playback because
 * stopAiPlayback is shared with the barge-in path.
 *
 * Every state writer is injected rather than reached through a store: the
 * delivery numbers (wpm, fillers) live in page state today, and a slice that
 * silently forked them would pass its type check and break the report.
 */
export function useRecordingLoop(opts: {
  stopAiPlayback: () => void;
  setActiveStream: (s: MediaStream | null) => void;
  setRecordingStartTime: (n: number | null) => void;
  setIsRecording: (b: boolean) => void;
  setActiveUserTranscript: (s: string) => void;
  setWpm: (n: number) => void;
  setFillerWordsCount: (n: number) => void;
  setModelStatus: (s: string) => void;
  telemetry: {
    recordingStartTimeRef: React.RefObject<number | null>;
    deliveryLedgerRef: React.RefObject<{ beginAnswer: () => void; provisionalFromDraft: (d: string) => number }>;
    lastSpeechTimeRef: React.RefObject<number>;
    sttSessionRef: React.RefObject<ReturnType<typeof import("@/lib/audio/stt").createSttSession>>;
    unmountedRef: React.RefObject<boolean>;
    answerSegmentsRef: React.RefObject<{ startMs: number; endMs: number }[]>;
    whisperSpanRef: React.RefObject<{ start: () => void }>;
  };
  whisperWorker: React.RefObject<Worker | null>;
  mediaRecorder: React.RefObject<MediaRecorder | null>;
  audioChunks: React.RefObject<BlobPart[]>;
  speechRecognition: React.RefObject<SpeechRecognitionLike | null>;
}) {
  const {
    stopAiPlayback, setActiveStream, setRecordingStartTime, setIsRecording,
    setActiveUserTranscript, setWpm, setFillerWordsCount, setModelStatus,
    telemetry, whisperWorker,
    mediaRecorder, audioChunks, speechRecognition,
  } = opts;
  const {
    recordingStartTimeRef, deliveryLedgerRef, lastSpeechTimeRef,
    sttSessionRef, unmountedRef, answerSegmentsRef, whisperSpanRef,
  } = telemetry;
  const setCognitiveLoad = useInterveStore((s) => s.setCognitiveLoad);

  async function startRecording() {
    try {
      // Voice interruption: Stop AI speaking if user starts talking
      stopAiPlayback();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(getPreferredMicDevice()) });
      // F3-split-3 late-stream guard (mirrors M4/M5/M1): back-navigation
      // during the pending acquire must not leak a live track. Signed
      // green — structural close, recording path unchanged.
      if (unmountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      // One ledger per answer. Reset before the first engine can report so a
      // discarded (unmounted) start never burns the reset, and so a second
      // startRecording() inside the same mount cannot inherit the last
      // answer's committed total.
      deliveryLedgerRef.current.beginAnswer();
      setActiveStream(stream);
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      // SpeechRecognition for Real-time Telemetry & API Analysis.
      // Transcript assembly, the filler delta and the bounded network-reconnect
      // live in startSpeechSession so they can be tested without a real
      // window.SpeechRecognition; this call site only pushes React state.
      const SpeechRecognition = (window as unknown as WindowWithSpeech).SpeechRecognition || (window as unknown as WindowWithSpeech).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const session = startSpeechSession({
          create: () => new SpeechRecognition(),
          countFillers,
          stt: sttSessionRef.current,
          onWarning: (message) => console.warn(message),
          onDraft: ({ draft, newFillers }) => {
            // Update speech time to avoid silence penalty
            lastSpeechTimeRef.current = Date.now();
            setCognitiveLoad(prev => Math.max(0, prev - 1)); // Active speaking slightly reduces load

            if (recordingStartTimeRef.current) {
              const durationMinutes = (Date.now() - recordingStartTimeRef.current) / 60000;
              const currentWpm = computeWpm(draft, durationMinutes);
              if (currentWpm !== null) setWpm(currentWpm);
            }
            setActiveUserTranscript(draft);

            // Provisional only: if this answer already committed via Whisper,
            // the ledger returns the committed total and this late browser
            // flush adds nothing.
            setFillerWordsCount(deliveryLedgerRef.current.provisionalFromDraft(draft));
            if (newFillers > 0) {
              // Phase 2: Voice Pattern Extraction (Hesitation)
              // Increase cognitive load significantly for repeated hesitation
              setCognitiveLoad(prev => Math.min(100, prev + newFillers * 5));
            }

            // Phase 3 (Truthfulness Reset): the chunk-analysis endpoint
            // response had no consumer while burning provider quota on every
            // final chunk; the call stays removed. See TRUTHFULNESS_REPORT.
          },
        });
        speechRecognition.current = session.recognition;
      }

      mediaRecorder.current.onstop = async () => {
        // Clean up mic stream
        stream.getTracks().forEach(track => track.stop());
        if (unmountedRef.current) return;
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setModelStatus("正在识别语音...");

        // decodeRecordingToMono16k closes its own AudioContext and reports
        // failure as null, so neither a too-short recording nor the browser's
        // live-context cap can leave this status on screen forever — which is
        // what an uncaught rejection in this async handler used to do.
        const AudioContextCtor = window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const samples = AudioContextCtor
          ? await decodeRecordingToMono16k(blob, AudioContextCtor)
          : null;

        if (unmountedRef.current) return;
        if (!samples) {
          // Idle, not "listening": the recorder has stopped and the mic tracks
          // are closed, so claiming to be listening would be its own small lie.
          setModelStatus("");
          if (blob.size > 0) {
            toast.error("语音转写未完成", {
              description: "录音解码失败，可直接输入回答，或再答一次。",
              duration: 6000,
            });
          }
          return;
        }

        whisperWorker.current?.postMessage({
          type: 'transcribe',
          audio: samples
        }, [samples.buffer]);
        // Phase 13: STT latency = post → complete turnaround.
        whisperSpanRef.current.start();
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      const now = Date.now();
      recordingStartTimeRef.current = now;
      setRecordingStartTime(now);
      setModelStatus("正在倾听...");
      toast("开始录音", { description: "请开始您的回答", duration: 2000 });
    } catch (err) {
      console.error("Mic access denied:", err);
      setModelStatus("未获得麦克风访问权限。");
      toast.error("麦克风访问被拒绝", { description: "请在浏览器设置中允许麦克风权限" });
    }
  }

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      toast("录音已结束", { description: "正在分析您的回答...", duration: 2000 });
    }
    if (speechRecognition.current) {
      speechRecognition.current.stop();
    }
    // Phase 8: close the answer segment for duration analytics.
    if (recordingStartTimeRef.current !== null) {
      answerSegmentsRef.current.push({ startMs: recordingStartTimeRef.current, endMs: Date.now() });
    }
    setIsRecording(false);
    setRecordingStartTime(null);
    setActiveStream(null);
  };

  return { startRecording, stopRecording };
}
