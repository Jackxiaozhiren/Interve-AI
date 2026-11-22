
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { createQuotaAwareTransport } from "@/lib/api/chat-transport";
import dynamic from "next/dynamic";
// Phase 13: drawer-gated heavies load on demand, not on first paint.
// tldraw (~1MB+) and the scratchpad wrapper only mount when opened.
const TechnicalScratchpad = dynamic(
  () => import("@/components/interview/TechnicalScratchpad").then((m) => m.TechnicalScratchpad),
  { ssr: false }
);
const SystemDesignBoard = dynamic(
  () => import("@/components/interview/SystemDesignBoard").then((m) => m.SystemDesignBoard),
  { ssr: false }
);
import { RoomStage } from "@/components/interview/RoomStage";
import { StarTracker } from "@/components/interview/StarTracker";
import { CopilotHints } from "@/components/interview/CopilotHints";
import { useKeyboardShortcuts, createCtrlCmdShortcut } from "@/hooks/useKeyboardShortcuts";
import { type AIExpert, expertFromMessage } from "@/lib/interview/experts";
import { DynamicLoader } from "@/components/ui/DynamicLoader";
import { getMessageText, getTextFromFinishEvent, toUiMessages } from "@/lib/message-text";
import { useInterveStore } from "@/store/useInterveStore";
import { useInterviewLoopStore } from "@/store/useInterviewLoopStore";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { loopBadge } from "@/lib/interview/difficulty-label";
import { createLatencySpan } from "@/lib/interview/latency";
import { describeApiFailure, readApiJson } from "@/lib/api/read-response";
import { useVADInterruption } from "@/hooks/useVADInterruption";
import { createSttSession } from "@/lib/audio/stt";
// Phase E1: pure slices extracted from this God component (unit-tested).
import { computeWpm, countFillers } from "@/lib/interview/delivery-metrics";
import { createDeliveryLedger } from "@/lib/interview/delivery-ledger";
import { createWhisperDispatch, createKokoroDispatch } from "@/lib/interview/engine-dispatch";
import { startSpeechSession, type SpeechRecognitionLike, type WindowWithSpeech } from "@/lib/interview/speech-session";
import { saveSession, loadSession, clearSession } from "@/lib/interview/session-persistence";
import { readDesignCanvas, readScratchpadCodeContext, readScratchpadContent } from "@/lib/interview/board-state";
import { THINK_TIME_SECONDS } from "@/lib/interview/think-time";
import { useInterviewSettlement } from "@/components/interview/useInterviewSettlement";
import { micConstraints, getPreferredMicDevice } from "@/lib/audio/vad";
import { decodeRecordingToMono16k } from "@/lib/audio/decode-recording";
import { FlowMap } from "@/components/interview/FlowMap";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { useAmbientNoise } from "@/hooks/useAmbientNoise";
import { useSendFailureRecovery } from "@/hooks/useSendFailureRecovery";
import { ensureKnowledgeHub } from "@/lib/orama-client";
import { TextSelectionMenu } from "@/components/interview/TextSelectionMenu";
import { GreenRoom } from "@/components/interview/GreenRoom";
import { RoomHeader } from "@/components/interview/RoomHeader";
import { StandbyOverlay } from "@/components/interview/StandbyOverlay";
import { PauseOverlay, ThinkTimeOverlay, EndingOverlay } from "@/components/interview/RoomOverlays";
import { UnsavedSessionBanner } from "@/components/interview/UnsavedSessionBanner";
import { SendFailureBanner } from "@/components/interview/SendFailureBanner";
import { TelemetryRow } from "@/components/interview/TelemetryRow";
import { TranscriptPanel } from "@/components/interview/TranscriptPanel";
import { useRoomWorkState } from "@/components/interview/room/useRoomWorkState";
import { useRoomPanels } from "@/components/interview/room/useRoomPanels";
import { useInterviewTelemetry } from "@/components/interview/room/useInterviewTelemetry";
import { useModelRuntime } from "@/components/interview/room/useModelRuntime";
import { useThinkTime } from "@/components/interview/room/useThinkTime";
import { useSessionPersistence } from "@/components/interview/room/useSessionPersistence";
import { useModelWorkers } from "@/components/interview/room/useModelWorkers";

