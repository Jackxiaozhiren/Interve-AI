
"use client";

import React, { Suspense, useState, useRef, useEffect } from "react";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import type { SpeechRecognitionLike } from "@/lib/interview/speech-session";
import { getPreferredMicDevice } from "@/lib/audio/vad";
import { DynamicLoader } from "@/components/ui/DynamicLoader";
import { useInterveStore } from "@/store/useInterveStore";
import { useInterviewLoopStore } from "@/store/useInterviewLoopStore";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { loopBadge } from "@/lib/interview/difficulty-label";
import { useVADInterruption } from "@/hooks/useVADInterruption";
import { useInterviewSettlement } from "@/components/interview/useInterviewSettlement";
import { usePageVisibility } from "@/hooks/usePageVisibility";

import {
  RoomView, useRoomWorkState, useRoomPanels, useInterviewTelemetry, useModelRuntime,
  useThinkTime, useSessionPersistence, useModelWorkers, useRecordingLoop, useRoomShortcuts,
  useChatPipeline, useAiPlayback, useRoomLifecycle, useRoomControls,
} from "@/components/interview/room";

function InterviewRoomContent() {
  const searchParams = useSearchParams();
  const role = searchParams?.get('role') || 'frontend';
  const level = searchParams?.get('level') || 'Mid-Level';
  const persona = searchParams?.get('persona') || 'supportive';
  const stressTest = searchParams?.get('stressTest') === 'true';
  const setupContext = searchParams?.get('context') || '';
  const framework = searchParams?.get('framework') || 'general';
  const testMode = searchParams?.get('testMode') === 'true';

  // S4: the room's state slices live in room/ hooks. Each slice moved
  // verbatim — same states, same refs, same effects — so the page keeps only
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
  const setCognitiveLoad = useInterveStore(state => state.setCognitiveLoad);
  

  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  


  // A stream that ends before text-end leaves its text part "streaming" while
  // the transport reports no error, so the room would show half a question as
  // if it were whole. onFinish is the only place that sees the final shape.
  // S4: the three worker/audio refs are page-level because the runtime hook
  // and the recording hook must agree on one instance (recorder posts to the
  // worker the runtime hook created — two refs would be two workers).
  const whisperWorker = useRef<Worker | null>(null);
  const kokoroWorker = useRef<Worker | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);

  // S4: playback (AudioContext source + native speech) lives in its hook.
  const { stopAiPlayback, playAudio } = useAiPlayback({ audioContext, setIsAiSpeaking });

  // S4: the chat pipeline (transport, onFinish TTS routing, latency ladder,
  // send paths and the hint request) lives in its hook.
  const {
    messages, setMessages, regenerate, status, isLoading, latencyPhase,
    latestAiMessage, sendFailure,
    handleUserInputRef, handleTextSubmit, requestHint,
  } = useChatPipeline({
    activeContext, activeCodeContext, activeSystemDesignContext,
    role, level, persona, stressTest, setupContext, framework,
    interviewType: searchParams?.get('interviewType') || undefined,
    resumeText, aiModel: searchParams?.get('aiModel') || 'zhipu',
    problemStatement, inputText, isRequestingHint, modelsReady,
    isUsingNativeTTS, kokoroWorker,
    setActiveContext, setActiveCodeContext, setActiveSystemDesignContext, setInputText,
    setIsRequestingHint, setIsAiSpeaking, setModelStatus, stopAiPlayback,
    telemetry: { sendSpanRef, roundTripsRef, ttftSamplesRef, ttsSpanRef, ttsStartupSamplesRef },
  });

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



  // Phase 38: Ambient Noise Warning


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

  // S4: the lifecycle effects (loop bootstrap, knowledge hub, silence tracker,
  // persona announcement, scroll anchor, ambient noise, unmount teardown).
  useRoomLifecycle({
    interviewIdParam, level, searchParams, initLoop,
    isRecording, isStandby, isAiSpeaking, isPaused,
    latestAiMessage, messages, setActiveExpert, messagesEndRef,
    unmountedRef, mediaRecorder, speechRecognition, lastSpeechTimeRef, setCognitiveLoad,
    stopRecording, setInputText, inputRef,
  });

  // S4: these three dereference the recorder, so they follow the hook that owns
  // it — ordering by dependency is also what react-hooks/immutability asks for.
  useEffect(() => {
    startRecordingRef.current = () => { void startRecording(); };
  }, [startRecording]);

  useVADInterruption(isAiSpeaking, () => {
    // Phase 8: barge-in counted as an observable interruption (19.1).
    interruptionsRef.current += 1;
    stopAiPlayback();
    toast.info("🎤 检测到您的发言", { description: "AI已暂停，您可以继续表达" });
    if (!isRecording && modelsReady && !isStandby) {
      startRecording();
    }
  }, 25, 5, getPreferredMicDevice());

  // S4: push-to-talk, standby escape, pause and focus mode live in their hook.
  const { handleStartSpeaking, startFromStandby, togglePaused, toggleFocusMode } = useRoomControls({
    isRecording, isPaused, isFocusMode, isThinkTimeEnabled, thinkCountdown,
    modelsReady, modelLoadError, startRecording, stopRecording, stopAiPlayback,
    setThinkCountdown, setIsPaused, setIsFocusMode, setIsStandby,
    setModelsReady, setIsUsingNativeTTS,
  });

  // S4: the shortcut table lives in its hook; every handler is injected so the
  // key map stays a table rather than a second copy of the room's logic.
  useRoomShortcuts({
    togglePaused, toggleFocusMode,
    isRecording, isStandby, modelsReady, isLoading,
    startRecording, stopRecording,
    inputText, handleTextSubmit, inputRef,
  });

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
        isGreenRoom, onGreenRoomDone: () => setIsGreenRoom(false),
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
