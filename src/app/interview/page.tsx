
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { createQuotaAwareTransport } from "@/lib/api/chat-transport";
import { expertFromMessage } from "@/lib/interview/experts";
import type { SpeechRecognitionLike } from "@/lib/interview/speech-session";
import { getPreferredMicDevice } from "@/lib/audio/vad";
import { DynamicLoader } from "@/components/ui/DynamicLoader";
import { getMessageText, getTextFromFinishEvent } from "@/lib/message-text";
import { useInterveStore } from "@/store/useInterveStore";
import { useInterviewLoopStore } from "@/store/useInterviewLoopStore";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { loopBadge } from "@/lib/interview/difficulty-label";
import { describeApiFailure, readApiJson } from "@/lib/api/read-response";
import { useVADInterruption } from "@/hooks/useVADInterruption";
import { readDesignCanvas, readScratchpadCodeContext, readScratchpadContent } from "@/lib/interview/board-state";
import { THINK_TIME_SECONDS } from "@/lib/interview/think-time";
import { useInterviewSettlement } from "@/components/interview/useInterviewSettlement";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { useAmbientNoise } from "@/hooks/useAmbientNoise";
import { useSendFailureRecovery } from "@/hooks/useSendFailureRecovery";
import { ensureKnowledgeHub } from "@/lib/orama-client";
import { GreenRoom } from "@/components/interview/GreenRoom";
import { useRoomWorkState } from "@/components/interview/room/useRoomWorkState";
import { useRoomPanels } from "@/components/interview/room/useRoomPanels";
import { useInterviewTelemetry } from "@/components/interview/room/useInterviewTelemetry";
import { useModelRuntime } from "@/components/interview/room/useModelRuntime";
import { useThinkTime } from "@/components/interview/room/useThinkTime";
import { useSessionPersistence } from "@/components/interview/room/useSessionPersistence";
import { useModelWorkers } from "@/components/interview/room/useModelWorkers";
import { useRecordingLoop } from "@/components/interview/room/useRecordingLoop";
import { useRoomShortcuts } from "@/components/interview/room/useRoomShortcuts";
import { RoomView } from "@/components/interview/room/RoomView";

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
  const { inputText, setInputText, activeContext, setActiveContext, activeCodeContext, setActiveCodeContext, activeSystemDesignContext, setActiveSystemDesignContext, isRequestingHint, setIsRequestingHint, activeExpert, setActiveExpert, resumeText, problemStatement } = work;
  const { isFocusMode, setIsFocusMode, isPaused, setIsPaused } = panels;
  const { recordingStartTimeRef, deliveryLedgerRef, lastSpeechTimeRef, sttSessionRef, interruptionsRef, answerSegmentsRef, roundTripsRef, sendSpanRef, unmountedRef, ttftSamplesRef, whisperTurnaroundsRef, whisperSpanRef, ttsStartupSamplesRef, ttsSpanRef } = telemetry;
  const { setModelStatus, modelsReady, setModelsReady, isUsingNativeTTS, setIsUsingNativeTTS, modelLoadError } = model;
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
  const latestAiMessage = (() => {
    const lastAss = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAss) return "";
    // Phase 14: v6 parts-first extraction (legacy .content/.text fallback).
    return getMessageText(lastAss as { parts?: unknown; content?: unknown; text?: unknown });
  })();

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

  // S4: the three worker/audio refs are page-level because the runtime hook
  // and the recording hook must agree on one instance (recorder posts to the
  // worker the runtime hook created — two refs would be two workers).
  const whisperWorker = useRef<Worker | null>(null);
  const kokoroWorker = useRef<Worker | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);

  // S4: worker construction + dispatch wiring live in the runtime hook;
  // playback/recognizer refs stay here — their handlers interleave with
  // the send pipeline.
  useModelWorkers({
    testMode, searchParams, speechRecognitionRef: speechRecognition,
    setResumeText: work.setResumeText, setProblemStatement: work.setProblemStatement,
    setWpm, setFillerWordsCount,
    setIsAiSpeaking, playAudio, telemetry, work, model, handleUserInputRef,
    whisperWorker, kokoroWorker, audioContext,
  });


  useEffect(() => {
    if (latestAiMessage) {
      // A reply that opens with no known label leaves the current persona alone.
      const announced = expertFromMessage(latestAiMessage);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (announced) setActiveExpert(announced);
    }
  }, [latestAiMessage]);

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

  // S4: the recording loop lives in its hook; the page keeps the playback and
  // recognizer refs it shares with barge-in and settlement.
  const { startRecording, stopRecording } = useRecordingLoop({
    stopAiPlayback, setActiveStream, setRecordingStartTime, setIsRecording,
    setActiveUserTranscript, setWpm, setFillerWordsCount, setModelStatus,
    telemetry: { recordingStartTimeRef, deliveryLedgerRef, lastSpeechTimeRef, sttSessionRef, unmountedRef, answerSegmentsRef, whisperSpanRef },
    whisperWorker, mediaRecorder, audioChunks, speechRecognition,
  });

  // S4: these three dereference the recorder, so they follow the hook that owns
  // it — ordering by dependency is also what react-hooks/immutability asks for.
  useEffect(() => {
    startRecordingRef.current = () => { void startRecording(); };
  }, [startRecording]);

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

  useVADInterruption(isAiSpeaking, () => {
    // Phase 8: barge-in counted as an observable interruption (19.1).
    interruptionsRef.current += 1;
    stopAiPlayback();
    toast.info("🎤 检测到您的发言", { description: "AI已暂停，您可以继续表达" });
    if (!isRecording && modelsReady && !isStandby) {
      startRecording();
    }
  }, 25, 5, getPreferredMicDevice());

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

  // S4: the shortcut table lives in its hook; every handler is injected so the
  // key map stays a table rather than a second copy of the room's logic.
  useRoomShortcuts({
    togglePaused, toggleFocusMode,
    isRecording, isStandby, modelsReady, isLoading,
    startRecording, stopRecording,
    inputText, handleTextSubmit, inputRef,
  });

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
    <RoomView
      vm={{
        ...work, ...panels, ...model,
        thinkCountdown, setThinkCountdown,
        isCalmMode, stressTest, isRecording, recordingStartTime, togglePaused,
        isThinkTimeEnabled, setIsThinkTimeEnabled, toggleFocusMode,
        messages, isPageVisible, isLoading, isAiSpeaking,
        latestAiMessage: latestAiMessage ?? "",
        activeUserTranscript, loopMeta, wpm, activeStream,
        startRecording, stopRecording,
        handleStartSpeaking,
        requestHint, handleTextSubmit,
        inputRef, fillerWordsCount, showLiveInsights,
        status, latencyPhase, isDyslexiaMode, messagesEndRef, regenerate, setMessages,
        modelLoadError, startFromStandby, router, isStandby,
        settlement: { isEnding, handleEndCall, saveFailure, isRetrying, retrySave, leaveWithoutSaving },
        sendFailure,
        framework,
      }}
    />
  );
}

export default function InterviewRoom() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#f8fafc]"><DynamicLoader phrases={["Loading Interview Room...", "Preparing virtual environment...", "Checking audio devices..."]} /></div>}>
      <InterviewRoomContent />
    </Suspense>
  );
}