function InterviewRoomContent() {
  const searchParams = useSearchParams();
  const role = searchParams?.get('role') || 'frontend';
  const level = searchParams?.get('level') || 'Mid-Level';
  const persona = searchParams?.get('persona') || 'supportive';
  const stressTest = searchParams?.get('stressTest') === 'true';
  const setupContext = searchParams?.get('context') || '';
  const framework = searchParams?.get('framework') || 'general';
  const aiModel = searchParams?.get('aiModel') || 'zhipu';
  const testMode = searchParams?.get('testMode') === 'true';

  // S4: the room's state slices live in room/ hooks. Each slice moved
  // verbatim — same states, same refs, same effects — so the page keeps only
  // orchestration. See src/components/interview/room/.
  const work = useRoomWorkState();
  const panels = useRoomPanels();
  const telemetry = useInterviewTelemetry();
  const model = useModelRuntime();
  const { inputText, setInputText, activeContext, setActiveContext, activeCodeContext, setActiveCodeContext, activeSystemDesignContext, setActiveSystemDesignContext, resumeText, setResumeText, problemStatement, setProblemStatement, isRequestingHint, setIsRequestingHint, activeExpert, setActiveExpert, activeCodeContextRef, activeSystemDesignContextRef } = work;
  const { isScratchpadOpen, setIsScratchpadOpen, isSystemDesignOpen, setIsSystemDesignOpen, isFocusMode, setIsFocusMode, isPaused, setIsPaused } = panels;
  const { recordingStartTimeRef, deliveryLedgerRef, lastSpeechTimeRef, lastAnalysisTimeRef, sttSessionRef, interruptionsRef, answerSegmentsRef, roundTripsRef, sendSpanRef, unmountedRef, ttftSamplesRef, whisperTurnaroundsRef, whisperSpanRef, ttsStartupSamplesRef, ttsSpanRef } = telemetry;
  const { modelStatus, setModelStatus, modelsReady, setModelsReady, isUsingNativeTTS, setIsUsingNativeTTS, modelLoadError } = model;
  // startRecording is defined below; the think-time hook fires it through a ref
  // so the countdown and the recorder stay decoupled at definition time.
  const startRecordingRef = useRef<() => void>(null);
  const { isThinkTimeEnabled, setIsThinkTimeEnabled, thinkCountdown, setThinkCountdown } = useThinkTime(() => startRecordingRef.current?.());

  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  

  // Delivery Stats State (observable signals only — see TRUTHFULNESS_REPORT)
  const [wpm, setWpm] = useState(0);
  const [fillerWordsCount, setFillerWordsCount] = useState(0);
  
  const { isCalmMode, isDyslexiaMode, showLiveInsights } = useAccessibilityStore();
  const isPageVisible = usePageVisibility();
  const [activeUserTranscript, setActiveUserTranscript] = useState("");
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [isStandby, setIsStandby] = useState(true);
  const router = useRouter();
  const [isGreenRoom, setIsGreenRoom] = useState(!testMode);
  // Phase 6: interview loop (turns/difficulty/budget). Initialized per
  // interview id; authority stays server-side (synthesizeServerState).
  // Phase 9: loop chrome text comes from the locale dictionary.
  const { t } = useLanguage();
  const interviewIdParam = searchParams?.get('id') ?? null;
  const initLoop = useInterviewLoopStore((s) => s.initLoop);
  const loopMeta = useInterviewLoopStore((s) =>
    s.loop ? loopBadge(t, s.loop.turnCount, s.loop.difficulty) : null
  );
  useEffect(() => {
    const budget = Number(searchParams?.get('timeBudgetSec'));
    initLoop(level, {
      difficulty: searchParams?.get('difficulty') ?? undefined,
      timeBudgetSec: Number.isFinite(budget) && budget > 0 ? budget : undefined,
    });
  }, [interviewIdParam, level, initLoop, searchParams]);
  const setCognitiveLoad = useInterveStore(state => state.setCognitiveLoad);
  
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  

  const currentAudioSource = useRef<AudioBufferSourceNode | null>(null);


  function stopAiPlayback() {
     if (currentAudioSource.current) {
        currentAudioSource.current.stop();
        currentAudioSource.current = null;
     }
     window.speechSynthesis.cancel();
     setIsAiSpeaking(false);
  }

  async function playAudio(audioData: Float32Array, sampleRate: number) {
    if (!audioContext.current) return;
    
    // Stop any currently playing audio
    if (currentAudioSource.current) {
       currentAudioSource.current.stop();
    }

    const buffer = audioContext.current.createBuffer(1, audioData.length, sampleRate);
    // @ts-expect-error: ArrayBufferLike vs ArrayBuffer mismatch
    buffer.copyToChannel(audioData, 0);

    const source = audioContext.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.current.destination);
    
    source.onended = () => {
      setIsAiSpeaking(false);
    };

    currentAudioSource.current = source;
    source.start();
    // Phase 13: Kokoro TTS startup = generate-request → first audio frame.
    ttsSpanRef.current.collectInto(ttsStartupSamplesRef.current);
  }

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
  }, [isRecording, setCognitiveLoad]);

  // A stream that ends before text-end leaves its text part "streaming" while
  // the transport reports no error, so the room would show half a question as
  // if it were whole. onFinish is the only place that sees the final shape.
  const [streamTruncated, setStreamTruncated] = useState(false);

  const { messages, setMessages, sendMessage, regenerate, status, error: sendError } = useChat({
    transport: createQuotaAwareTransport({
      context: activeContext,
      codeContext: activeCodeContext,
      systemDesignContext: activeSystemDesignContext,
      role,
      level,
      persona,
      stressTest,
      setupContext,
      framework,
      // Phase 7: interview type selects the evaluation rubric server-side
      // (framework keeps precedence for explicit non-general formats).
      interviewType: searchParams?.get('interviewType') || undefined,
      resumeText,
      model: aiModel,
      cognitiveLoad: useInterveStore.getState().cognitiveLoad,
      starProgress: useInterveStore.getState().starProgress,
      behavioralTraits: useInterveStore.getState().behavioralTraits
    }),
    onFinish: (event) => {
      setStreamTruncated(
        !event.isAbort && !event.isError && event.message.parts.some((p) => p.type === "text" && p.state === "streaming"),
      );
      // Phase 8: send→complete round trip (includes generation time).
      sendSpanRef.current.collectInto(roundTripsRef.current);
      // v7 passes an event envelope, not the message: reading `event` itself
      // yields "" and TTS speaks silence while the UI says it is generating.
      const textToSpeak = getTextFromFinishEvent(event);
      
      // Check if text contains Chinese characters to route to the appropriate TTS engine
      const hasChinese = /[\u4e00-\u9fa5]/.test(textToSpeak);

      // Send the final text to TTS
      if (isUsingNativeTTS || hasChinese) {
        setIsAiSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        // If Chinese characters are present, explicitly request a Chinese voice
        utterance.lang = hasChinese ? 'zh-CN' : 'en-US'; 
        utterance.onend = () => setIsAiSpeaking(false);
        // Phase 13: TTS startup = speak() → first audio.
        ttsSpanRef.current.start();
        utterance.onstart = () => ttsSpanRef.current.collectInto(ttsStartupSamplesRef.current);
        window.speechSynthesis.speak(utterance);
      } else if (modelsReady && kokoroWorker.current) {
        setIsAiSpeaking(true);
        setModelStatus("正在生成语音...");
        ttsSpanRef.current.start();
        kokoroWorker.current.postMessage({
          type: 'generate',
          text: textToSpeak,
          voice: 'af_heart'
        });
      }
    },
  });

  // Measured at 390px with /api/interview-chat aborted: zero role="alert"
  // nodes, an empty composer, and no retry. The hook owns that recovery.
  const sendFailure = useSendFailureRecovery({ error: sendError, truncated: streamTruncated, messages, setInputText, regenerate });

  const isLoading = status === 'streaming' || status === 'submitted';
  const [latencyPhase, setLatencyPhase] = useState(0);

  useEffect(() => {
    if (status === 'submitted') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLatencyPhase(0);
      const t1 = setTimeout(() => setLatencyPhase(1), 3000);
      const t2 = setTimeout(() => setLatencyPhase(2), 7000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else if (status === 'streaming') {
      // Phase 13: stream-start latency ≈ LLM TTFT (submit → first chunk).
      // Reads without consuming: the round trip closes the same span later.
      const ttftMs = sendSpanRef.current.elapsed();
      if (ttftMs !== null) ttftSamplesRef.current.push(ttftMs);
      setLatencyPhase(3);
    } else {
      setLatencyPhase(0);
    }
  }, [status]);
  const handleUserInput = async (text: string) => {
    stopAiPlayback();
    // Kept before the request leaves: if the transport fails, this is the only
    // copy of an answer the candidate already typed.
    sendFailure.remember(text);
    // Phase 8: send timestamp for round-trip measurement (19.3).
    sendSpanRef.current.start();
    
    let oramaContext = "";
    if (modelsReady || isUsingNativeTTS) {
      try {
        const { queryKnowledgeHub } = await import('@/lib/orama-client');
        const results = await queryKnowledgeHub(text, 3);
        oramaContext = results.join("\n\n");
      } catch {
        console.warn("Knowledge hub not ready");
      }
    }
    setActiveContext(oramaContext);

    const codeCtx = readScratchpadCodeContext();
    const sysDesignCtx = readDesignCanvas();
    setActiveCodeContext(codeCtx);
    setActiveSystemDesignContext(sysDesignCtx);

    // Give React a tick to update the context before appending
    // Phase 6: record the turn and send FRESH snapshots per message (the
    // transport-level body is a render-time snapshot and may be stale).
    const loopStore = useInterviewLoopStore.getState();
    const analyzerStore = useInterveStore.getState();
    loopStore.recordUserTurn(latestAiMessage || "(opening)", {
      starProgress: analyzerStore.starProgress,
      behavioralTraits: analyzerStore.behavioralTraits,
    });
    const freshLoop = useInterviewLoopStore.getState().loop;
    setTimeout(() => {
      sendMessage({ text }, {
        body: {
          context: oramaContext,
          codeContext: codeCtx,
          systemDesignContext: sysDesignCtx,
          starProgress: analyzerStore.starProgress,
          behavioralTraits: analyzerStore.behavioralTraits,
          cognitiveLoad: analyzerStore.cognitiveLoad,
          interviewLoop: freshLoop
            ? { startedAt: freshLoop.startedAt, timeBudgetSec: freshLoop.timeBudgetSec, difficulty: freshLoop.difficulty }
            : undefined,
        },
      });
    }, 0);
  };

  const handleUserInputRef = useRef(handleUserInput);
  useEffect(() => {
    handleUserInputRef.current = handleUserInput;
  });  

  const handleTextSubmit = () => {
    if (!inputText.trim()) return;
    handleUserInput(inputText.trim());
    setInputText("");
  };

  const requestHint = async () => {
    if (isRequestingHint) return;
    setIsRequestingHint(true);
    
    const codeCtx = readScratchpadContent();

    const chatHistory = messages.map(m => {
      // Phase 14: v6 parts-first extraction.
      return `${m.role}: ${getMessageText(m as { parts?: unknown; content?: unknown; text?: unknown })}`;
    }).join("\n");

    try {
      const res = await fetch("/api/generate-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemTitle: "Technical Interview Question",
          problemDescription: problemStatement,
          currentCode: codeCtx,
          chatHistory
        })
      });

      const result = await readApiJson<{ hint?: string }>(res);
      if (result.ok && result.data.hint) {
        toast.success("AI 提示 (Hint)", {
          description: result.data.hint,
          duration: 15000,
          position: "top-center"
        });
      } else {
        // "无法生成提示" with no reason sent nobody anywhere: a rate limit and a
        // killed function look identical from here.
        toast.error("无法生成提示", {
          description: result.ok ? "服务返回了空提示。" : describeApiFailure(result.failure),
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("请求出错");
    } finally {
      setIsRequestingHint(false);
    }
  };

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
  }, []);
  // S4: worker construction + dispatch wiring live in the runtime hook;
  // playback/recognizer refs stay here — their handlers interleave with
  // the send pipeline.
  const { whisperWorker, kokoroWorker, audioContext } = useModelWorkers({
    testMode, searchParams, speechRecognitionRef: speechRecognition,
    setResumeText: work.setResumeText, setProblemStatement: work.setProblemStatement,
    setWpm, setFillerWordsCount,
    setIsAiSpeaking, playAudio, telemetry, work, model, handleUserInputRef,
  });

  const latestAiMessage = (() => {
    const lastAss = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAss) return "";
    // Phase 14: v6 parts-first extraction (legacy .content/.text fallback).
    return getMessageText(lastAss as { parts?: unknown; content?: unknown; text?: unknown });
  })();

  useEffect(() => {
    if (latestAiMessage) {
      // A reply that opens with no known label leaves the current persona alone.
      const announced = expertFromMessage(latestAiMessage);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (announced) setActiveExpert(announced);
    }
  }, [latestAiMessage]);

  useVADInterruption(isAiSpeaking, () => {
    // Phase 8: barge-in counted as an observable interruption (19.1).
    interruptionsRef.current += 1;
    stopAiPlayback();
    toast.info("🎤 检测到您的发言", { description: "AI已暂停，您可以继续表达" });
    if (!isRecording && modelsReady && !isStandby) {
      startRecording();
    }
  }, 25, 5, getPreferredMicDevice());

  // Phase 38: Ambient Noise Warning
  useAmbientNoise(!isStandby && !isRecording && !isAiSpeaking && !isPaused, 20, 180);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
  }, []);

  // Phase E1: settlement slice (useInterviewSettlement) — behavior-verbatim.
  const { isEnding, handleEndCall, saveFailure, isRetrying, retrySave, leaveWithoutSaving } = useInterviewSettlement({
    messages,
    framework,
    interviewType: searchParams?.get("interviewType") || undefined,
    wpm,
    fillerWordsCount,
    searchParams,
    stopAiPlayback,
    setActiveStream,
    refs: {
      sttSession: sttSessionRef,
      answerSegments: answerSegmentsRef,
      interruptions: interruptionsRef,
      roundTrips: roundTripsRef,
      ttftSamples: ttftSamplesRef,
      whisperTurnarounds: whisperTurnaroundsRef,
      ttsStartupSamples: ttsStartupSamplesRef,
      mediaRecorder,
    },
  });


  // S4: session persistence moved verbatim into the room hook.
  useSessionPersistence({
    searchParams, messages, wpm, fillerWordsCount,
    setMessages, setWpm, setFillerWordsCount, deliveryLedgerRef,
  });

  // S4: bind the recorder for the think-time hook defined above.
  startRecordingRef.current = () => { void startRecording(); };

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

  const handleStartSpeaking = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (isThinkTimeEnabled && thinkCountdown === null) {
      setThinkCountdown(THINK_TIME_SECONDS);
    } else {
      setThinkCountdown(null);
      startRecording();
    }
  };

  const startFromStandby = () => {
    if (!modelsReady && modelLoadError) {
      setModelsReady(true);
      setIsUsingNativeTTS(true);
      toast.info("已切换至基础语音模式", { description: "由于加载超时，已为您切换到基础引擎" });
    }
    setIsStandby(false);
    handleStartSpeaking();
  };

  const togglePaused = () => {
    const next = !isPaused;
    setIsPaused(next);
    if (next) {
      stopRecording();
      stopAiPlayback();
      toast("面试已暂停", { description: "已静音并模糊屏幕，按 Esc 恢复" });
    } else {
      toast("面试恢复", { description: "计时已恢复" });
    }
  };

  const toggleFocusMode = () => {
    const next = !isFocusMode;
    setIsFocusMode(next);
    toast(next ? "已开启专注模式" : "已退出专注模式", {
      description: next ? "干扰元素已隐藏，按 F 键恢复" : "遥测数据已恢复显示",
    });
  };

  useKeyboardShortcuts([
    {
      key: "Escape",
      allowInInput: true,
      handler: togglePaused,
    },
    {
      key: "f",
      allowInInput: false,
      handler: toggleFocusMode,
    },
    {
      key: " ",
      allowInInput: false,
      handler: () => {
        if (!isRecording && modelsReady && !isLoading && !isStandby) {
          startRecording();
        }
      },
      keyUpHandler: () => {
        if (isRecording && !isStandby) {
          stopRecording();
        }
      }
    },
    {
      key: "Enter",
      metaKey: true,
      allowInInput: true,
      handler: () => {
        if (!modelsReady || isLoading) return;
        if (inputText.trim()) {
          handleTextSubmit();
        }
      }
    },
    {
      key: "Enter",
      ctrlKey: true,
      allowInInput: true,
      handler: () => {
        if (!modelsReady || isLoading) return;
        if (inputText.trim()) {
          handleTextSubmit();
        }
      }
    },
    ...createCtrlCmdShortcut("k", () => {
      inputRef.current?.focus();
    }, { allowInInput: true }),
    ...createCtrlCmdShortcut("m", () => {
      if (!modelsReady || isLoading || isStandby) return;
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }, { allowInInput: true })
  ]);

  if (isGreenRoom) {
    return (
      <GreenRoom 
        onComplete={() => setIsGreenRoom(false)} 
        onBypass={() => setIsGreenRoom(false)} 
        onExit={() => router.push("/dashboard")}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-transparent text-foreground font-sans selection:bg-primary/10 p-4 gap-4">
      <PauseOverlay isPaused={isPaused} />

      <ThinkTimeOverlay
        seconds={thinkCountdown}
        isCalmMode={isCalmMode}
        onCancel={() => setThinkCountdown(null)}
        onStart={() => setThinkCountdown(0)}
      />
      
      {/* Top Header */}
      <RoomHeader
        stressTest={stressTest}
        isRecording={isRecording}
        recordingStartTime={recordingStartTime}
        isPaused={isPaused}
        onTogglePaused={togglePaused}
        isThinkTimeEnabled={isThinkTimeEnabled}
        onToggleThinkTime={() => setIsThinkTimeEnabled(!isThinkTimeEnabled)}
        isFocusMode={isFocusMode}
        onToggleFocusMode={toggleFocusMode}
      />

      {/* The stage progress read-out is a desktop affordance: on a phone it costs
          106px of a 844px screen and pushed the room's own panels below the fold. */}
      <div className="px-2 shrink-0 max-md:hidden">
        <FlowMap messageCount={messages.length} />
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 flex-1 overflow-hidden gap-4 px-2 pb-2">
        
        {/* Left: 70% (Bento Stack) */}
        {/* On a phone the two columns stack, and without a floor neither gets a
            usable height: the transcript's content won and this column collapsed
            to 18px, which in turn let the dock (absolute bottom-8) float up over
            the FlowMap row. Sharing the split instead of letting either column
            win keeps both panels real and the dock inside its stage. */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4 overflow-hidden max-lg:flex-1 max-lg:min-h-0">
           {/* W53: normal-flow strip above the stage, never an absolute layer in it. */}
           {!isFocusMode && framework === 'star' && <div className="shrink-0"><StarTracker variant="inline" /></div>}
           {/* Top: AI Avatar (Main Bento Card) */}
                      <RoomStage
             framework={framework}
             stressTest={stressTest}
             isFocusMode={isFocusMode}
             isPageVisible={isPageVisible}
             isLoading={isLoading}
             isRecording={isRecording}
             isAiSpeaking={isAiSpeaking}
             modelsReady={modelsReady}
             isRequestingHint={isRequestingHint}
             latestAiMessage={latestAiMessage}
             modelStatus={modelStatus}
             activeUserTranscript={activeUserTranscript}
             inputText={inputText}
             loopMeta={loopMeta}
             wpm={wpm}
             activeExpert={activeExpert}
             activeStream={activeStream}
             setInputText={setInputText}
             setIsScratchpadOpen={setIsScratchpadOpen}
             setIsSystemDesignOpen={setIsSystemDesignOpen}
             startRecording={startRecording}
             stopRecording={stopRecording}
             handleStartSpeaking={handleStartSpeaking}
             requestHint={requestHint}
             handleTextSubmit={handleTextSubmit}
             inputRef={inputRef}
           />

            <TelemetryRow
              isFocusMode={isFocusMode} collapsed={framework === 'star'}
              wpm={wpm}
              fillerWordsCount={fillerWordsCount}
              showLiveInsights={showLiveInsights}
              isRecording={isRecording}
              isAiSpeaking={isAiSpeaking}
            />
        </div>

        <TranscriptPanel
          messages={messages}
          isLoading={isLoading}
          status={status}
          latencyPhase={latencyPhase}
          isDyslexiaMode={isDyslexiaMode}
          isFocusMode={isFocusMode}
          latestAiMessage={latestAiMessage}
          endRef={messagesEndRef}
          onRegenerate={regenerate}
          onDeleteMessage={(id) => setMessages(messages.filter((msg) => msg.id !== id))}
          onEndCall={handleEndCall}
          isEnding={isEnding}
        />
      </div>

      <TechnicalScratchpad 
        isOpen={isScratchpadOpen} 
        onClose={() => setIsScratchpadOpen(false)} 
        problemStatement={problemStatement}
      />

      <SystemDesignBoard 
        isOpen={isSystemDesignOpen} 
        onClose={() => setIsSystemDesignOpen(false)} 
      />

      {/* Dynamic Copilot Coaching Hints */}
      {!isFocusMode && (
        <CopilotHints 
          wpm={wpm} 
          isRecording={isRecording} 
        />
      )}

      {/* Standby / Click to Start Overlay */}
      <StandbyOverlay
        open={isStandby}
        modelsReady={modelsReady}
        loadError={modelLoadError}
        onStart={startFromStandby}
        onExit={() => router.push("/dashboard")}
      />

      <EndingOverlay isEnding={isEnding} />
      {saveFailure && (
        <UnsavedSessionBanner
          notice={saveFailure.notice}
          retrying={isRetrying}
          onRetry={retrySave}
          onLeave={leaveWithoutSaving}
        />
      )}
      {sendFailure.visible && (
        <SendFailureBanner
          retrying={sendFailure.retrying}
          onRetry={sendFailure.retry}
          onDismiss={sendFailure.dismiss}
          notice={sendFailure.notice}
        />
      )}
      <TextSelectionMenu />
    </div>
  );
}

export default function InterviewRoom() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#f8fafc]"><DynamicLoader phrases={["Loading Interview Room...", "Preparing virtual environment...", "Checking audio devices..."]} /></div>}>
      <InterviewRoomContent />
    </Suspense>
  );
}
