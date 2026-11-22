"use client";

/**
 * eslint-disable react-hooks/immutability, react-hooks/refs --
 * The unmount teardown writes the shared unmountedRef and recorder handles by
 * design; React's ref contract allows it outside render.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { ensureKnowledgeHub } from "@/lib/orama-client";
import { expertFromMessage } from "@/lib/interview/experts";
import { useAmbientNoise } from "@/hooks/useAmbientNoise";
import type { AIExpert } from "@/lib/interview/experts";
import type { SpeechRecognitionLike } from "@/lib/interview/speech-session";

/**
 * S4 slice 13: the room's lifecycle effects — loop bootstrap, knowledge-hub
 * restore, cognitive-load silence tracking, the persona announcement, the
 * transcript scroll anchor, ambient-noise monitoring and the unmount teardown.
 * Each effect moved verbatim; the page keeps the handlers they call.
 */
export function useRoomLifecycle(opts: {
  interviewIdParam: string | null;
  level: string;
  searchParams: URLSearchParams | null;
  initLoop: (level: string, o: { difficulty?: string; timeBudgetSec?: number }) => void;
  isRecording: boolean;
  isStandby: boolean;
  isAiSpeaking: boolean;
  isPaused: boolean;
  latestAiMessage: string;
  messages: { length: number };
  setActiveExpert: (e: AIExpert) => void;
  messagesEndRef: { current: HTMLDivElement | null };
  unmountedRef: { current: boolean };
  mediaRecorder: { current: MediaRecorder | null };
  speechRecognition: { current: SpeechRecognitionLike | null };
  lastSpeechTimeRef: { current: number };
  setCognitiveLoad: (updater: (prev: number) => number) => void;
  stopRecording: () => void;
  setInputText: (updater: (prev: string) => string) => void;
  inputRef: { current: HTMLInputElement | null };
}) {
  const {
    interviewIdParam, level, searchParams, initLoop,
    isRecording, isStandby, isAiSpeaking, isPaused,
    latestAiMessage, messages, setActiveExpert, messagesEndRef,
    unmountedRef, mediaRecorder, speechRecognition, lastSpeechTimeRef, setCognitiveLoad,
    stopRecording, setInputText, inputRef,
  } = opts;

  useEffect(() => {
    const budget = Number(searchParams?.get('timeBudgetSec'));
    initLoop(level, {
      difficulty: searchParams?.get('difficulty') ?? undefined,
      timeBudgetSec: Number.isFinite(budget) && budget > 0 ? budget : undefined,
    });
  }, [interviewIdParam, level, initLoop, searchParams]);

  useEffect(() => {
    // Restore the account's serialized index for copilot hints. No resume text is
    // known at this point, so a failed restore is not yet a dead end: the
    // load-interview effect below builds the index from the text it fetches. The
    // one outcome worth a console line is `memory-only`, because that session works
    // and the next page load will not.
    void ensureKnowledgeHub(null).then((outcome) => {
      if (outcome === "memory-only") console.warn("knowledge hub: this session only — the row was refused, so a reload starts empty");
    });
  }, []);

  // Cognitive Load Silence Tracking
  useEffect(() => {
    if (!isRecording) return;
    lastSpeechTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const timeSinceSpeech = Date.now() - lastSpeechTimeRef.current;
      if (timeSinceSpeech > 5000) { // 5 seconds of silence
         setCognitiveLoad(prev => Math.min(100, prev + 8)); // Increase load heavily for long awkward silences
         lastSpeechTimeRef.current = Date.now() - 2000; // Shift back so it continues incrementing if silence persists
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isRecording, setCognitiveLoad, lastSpeechTimeRef]);

  useEffect(() => {
    if (latestAiMessage) {
      // A reply that opens with no known label leaves the current persona alone.
      const announced = expertFromMessage(latestAiMessage);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (announced) setActiveExpert(announced);
    }
  }, [latestAiMessage, setActiveExpert]);

  // Phase 38: Ambient Noise Warning
  useAmbientNoise(!isStandby && !isRecording && !isAiSpeaking && !isPaused, 20, 180);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesEndRef]);

  // Text selection → composer. TextSelectionMenu dispatches `ask-ai` and this
  // is its only listener; it was dropped when the effects were lifted and CI's
  // selection arm caught the empty composer.
  useEffect(() => {
    const handleAskAI = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const text = customEvent.detail;
      if (text) {
        setInputText((prev) => prev ? `${prev} \n\n关于以下内容：\n"${text}"\n` : `关于以下内容：\n"${text}"\n`);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      }
    };

    window.addEventListener('ask-ai', handleAskAI);
    return () => window.removeEventListener('ask-ai', handleAskAI);
  }, [setInputText, inputRef]);

  // Phase 36: Device Disconnection Fallback
  useEffect(() => {
    const handleDeviceChange = () => {
      toast.error("Audio Device Changed", {
        description: "Your microphone or speaker was disconnected. We have paused the recording and fallen back to the default device.",
        duration: 8000
      });
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        stopRecording();
      }
    };
    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 8: release microphone tracks + recognizer if the user leaves
  // mid-recording (back navigation). onstop handlers check unmountedRef.
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      try {
        if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
          mediaRecorder.current.stop();
        } else {
          mediaRecorder.current?.stream.getTracks().forEach((t) => t.stop());
        }
      } catch { /* best-effort teardown */ }
      try { speechRecognition.current?.stop(); } catch { /* noop */ }
      try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
