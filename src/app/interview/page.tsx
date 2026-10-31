
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
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
import { ensureKnowledgeHub } from "@/lib/orama-client";
import { TextSelectionMenu } from "@/components/interview/TextSelectionMenu";
import { GreenRoom } from "@/components/interview/GreenRoom";
import { RoomHeader } from "@/components/interview/RoomHeader";
import { StandbyOverlay } from "@/components/interview/StandbyOverlay";
import { PauseOverlay, ThinkTimeOverlay, EndingOverlay } from "@/components/interview/RoomOverlays";
import { TelemetryRow } from "@/components/interview/TelemetryRow";
import { TranscriptPanel } from "@/components/interview/TranscriptPanel";

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

  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [modelStatus, setModelStatus] = useState<string>("正在初始化模型...");
  const [modelsReady, setModelsReady] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isUsingNativeTTS, setIsUsingNativeTTS] = useState(false);
  const [activeContext, setActiveContext] = useState("");
  const [activeCodeContext, setActiveCodeContext] = useState("");
  const [activeSystemDesignContext, setActiveSystemDesignContext] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [isRequestingHint, setIsRequestingHint] = useState(false);
  const [activeExpert, setActiveExpert] = useState<AIExpert>('system');
  

  // Delivery Stats State (observable signals only — see TRUTHFULNESS_REPORT)
  const [wpm, setWpm] = useState(0);
  const [fillerWordsCount, setFillerWordsCount] = useState(0);
  
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [isSystemDesignOpen, setIsSystemDesignOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const { isCalmMode, isDyslexiaMode, showLiveInsights } = useAccessibilityStore();
  const isPageVisible = usePageVisibility();
  const [activeUserTranscript, setActiveUserTranscript] = useState("");
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [isStandby, setIsStandby] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isThinkTimeEnabled, setIsThinkTimeEnabled] = useState(false);
  const [thinkCountdown, setThinkCountdown] = useState<number | null>(null);
  const [modelLoadError, setModelLoadError] = useState(false);
  const [isGreenRoom, setIsGreenRoom] = useState(!testMode);
  const recordingStartTimeRef = useRef<number | null>(null);
  // One owner for the hesitation count, because both speech engines see the same
  // spoken fillers (see src/lib/interview/delivery-ledger.ts).
  const deliveryLedgerRef = useRef(createDeliveryLedger(countFillers));
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const lastAnalysisTimeRef = useRef<number>(0);
  // Phase 8: observable delivery analytics (no psychology). Refs only —
  // nothing here is displayed as a score during the interview.
  const sttSessionRef = useRef(createSttSession());
  const interruptionsRef = useRef(0);
  const answerSegmentsRef = useRef<{ startMs: number; endMs: number }[]>([]);
  const roundTripsRef = useRef<number[]>([]);
  // One start, two readers: TTFT is read at the first token and the round trip
  // at the end of the answer, so the span is not consumed by the first.
  const sendSpanRef = useRef(createLatencySpan());
  const unmountedRef = useRef(false);
  // Phase 13: latency breakdown refs (31). TTFT ≈ submit→streaming;
  // whisper = post→complete turnaround; TTS = speak-request→first audio.
  const ttftSamplesRef = useRef<number[]>([]);
  const whisperTurnaroundsRef = useRef<number[]>([]);
  const whisperSpanRef = useRef(createLatencySpan());
  const ttsStartupSamplesRef = useRef<number[]>([]);
  const ttsSpanRef = useRef(createLatencySpan());
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
  
  const activeCodeContextRef = useRef(activeCodeContext);
  const activeSystemDesignContextRef = useRef(activeSystemDesignContext);

  useEffect(() => {
    activeCodeContextRef.current = activeCodeContext;
  }, [activeCodeContext]);

  useEffect(() => {
    activeSystemDesignContextRef.current = activeSystemDesignContext;
  }, [activeSystemDesignContext]);

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

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!modelsReady) {
      timer = setTimeout(() => {
        setModelLoadError(true);
      }, 15000); // 15 seconds timeout
    }
    return () => clearTimeout(timer);
  }, [modelsReady]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const whisperWorker = useRef<Worker | null>(null);
  const kokoroWorker = useRef<Worker | null>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  

  // TTS Audio Context
  const audioContext = useRef<AudioContext | null>(null);
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

  const { messages, setMessages, sendMessage, regenerate, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/interview-chat",
      body: {
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
      }
    }),
    onFinish: (event) => {
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
    }
  });

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

  // Phase 28: Think Time Countdown
  useEffect(() => {
    if (thinkCountdown === null || thinkCountdown <= 0) {
      if (thinkCountdown === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThinkCountdown(null);
        startRecording();
      }
      return;
    }
    const t = setTimeout(() => setThinkCountdown(prev => prev! - 1), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinkCountdown]);

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

  // Phase 26: Session Persistence (+ Phase 10: 30-day local retention)
  // E1: storage mechanics live in session-persistence.ts (unit-tested);
  // the component keeps only the restore-prompt UI.
  useEffect(() => {
    const interviewId = searchParams?.get('id');
    if (!interviewId || messages.length === 0) return;
    saveSession(localStorage, interviewId, { messages, wpm, fillerWordsCount });
  }, [messages, wpm, fillerWordsCount, searchParams]);

  useEffect(() => {
    const interviewId = searchParams?.get('id');
    if (!interviewId) return;
    const loaded = loadSession(localStorage, interviewId);
    if (loaded.status !== "found") return;
    const snapshot = loaded.snapshot;
    toast("发现未完成的面试记录", {
      description: "是否恢复之前的对话和状态？",
      action: {
        label: "恢复",
        onClick: () => {
          setMessages(toUiMessages(snapshot.messages));
          if (snapshot.wpm) setWpm(snapshot.wpm);
          if (snapshot.fillerWordsCount) setFillerWordsCount(deliveryLedgerRef.current.seed(snapshot.fillerWordsCount));
          toast.success("已恢复对话记录");
        }
      },
      cancel: {
        label: "清除",
        onClick: () => {
          clearSession(localStorage, interviewId);
        }
      },
      duration: 15000,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Web Workers and Data
  useEffect(() => {
    // Load resume text from db if available
    const interviewId = searchParams?.get('id');
    if (interviewId) {
      db.interviews.get(parseInt(interviewId, 10)).then((interview) => {
        if (interview?.resumeText) {
          setResumeText(interview.resumeText);
          // The reader has been live since Phase B4 and the writer had no caller, so
          // `orama_index` was empty in production and every per-answer retrieval
          // answered nothing. This is where the resume text and the reader meet.
          void ensureKnowledgeHub(interview.resumeText).then((outcome) => {
            if (outcome === "memory-only") console.warn("knowledge hub: built in memory only — the row was refused, so a reload starts empty");
          });
        }
        if (interview?.problemStatement) {
          setProblemStatement(interview.problemStatement);
        }
      }).catch(console.error);
    }

    // We instantiate workers using Next.js compatible syntax
    if (testMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModelsReady(true);
      setIsUsingNativeTTS(true);
      setModelStatus("");
      return;
    }
    
    whisperWorker.current = new Worker(new URL('../../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
    kokoroWorker.current = new Worker(new URL('../../workers/kokoro.worker.ts', import.meta.url), { type: 'module' });

    audioContext.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 24000 });

    const handleWhisperMessage = createWhisperDispatch({
      deliveryLedgerRef,
      whisperSpanRef,
      whisperTurnaroundsRef,
      recordingStartTimeRef,
      lastAnalysisTimeRef,
      activeCodeContextRef,
      activeSystemDesignContextRef,
      handleUserInputRef,
      setWpm,
      setFillerWordsCount,
      setModelStatus,
      getAnalysisSinks: () => useInterveStore.getState(),
      toast,
    });

    const handleKokoroMessage = createKokoroDispatch({
      setModelsReady,
      setModelStatus,
      setIsUsingNativeTTS,
      setIsAiSpeaking,
      playAudio,
      toast,
    });

    whisperWorker.current.addEventListener('message', handleWhisperMessage);
    kokoroWorker.current.addEventListener('message', handleKokoroMessage);

    // Trigger loads
    whisperWorker.current.postMessage({ type: 'load' });
    kokoroWorker.current.postMessage({ type: 'load' });

    // Restore Orama Knowledge Hub if needed. Idempotent: `ensure` returns the
    // moment an instance exists, so this is a no-op when the mount effect already
    // restored or built it, and a second chance when that one raced the data load.
    import('@/lib/orama-client').then(({ ensureKnowledgeHub }) => {
      void ensureKnowledgeHub(null);
    });

    return () => {
      if (whisperWorker.current) {
        whisperWorker.current.postMessage({ type: 'dispose' });
        const worker = whisperWorker.current;
        setTimeout(() => worker.terminate(), 200);
      }
      if (kokoroWorker.current) {
        kokoroWorker.current.postMessage({ type: 'dispose' });
        const worker = kokoroWorker.current;
        setTimeout(() => worker.terminate(), 200);
      }
      if (speechRecognition.current) {
        speechRecognition.current.stop();
      }
      if (audioContext.current?.state !== 'closed') {
         audioContext.current?.close();
      }
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMessage]);

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
  }, []);

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
  const { isEnding, handleEndCall } = useInterviewSettlement({
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

      <div className="px-2 shrink-0">
        <FlowMap messageCount={messages.length} />
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 flex-1 overflow-hidden gap-4 px-2 pb-2">
        
        {/* Left: 70% (Bento Stack) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4 overflow-hidden">
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
              isFocusMode={isFocusMode}
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
      />

      <EndingOverlay isEnding={isEnding} />
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
