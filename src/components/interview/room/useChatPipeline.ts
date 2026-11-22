"use client";

/**
 * eslint-disable react-hooks/immutability, react-hooks/refs --
 * Same contract as the other room slices: the refs (latency spans, the kokoro
 * worker handle) belong to the room and are shared with the recording slice;
 * writes happen in handlers and effects, never in render.
 */
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { createQuotaAwareTransport } from "@/lib/api/chat-transport";
import { getMessageText, getTextFromFinishEvent } from "@/lib/message-text";
import { readDesignCanvas, readScratchpadCodeContext, readScratchpadContent } from "@/lib/interview/board-state";
import { describeApiFailure, readApiJson } from "@/lib/api/read-response";
import { useInterveStore } from "@/store/useInterveStore";
import { useInterviewLoopStore } from "@/store/useInterviewLoopStore";
import { useSendFailureRecovery } from "@/hooks/useSendFailureRecovery";

/**
 * S4 slice 11: the chat pipeline — transport wiring, the finish handler that
 * routes text to TTS, the latency phase ladder, and the three send paths
 * (voice/typed input and the hint request). Moved verbatim from page.tsx so the
 * page keeps orchestration only.
 */
export function useChatPipeline(opts: {
  activeContext: string;
  activeCodeContext: string;
  activeSystemDesignContext: string;
  role: string;
  level: string;
  persona: string;
  stressTest: boolean;
  setupContext: string;
  framework: string;
  interviewType: string | undefined;
  resumeText: string;
  aiModel: string;
  problemStatement: string;
  inputText: string;
  isRequestingHint: boolean;
  modelsReady: boolean;
  isUsingNativeTTS: boolean;
  kokoroWorker: { current: Worker | null };
  setActiveContext: (s: string) => void;
  setActiveCodeContext: (s: string) => void;
  setActiveSystemDesignContext: (s: string) => void;
  setInputText: (s: string) => void;
  setIsRequestingHint: (b: boolean) => void;
  setIsAiSpeaking: (b: boolean) => void;
  setModelStatus: (s: string) => void;
  stopAiPlayback: () => void;
  telemetry: {
    sendSpanRef: { current: { start: () => void; elapsed: () => number | null; collectInto: (a: number[]) => void } };
    roundTripsRef: { current: number[] };
    ttftSamplesRef: { current: number[] };
    ttsSpanRef: { current: { start: () => void; collectInto: (a: number[]) => void } };
    ttsStartupSamplesRef: { current: number[] };
  };
}) {
  const {
    activeContext, activeCodeContext, activeSystemDesignContext, role, level, persona,
    stressTest, setupContext, framework, interviewType, resumeText, aiModel,
    problemStatement, inputText, isRequestingHint, modelsReady, isUsingNativeTTS, kokoroWorker,
    setActiveContext, setActiveCodeContext, setActiveSystemDesignContext, setInputText,
    setIsRequestingHint, setIsAiSpeaking, setModelStatus, stopAiPlayback, telemetry,
  } = opts;
  const { sendSpanRef, roundTripsRef, ttftSamplesRef, ttsSpanRef, ttsStartupSamplesRef } = telemetry;

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
      interviewType,
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
    // Fire-and-forget, exactly as the page did: the composer clears immediately
    // and the pipeline reports its own failures through sendFailure.
    void handleUserInput(inputText.trim());
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
  return {
    messages, setMessages, regenerate, status, isLoading, latencyPhase,
    latestAiMessage, streamTruncated, sendError, sendFailure,
    handleUserInput, handleUserInputRef, handleTextSubmit, requestHint,
  };
}
