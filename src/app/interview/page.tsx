
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "framer-motion";

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      }
    }
  };
}

interface ISpeechRecognitionErrorEvent {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: { new (): ISpeechRecognition };
  webkitSpeechRecognition?: { new (): ISpeechRecognition };
}
import { Microphone, PhoneDisconnect, WarningCircle, PaperPlaneRight, PencilSimple, CornersOut, CornersIn, Brain, Clock, Pause, Play, Lightbulb, Graph, Trash, ArrowsClockwise, Copy } from "@phosphor-icons/react";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { LiveStats } from "@/components/interview/LiveStats";
import { TechnicalScratchpad } from "@/components/interview/TechnicalScratchpad";
import { SystemDesignBoard } from "@/components/interview/SystemDesignBoard";
import { TelemetryWidget } from "@/components/interview/TelemetryWidget";
import { CopilotPanel } from "@/components/interview/CopilotPanel";
import { VisionTelemetry } from "@/components/interview/VisionTelemetry";
import { CopilotHints } from "@/components/interview/CopilotHints";
import { StarTracker } from "@/components/interview/StarTracker";
import { useKeyboardShortcuts, createCtrlCmdShortcut } from "@/hooks/useKeyboardShortcuts";
import { MultiAgentVisualizer, type AIExpert } from "@/components/interview/MultiAgentVisualizer";
import { DynamicLoader } from "@/components/ui/DynamicLoader";
import { SystemHealthIndicator } from "@/components/interview/SystemHealthIndicator";
import { useInterveStore } from "@/store/useInterveStore";
import { useVADInterruption } from "@/hooks/useVADInterruption";
import { FlowMap } from "@/components/interview/FlowMap";
import { PinnedQuestion } from "@/components/interview/PinnedQuestion";
import { SoftPacingBar } from "@/components/interview/SoftPacingBar";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { LiveCaptions } from "@/components/interview/LiveCaptions";
import { useAmbientNoise } from "@/hooks/useAmbientNoise";
import { restoreKnowledgeHub } from "@/lib/orama-client";
import { LiveWaveform } from "@/components/interview/LiveWaveform";
import { TextSelectionMenu } from "@/components/interview/TextSelectionMenu";
import { GreenRoom } from "@/components/interview/GreenRoom";

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
  const [isEnding, setIsEnding] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [isRequestingHint, setIsRequestingHint] = useState(false);
  const [activeExpert, setActiveExpert] = useState<AIExpert>('system');
  

  // Delivery Stats State
  const [wpm, setWpm] = useState(0);
  const [fillerWordsCount, setFillerWordsCount] = useState(0);
  const [sentimentScore, setSentimentScore] = useState<number | undefined>(undefined);
  const [accuracyScore, setAccuracyScore] = useState<number | undefined>(undefined);
  
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [isSystemDesignOpen, setIsSystemDesignOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const { isCalmMode, toggleCalmMode: setIsCalmMode, isLiveCaptionsEnabled, toggleLiveCaptions, isDyslexiaMode, toggleDyslexiaMode } = useAccessibilityStore();
  const isPageVisible = usePageVisibility();
  const [activeUserTranscript, setActiveUserTranscript] = useState("");
  const [visionData, setVisionData] = useState<{ eyeContact: number; posture: number; expression: number } | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [isStandby, setIsStandby] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isThinkTimeEnabled, setIsThinkTimeEnabled] = useState(false);
  const [thinkCountdown, setThinkCountdown] = useState<number | null>(null);
  const [modelLoadError, setModelLoadError] = useState(false);
  const [isGreenRoom, setIsGreenRoom] = useState(!testMode);
  const recordingStartTimeRef = useRef<number | null>(null);
  const totalFillerWordsRef = useRef<number>(0);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const lastAnalysisTimeRef = useRef<number>(0);
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
    // Restore Orama index from IndexedDB for copilot hints
    restoreKnowledgeHub().then(success => {
      if (!success) console.warn("Orama index could not be restored.");
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
  const speechRecognition = useRef<ISpeechRecognition | null>(null);
  
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
        resumeText,
        model: aiModel,
        cognitiveLoad: useInterveStore.getState().cognitiveLoad,
        starProgress: useInterveStore.getState().starProgress,
        behavioralTraits: useInterveStore.getState().behavioralTraits
      }
    }),
    onFinish: (message) => {
      const textToSpeak = (message as { content?: string; text?: string }).content || (message as { content?: string; text?: string }).text || "";
      
      // Check if text contains Chinese characters to route to the appropriate TTS engine
      const hasChinese = /[\u4e00-\u9fa5]/.test(textToSpeak);

      // Send the final text to TTS
      if (isUsingNativeTTS || hasChinese) {
        setIsAiSpeaking(true);
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        // If Chinese characters are present, explicitly request a Chinese voice
        utterance.lang = hasChinese ? 'zh-CN' : 'en-US'; 
        utterance.onend = () => setIsAiSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else if (modelsReady && kokoroWorker.current) {
        setIsAiSpeaking(true);
        setModelStatus("正在生成语音...");
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
      setLatencyPhase(3);
    } else {
      setLatencyPhase(0);
    }
  }, [status]);
  const handleUserInput = async (text: string) => {
    stopAiPlayback();
    
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

    let codeCtx = "";
    try {
      const savedCode = localStorage.getItem("interve_scratchpad_content");
      const mode = localStorage.getItem("interve_scratchpad_mode");
      if (savedCode && mode === "code") {
        codeCtx = savedCode;
        const savedLogs = localStorage.getItem("interve_scratchpad_logs");
        if (savedLogs) {
          const parsedLogs = JSON.parse(savedLogs);
          if (Array.isArray(parsedLogs) && parsedLogs.length > 0) {
            codeCtx += `\n\n【Terminal Output / Execution Logs】:\n` + parsedLogs.map((l: { type: string; message: string }) => `[${l.type}] ${l.message}`).join("\n");
          }
        }
      }
    } catch {}
    setActiveCodeContext(codeCtx);

    let sysDesignCtx = "";
    try {
      const savedDesign = localStorage.getItem("interve_system_design_content");
      if (savedDesign) {
        sysDesignCtx = savedDesign;
      }
    } catch {}
    setActiveSystemDesignContext(sysDesignCtx);

    // Give React a tick to update the context before appending
    setTimeout(() => {
      sendMessage({ text });
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
    
    let codeCtx = "";
    try {
      const savedCode = localStorage.getItem("interve_scratchpad_content");
      if (savedCode) {
        codeCtx = savedCode;
      }
    } catch {}

    const chatHistory = messages.map(m => {
      const msg = m as UIMessage & { content?: string; text?: string };
      return `${msg.role}: ${msg.content || msg.text || ''}`;
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

      if (res.ok) {
        const data = await res.json();
        toast.success("AI 提示 (Hint)", {
          description: data.hint,
          duration: 15000,
          position: "top-center"
        });
      } else {
        toast.error("无法生成提示");
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

  // Phase 26: Session Persistence
  useEffect(() => {
    const interviewId = searchParams?.get('id');
    if (!interviewId || messages.length === 0) return;
    try {
      localStorage.setItem(`interve_session_${interviewId}`, JSON.stringify({
        messages,
        wpm,
        fillerWordsCount
      }));
    } catch {}
  }, [messages, wpm, fillerWordsCount, searchParams]);

  useEffect(() => {
    const interviewId = searchParams?.get('id');
    if (!interviewId) return;
    try {
      const saved = localStorage.getItem(`interve_session_${interviewId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.messages && parsed.messages.length > 0) {
          toast("发现未完成的面试记录", {
            description: "是否恢复之前的对话和状态？",
            action: {
              label: "恢复",
              onClick: () => {
                setMessages(parsed.messages);
                if (parsed.wpm) setWpm(parsed.wpm);
                if (parsed.fillerWordsCount) setFillerWordsCount(parsed.fillerWordsCount);
                toast.success("已恢复对话记录");
              }
            },
            cancel: {
              label: "清除",
              onClick: () => {
                localStorage.removeItem(`interve_session_${interviewId}`);
              }
            },
            duration: 15000,
          });
        }
      }
    } catch {}
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsUsingNativeTTS(true);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModelStatus("");
      return;
    }
    
    whisperWorker.current = new Worker(new URL('../../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
    kokoroWorker.current = new Worker(new URL('../../workers/kokoro.worker.ts', import.meta.url), { type: 'module' });

    audioContext.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 24000 });

    const handleWhisperMessage = (e: MessageEvent) => {
      const { status, text, error } = e.data;
      if (status === 'ready') {
        console.log("Whisper ready");
      } else if (status === 'complete' && text) {
        setModelStatus("");
        
        // Delivery Analysis Logic
        if (recordingStartTimeRef.current) {
           const durationMinutes = (Date.now() - recordingStartTimeRef.current) / 60000;
           if (durationMinutes > 0.05) { // Ensure at least 3 seconds to calculate meaningful WPM
             const words = text.trim().split(/\s+/).length;
             const currentWpm = Math.round(words / durationMinutes);
             setWpm(currentWpm);
           }
           recordingStartTimeRef.current = null;
        }

        // Expanded filler words to include Chinese and common English fillers
        const fillerMatches = text.match(/\b(um|uh|like|you know|basically|so|i mean|ah|那个|就是|然后|嗯|啊|额)\b/gi);
        if (fillerMatches) {
           const finalCount = totalFillerWordsRef.current + fillerMatches.length;
           setFillerWordsCount(finalCount);
           totalFillerWordsRef.current = finalCount;
        }

        // Send transcribed text to API
        if (handleUserInputRef.current) {
          handleUserInputRef.current(text.trim());
        }

        const trimmedText = text.trim();
        const now = Date.now();
        const timeSinceLastAnalysis = now - lastAnalysisTimeRef.current;
        
        // Only trigger heavy STAR and Behavioral analysis if the utterance is substantial and sufficient time has passed (Throttle)
        // This acts as a cooling mechanism to save API calls and prevent backend congestion from rapid rapid stop-start recordings.
        if ((trimmedText.length >= 10 && timeSinceLastAnalysis > 15000) || 
            (activeCodeContextRef.current && timeSinceLastAnalysis > 20000) || 
            (activeSystemDesignContextRef.current && timeSinceLastAnalysis > 20000)) {
          
          lastAnalysisTimeRef.current = now;

          // Phase 35: STAR Progress Analysis
          fetch('/api/analyze-star', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              transcript: trimmedText,
              codeContext: activeCodeContextRef.current,
              systemDesignContext: activeSystemDesignContextRef.current
            })
          }).then(res => res.json()).then(data => {
            if (data && data.s && typeof data.s.progress === 'number') {
              useInterveStore.getState().setStarProgress((prev) => ({
                s: { 
                  progress: Math.max(prev.s.progress, data.s.progress), 
                  confidence: data.s.confidence || 0, 
                  timeSpentSeconds: prev.s.timeSpentSeconds + (data.s.timeSpentSeconds || 0) 
                },
                t: { 
                  progress: Math.max(prev.t.progress, data.t.progress), 
                  confidence: data.t.confidence || 0, 
                  timeSpentSeconds: prev.t.timeSpentSeconds + (data.t.timeSpentSeconds || 0) 
                },
                a: { 
                  progress: Math.max(prev.a.progress, data.a.progress), 
                  confidence: data.a.confidence || 0, 
                  timeSpentSeconds: prev.a.timeSpentSeconds + (data.a.timeSpentSeconds || 0) 
                },
                r: { 
                  progress: Math.max(prev.r.progress, data.r.progress), 
                  confidence: data.r.confidence || 0, 
                  timeSpentSeconds: prev.r.timeSpentSeconds + (data.r.timeSpentSeconds || 0) 
                },
              }));
            }
          }).catch(err => console.error("STAR analysis error:", err));

          // Phase 31: Advanced Behavioral Tracking
          fetch('/api/analyze-behavior', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: trimmedText })
          }).then(res => res.json()).then(data => {
            if (data && typeof data.leadership === 'number') {
              useInterveStore.getState().setBehavioralTraits((prev) => ({
                leadership: Math.max(prev.leadership, data.leadership),
                problemSolving: Math.max(prev.problemSolving, data.problemSolving),
                communication: Math.max(prev.communication, data.communication)
              }));
            }
          }).catch(err => console.error("Behavioral analysis error:", err));
        }
        
      } else if (status === 'error') {
        console.error("Whisper Error:", error);
        setModelStatus("语音识别出错");
        toast.error("语音识别加载失败", { description: "硬件加速或模型资源不可用，请刷新重试" });
      }
    };

    const handleKokoroMessage = async (e: MessageEvent) => {
      const { status, audio, sampleRate, error } = e.data;
      if (status === 'ready') {
        setModelsReady(true);
        setModelStatus("");
      } else if (status === 'complete' && audio) {
        setModelStatus("");
        await playAudio(audio, sampleRate || 24000);
      } else if (status === 'error') {
        console.warn("Kokoro模型加载失败，已切换至浏览器原生语音:", error);
        setIsUsingNativeTTS(true);
        setModelsReady(true); // Make the app usable even if Kokoro fails
        setModelStatus("");
        setIsAiSpeaking(false);
        toast.info("已切换至基础语音模式", { description: "高级语音模型加载失败，但不影响核心面试流程" });
      }
    };

    whisperWorker.current.addEventListener('message', handleWhisperMessage);
    kokoroWorker.current.addEventListener('message', handleKokoroMessage);

    // Trigger loads
    whisperWorker.current.postMessage({ type: 'load' });
    kokoroWorker.current.postMessage({ type: 'load' });

    // Restore Orama Knowledge Hub if needed
    import('@/lib/orama-client').then(({ restoreKnowledgeHub }) => {
      restoreKnowledgeHub();
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
    const msg = lastAss as UIMessage & { content?: string; text?: string; parts?: unknown[] };
    return typeof (msg as unknown as Record<string, unknown>).content === 'string' ? (msg as unknown as Record<string, unknown>).content as string : ((msg as unknown as Record<string, unknown>).text as string || "");
  })();

  useEffect(() => {
    if (latestAiMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (latestAiMessage.startsWith('[Tech]')) setActiveExpert('tech');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      else if (latestAiMessage.startsWith('[HR]')) setActiveExpert('hr');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      else if (latestAiMessage.startsWith('[Product]')) setActiveExpert('product');
    }
  }, [latestAiMessage]);

  useVADInterruption(isAiSpeaking, () => {
    stopAiPlayback();
    toast.info("🎤 检测到您的发言", { description: "AI已暂停，您可以继续表达" });
    if (!isRecording && modelsReady && !isStandby) {
      startRecording();
    }
  });

  // Phase 38: Ambient Noise Warning
  useAmbientNoise(!isStandby && !isRecording && !isAiSpeaking && !isPaused, 20, 180);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleEndCall = async () => {
    if (isEnding) return;
    setIsEnding(true);
    stopAiPlayback();
    setActiveStream(null);
    
    // Stop recording if active
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    
    import('canvas-confetti').then((confetti) => {
      confetti.default({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b']
      });
    });
    
    toast("面试结束", { description: "正在生成您的详细分析报告...", duration: 5000 });
    
    try {
      const interviewId = searchParams?.get('id');
      
      if (messages.length > 0 && interviewId) {
        // Fetch analysis
        const res = await fetch("/api/analyze-interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages })
        });
        
        if (res.ok) {
          const { radarScores, qaReview, hireVerdict } = await res.json();
          
          // Save to Dexie
          const id = parseInt(interviewId, 10);
          const bodyLanguageScore = visionData 
            ? Math.round((visionData.eyeContact + visionData.posture + visionData.expression) / 3) 
            : 0;
            
          await db.interviews.update(id, {
            status: 'completed',
            radarScores: {
              ...radarScores,
              bodyLanguage: bodyLanguageScore
            },
            qaReview,
            hireVerdict,
            transcript: messages.map((m: UIMessage & { content?: string; parts?: unknown[]; createdAt?: Date }) => ({
              id: m.id,
              role: m.role,
              content: typeof (m as unknown as Record<string, unknown>).content === 'string' ? (m as unknown as Record<string, unknown>).content as string : JSON.stringify((m as unknown as Record<string, unknown>).content || m.parts),
              createdAt: m.createdAt || new Date()
            })),
            deliveryStats: {
              wpm: wpm || 0,
              fillerWords: fillerWordsCount || 0
            },
            updatedAt: new Date()
          });

          // Phase 24: Check and unlock achievements
          const updatedInterview = await db.interviews.get(id);
          if (updatedInterview) {
            const { checkAndUnlockAchievements } = await import("@/lib/achievements");
            const newAchievements = await checkAndUnlockAchievements(updatedInterview);
            if (newAchievements.length > 0) {
              newAchievements.forEach(ach => {
                toast.success(`🏆 Achievement Unlocked: ${ach.icon} ${ach.title}`, {
                  description: ach.description,
                  duration: 8000,
                  position: "top-center"
                });
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Error analyzing interview:", e);
      toast.error("生成报告时出错", { description: "我们将保留部分数据" });
    }
    
    window.location.href = searchParams?.get('id') ? `/dashboard/report/${searchParams.get('id')}` : "/dashboard";
  };


  async function startRecording() {
    try {
      // Voice interruption: Stop AI speaking if user starts talking
      stopAiPlayback();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setActiveStream(stream);
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      // SpeechRecognition for Real-time Telemetry & API Analysis
      const SpeechRecognition = (window as unknown as IWindowWithSpeech).SpeechRecognition || (window as unknown as IWindowWithSpeech).webkitSpeechRecognition;
      if (SpeechRecognition) {
         speechRecognition.current = new SpeechRecognition();
         speechRecognition.current.continuous = true;
         speechRecognition.current.interimResults = true;
         speechRecognition.current.lang = 'zh-CN'; // Defaulting to Chinese, but will pick up English too
         
         let accumulatedDraft = "";
         let localFillerCount = 0;

         speechRecognition.current.onresult = (event: ISpeechRecognitionEvent) => {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
               if (event.results[i].isFinal) {
                  finalTranscript += event.results[i][0].transcript;
               } else {
                  interimTranscript += event.results[i][0].transcript;
               }
            }
            
            const currentDraft = accumulatedDraft + finalTranscript + interimTranscript;
            
            // Update speech time to avoid silence penalty
            lastSpeechTimeRef.current = Date.now();
            setCognitiveLoad(prev => Math.max(0, prev - 1)); // Active speaking slightly reduces load
            
            // Calculate WPM
            if (recordingStartTimeRef.current) {
               const durationMinutes = (Date.now() - recordingStartTimeRef.current) / 60000;
               if (durationMinutes > 0.05) {
                  const words = currentDraft.trim().split(/\s+/).length;
                  const currentWpm = Math.round(words / durationMinutes);
                  setWpm(currentWpm);
               }
            }
            setActiveUserTranscript(currentDraft);
            
            // Filler words check (hesitation tracking)
            const fillerMatches = currentDraft.match(/\b(um|uh|like|you know|basically|so|i mean|ah|那个|就是|然后|嗯|啊|额)\b/gi);
            if (fillerMatches) {
               setFillerWordsCount(totalFillerWordsRef.current + fillerMatches.length);
               const newFillers = fillerMatches.length - localFillerCount;
               if (newFillers > 0) {
                  // Phase 2: Voice Pattern Extraction (Hesitation)
                  // Increase cognitive load significantly for repeated hesitation
                  setCognitiveLoad(prev => Math.min(100, prev + newFillers * 5));
                  localFillerCount = fillerMatches.length;
               }
            }
            
            // Parallel API Analysis on final chunks
            if (finalTranscript.trim()) {
               accumulatedDraft += finalTranscript;
               
               fetch('/api/analyze-chunk', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                     text: finalTranscript.trim(),
                     context: activeContext,
                     role,
                     level
                  })
               })
               .then(res => res.json())
               .then(data => {
                  if (data.sentimentScore !== undefined) setSentimentScore(data.sentimentScore);
                  if (data.technicalAccuracy !== undefined) setAccuracyScore(data.technicalAccuracy);
               })
               .catch(err => console.error("Chunk analysis error:", err));
            }
         };
         speechRecognition.current.onerror = (e: ISpeechRecognitionErrorEvent) => {
            console.warn("Speech recognition error:", e.error);
         };
         
         speechRecognition.current.start();
      }

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setModelStatus("正在识别语音...");
        
        // Decode audio to 16kHz Float32Array for Whisper
        const tempContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 16000 });
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await tempContext.decodeAudioData(arrayBuffer);
        const float32Data = decoded.getChannelData(0);
        
        whisperWorker.current?.postMessage({
          type: 'transcribe',
          audio: float32Data
        }, [float32Data.buffer]);
        
        // Clean up mic stream
        stream.getTracks().forEach(track => track.stop());
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
      setThinkCountdown(10);
    } else {
      setThinkCountdown(null);
      startRecording();
    }
  };

  useKeyboardShortcuts([
    {
      key: "Escape",
      allowInInput: true,
      handler: () => {
        setIsPaused(prev => {
          const newPaused = !prev;
          if (newPaused) {
            stopRecording();
            stopAiPlayback();
            toast("面试已暂停", { description: "已静音并模糊屏幕，按 Esc 恢复" });
          } else {
            toast("面试恢复", { description: "计时已恢复" });
          }
          return newPaused;
        });
      }
    },
    {
      key: "f",
      allowInInput: false,
      handler: () => {
        setIsFocusMode(prev => {
          const newMode = !prev;
          toast(newMode ? "已开启专注模式" : "已退出专注模式", {
            description: newMode ? "干扰元素已隐藏，按 F 键恢复" : "遥测数据已恢复显示"
          });
          return newMode;
        });
      }
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
      <AnimatePresence>
        {isPaused && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/30 text-slate-800"
          >
            <WarningCircle weight="duotone" className="w-16 h-16 text-rose-500 mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold font-heading mb-2">面试已暂停</h2>
            <p className="text-slate-600 font-medium">麦克风已静音，倒计时已暂停。按 <kbd className="px-2 py-1 bg-white shadow-sm rounded-md border border-slate-200 text-slate-800 mx-1">Esc</kbd> 恢复面试。</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {thinkCountdown !== null && thinkCountdown > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm"
          >
            <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl border border-white/60 flex flex-col items-center min-w-[300px]">
              {isCalmMode ? (
                <div className="w-full min-w-[200px] mb-6 mt-4">
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      className="h-full bg-amber-400 rounded-full"
                      initial={{ width: '100%' }}
                      animate={{ width: `${(thinkCountdown / 10) * 100}%` }}
                      transition={{ duration: 1, ease: "linear" }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-6xl font-mono text-amber-500 mb-2 font-bold tracking-tighter">{thinkCountdown}</div>
              )}
              <h3 className="text-lg font-medium text-slate-700 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                {isCalmMode ? "正在为您预留思考时间..." : "思考时间"}
              </h3>
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => setThinkCountdown(null)} className="flex-1 rounded-full border-slate-200">取消录音</Button>
                <Button onClick={() => setThinkCountdown(0)} className="flex-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-sm border-none">直接开始</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full z-10 shrink-0 shadow-[0_8px_32px_rgba(0,0,0,0.02)] mx-2 mt-2">
        <div className="flex items-center gap-3">
          <SystemHealthIndicator isOnline={true} wsLatency={45} stressTest={stressTest} />
          <h1 className="text-[15px] font-heading font-semibold tracking-tight text-slate-700">
            {stressTest ? "AI 面试间 (压力测试模式)" : "AI 面试间"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <SoftPacingBar isRecording={isRecording} recordingStartTime={recordingStartTime} />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setIsPaused(prev => {
                const newPaused = !prev;
                if (newPaused) {
                  stopRecording();
                  stopAiPlayback();
                  toast("面试已暂停", { description: "已静音并模糊屏幕，按 Esc 恢复" });
                } else {
                  toast("面试恢复", { description: "计时已恢复" });
                }
                return newPaused;
              });
            }}
            className={`rounded-full transition-all duration-300 ${isPaused ? 'bg-rose-500 text-white shadow-md hover:bg-rose-600' : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800 shadow-sm border border-white'}`}
            title={isPaused ? "恢复面试 (Esc)" : "暂停思考 (Esc)"}
            aria-label={isPaused ? "恢复面试" : "暂停思考"}
          >
            {isPaused ? <Play className="w-4 h-4" weight="fill" /> : <Pause className="w-4 h-4" weight="fill" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsThinkTimeEnabled(!isThinkTimeEnabled)}
            className={`rounded-full transition-all duration-300 ${isThinkTimeEnabled ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600' : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800 shadow-sm border border-white'}`}
            title={isThinkTimeEnabled ? "关闭思考时间" : "开启思考时间 (答题前 10 秒缓冲)"}
            aria-label={isThinkTimeEnabled ? "关闭思考时间" : "开启思考时间"}
          >
            <Clock className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsCalmMode()}
            className={`rounded-full transition-all duration-300 ${isCalmMode ? 'bg-teal-500 text-white shadow-md hover:bg-teal-600' : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800 shadow-sm border border-white'}`}
            title={isCalmMode ? "退出宁静模式" : "开启宁静模式 (防过度视觉刺激)"}
            aria-label={isCalmMode ? "退出宁静模式" : "开启宁静模式"}
          >
            <Brain className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`rounded-full transition-all duration-300 ${isFocusMode ? 'bg-sky-500 text-white shadow-md hover:bg-sky-600' : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800 shadow-sm border border-white'}`}
            title={isFocusMode ? "退出专注模式 (F)" : "开启专注模式 (F)"}
            aria-label={isFocusMode ? "退出专注模式" : "开启专注模式"}
          >
            {isFocusMode ? <CornersIn className="w-4 h-4" /> : <CornersOut className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggleLiveCaptions()}
            className={`rounded-full transition-all duration-300 font-bold text-[10px] ${isLiveCaptionsEnabled ? 'bg-sky-500 text-white shadow-md hover:bg-sky-600' : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800 shadow-sm border border-white'}`}
            title={isLiveCaptionsEnabled ? "关闭字幕" : "开启实时字幕"}
            aria-label={isLiveCaptionsEnabled ? "关闭字幕" : "开启实时字幕"}
          >
            CC
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggleDyslexiaMode()}
            className={`rounded-full transition-all duration-300 font-bold text-[12px] ${isDyslexiaMode ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600' : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-800 shadow-sm border border-white'}`}
            title={isDyslexiaMode ? "关闭阅读障碍辅助" : "开启阅读障碍辅助"}
            aria-label={isDyslexiaMode ? "关闭阅读障碍辅助" : "开启阅读障碍辅助"}
          >
            A
          </Button>
        </div>
      </header>

      <div className="px-2 shrink-0">
        <FlowMap messageCount={messages.length} />
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 flex-1 overflow-hidden gap-4 px-2 pb-2">
        
        {/* Left: 70% (Bento Stack) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4 overflow-hidden">
           {/* Top: AI Avatar (Main Bento Card) */}
           <div className={`flex-1 flex flex-col items-center justify-center relative glass rounded-[32px] overflow-hidden transition-colors duration-1000 ${stressTest ? 'border-2 border-rose-300/50 shadow-[inset_0_0_40px_rgba(244,63,94,0.1)]' : ''}`}>
               {/* StarTracker (Absolute) */}
               <AnimatePresence>
                 {!isFocusMode && framework === 'star' && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                      className="absolute inset-0 pointer-events-none [&>*]:pointer-events-auto z-10"
                    >
                      <StarTracker />
                    </motion.div>
                 )}
               </AnimatePresence>

               {/* Tab Abandonment / Focus Lost Overlay */}
               <AnimatePresence>
                 {!isPageVisible && (
                   <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-xl"
                   >
                     <div className="bg-white/80 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-md border border-white/50">
                       <WarningCircle className="w-16 h-16 text-rose-400 mb-4" />
                       <h2 className="text-2xl font-bold text-slate-800 mb-2">Focus Lost</h2>
                       <p className="text-slate-600 mb-6">You have switched tabs. For the integrity of the interview, please keep this tab active.</p>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Live Captions */}
               <LiveCaptions 
                 isVisible={isLiveCaptionsEnabled} 
                 speaker={isAiSpeaking ? 'AI' : (isRecording ? 'User' : null)}
                 text={isAiSpeaking ? latestAiMessage : activeUserTranscript}
               />

               {/* Pinned Question */}
               <PinnedQuestion questionText={latestAiMessage} isVisible={isRecording && !isFocusMode} />

               {/* Ambient Background Glows - Liquid Fluid Animation */}
               {!isCalmMode && (
                 <>
                   <motion.div 
                     animate={{
                       scale: [1, 1.1, 1],
                       x: ["-50%", "-48%", "-50%"],
                       y: ["-50%", "-52%", "-50%"],
                       opacity: [0.5, 0.7, 0.5]
                     }}
                     transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                     className={`absolute top-1/2 left-1/2 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] ${stressTest ? 'bg-rose-200/40' : 'bg-sky-200/50'} blur-[100px] rounded-full pointer-events-none`} 
                   />
                   <motion.div 
                     animate={{
                       scale: [1, 1.2, 1],
                       x: ["-30%", "-40%", "-30%"],
                       y: ["-60%", "-70%", "-60%"],
                       borderRadius: ["40% 60% 70% 30%/50% 60% 30% 60%", "60% 40% 30% 70%/60% 30% 70% 40%", "40% 60% 70% 30%/50% 60% 30% 60%"]
                     }}
                     transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                     className={`absolute top-1/2 left-1/2 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] ${stressTest ? 'bg-orange-200/30' : 'bg-emerald-200/40'} blur-[100px] pointer-events-none mix-blend-multiply`} 
                   />
                   <motion.div 
                     animate={{
                       scale: [1, 1.1, 1],
                       x: ["-70%", "-60%", "-70%"],
                       y: ["-30%", "-40%", "-30%"],
                       borderRadius: ["60% 40% 30% 70%/60% 30% 70% 40%", "40% 60% 70% 30%/50% 60% 30% 60%", "60% 40% 30% 70%/60% 30% 70% 40%"]
                     }}
                     transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                     className={`absolute top-1/2 left-1/2 w-[45vw] h-[45vw] max-w-[550px] max-h-[550px] ${stressTest ? 'bg-red-200/20' : 'bg-teal-200/30'} blur-[110px] pointer-events-none mix-blend-multiply`} 
                   />
                 </>
               )}
               
               {isCalmMode && (
                 <div className={`absolute inset-0 rounded-[32px] ${stressTest ? 'bg-rose-50/50' : 'bg-sky-50/50'} backdrop-blur-3xl`} />
               )}
               
               {!modelsReady && (
                 <div 
                   role="status" 
                   aria-live="polite" 
                   className="absolute top-6 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md text-slate-500 rounded-full text-xs font-medium border border-white shadow-sm z-20"
                 >
                   <WarningCircle className="w-4 h-4 text-sky-400" aria-hidden="true" /> 正在初始化AI模型组件...
                 </div>
               )}
              
               <MultiAgentVisualizer isSpeaking={isAiSpeaking} isLoading={isLoading || !modelsReady} statusText={modelStatus} stressTest={stressTest} wpm={wpm} isCalmMode={isCalmMode} activeExpert={activeExpert} />

               {/* Add LiveWaveform here if recording */}
               <AnimatePresence>
                 {isRecording && activeStream && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     className="absolute bottom-28 w-[300px] z-10"
                   >
                     <LiveWaveform stream={activeStream} isRecording={isRecording} />
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Liquid Glass Controls Dock */}
               <div className="absolute bottom-8 z-20 flex items-center justify-center w-full px-6">
                  <div className="bg-white/30 backdrop-blur-[24px] rounded-[32px] p-2.5 flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-white/40">
                    <motion.button 
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      disabled={!modelsReady || isLoading}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className={`group relative w-12 h-12 rounded-full flex items-center justify-center outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                        isRecording 
                          ? 'bg-rose-400 text-white shadow-[0_0_20px_rgba(251,113,133,0.3)] border border-rose-300' 
                          : 'bg-white text-slate-600 hover:text-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-white/80'
                      }`}
                      aria-label={isRecording ? "停止录音" : "开始录音"}
                      aria-pressed={isRecording}
                    >
                      <Microphone className="w-5 h-5" />
                      {isRecording ? (
                         <span className="absolute -top-10 text-[11px] font-medium text-rose-500 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full whitespace-nowrap shadow-sm border border-rose-100">
                           正在录音...
                         </span>
                      ) : (
                         <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-slate-500 bg-white/90 backdrop-blur-md px-2 py-1 rounded-md whitespace-nowrap shadow-sm border border-slate-200/50 flex items-center gap-1 pointer-events-none">
                           按 <kbd className="font-sans px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 shadow-sm leading-none">空格</kbd> 说话
                         </div>
                      )}
                    </motion.button>

                    <div className="w-px h-6 bg-slate-200/60" />

                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => setIsScratchpadOpen(true)}
                      title="Open Scratchpad"
                      aria-label="打开白板 (Scratchpad)"
                    >
                      <PencilSimple className="w-5 h-5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => setIsSystemDesignOpen(true)}
                      title="Open System Design Board"
                      aria-label="打开系统设计 (System Design)"
                    >
                      <Graph className="w-5 h-5 text-indigo-500" />
                    </Button>

                    <div className="w-px h-6 bg-slate-200/60" />

                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={requestHint}
                      disabled={isRequestingHint}
                      title="Request Hint"
                      aria-label="请求代码提示 (Hint)"
                    >
                      {isRequestingHint ? (
                         <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                         <Lightbulb className="w-5 h-5 text-amber-500" />
                      )}
                    </Button>

                    <div className="w-px h-6 bg-slate-200/60" />

                    <div className="relative flex items-center w-full md:w-[280px]">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && inputText.trim()) {
                            handleTextSubmit();
                          }
                        }}
                        disabled={!modelsReady || isLoading}
                        placeholder="输入文本..."
                        aria-label="输入您的回答或向AI提问"
                        className="w-full bg-transparent border-none focus:ring-0 h-10 pl-3 pr-12 text-[14px] text-slate-700 font-medium placeholder:text-slate-400 outline-none transition-all focus-visible:ring-2 focus-visible:ring-sky-500 rounded-full"
                      />
                      <Button 
                        size="icon"
                        onClick={handleTextSubmit}
                        disabled={!inputText.trim() || !modelsReady || isLoading}
                        className="group absolute right-1 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                        aria-label="发送消息"
                      >
                        <PaperPlaneRight className="w-3.5 h-3.5 ml-0.5" />
                        <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-slate-500 bg-white/90 backdrop-blur-md px-2 py-1 rounded-md whitespace-nowrap shadow-sm border border-slate-200/50 flex items-center gap-1 pointer-events-none">
                           <kbd className="font-sans px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 shadow-sm leading-none">⌘</kbd>
                           <kbd className="font-sans px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 shadow-sm leading-none">↵</kbd>
                         </div>
                      </Button>
                    </div>
                  </div>
               </div>
            </div>

            {/* Bottom: Telemetry Bento Row */}
            <AnimatePresence>
              {!isFocusMode && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: 20, height: 0, transition: { duration: 0.2 } }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 shrink-0"
                >
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <LiveStats 
                      wpm={wpm} 
                      fillerWordsCount={fillerWordsCount} 
                      visionScore={visionData ? (visionData.eyeContact + visionData.posture + visionData.expression) / 3 : undefined}
                      sentimentScore={sentimentScore}
                      accuracyScore={accuracyScore}
                    />
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <TelemetryWidget isRecording={isRecording} isAiSpeaking={isAiSpeaking} wpm={wpm} />
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <VisionTelemetry onVisionDataUpdate={setVisionData} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
        </div>

        {/* Right: Transcript / Chat History */}
        <div className="w-full lg:w-[400px] flex flex-col glass rounded-[32px] overflow-hidden shrink-0 h-[50vh] lg:h-auto mb-2 mr-2">
          <div className="px-6 py-5 border-b border-white/40 flex justify-between items-center z-10 relative">
            <h2 className="font-heading font-medium text-slate-800 text-[15px]">实时对话</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-slate-500">AI Copilot</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth" role="log" aria-live="polite" aria-atomic="false">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
                <div className="w-12 h-12 rounded-full bg-white/50 border border-white flex items-center justify-center shadow-sm">
                  <Microphone className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-slate-500 text-[13px] font-medium max-w-[200px]">
                  长按麦克风或输入文本以开始面试
                </p>
              </div>
            )}
            
            {messages.map((m, idx) => {
              const content = typeof (m as unknown as Record<string, unknown>).content === 'string' ? (m as unknown as Record<string, unknown>).content as string : ((m as unknown as Record<string, unknown>).text as string || '');
              const isLastMessage = idx === messages.length - 1;
              return (
              <motion.div
                layout="position"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                key={m.id}
                className={`flex flex-col group ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5 px-1">
                  {m.role === 'user' ? '我' : 'Interve AI'}
                </div>
                <div className={`px-5 py-3.5 max-w-[85%] text-[14.5px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${
                  m.role === 'user' 
                    ? 'bg-slate-800 text-white rounded-[20px] rounded-br-sm border border-slate-700/50 leading-relaxed' 
                    : `bg-white/60 backdrop-blur-3xl border border-white/60 text-[#111111] rounded-[20px] rounded-bl-sm font-medium shadow-[0_8px_32px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.8)] ${isDyslexiaMode ? 'font-mono text-[15px] tracking-[0.05em] leading-[1.8]' : 'leading-relaxed'}`
                }`}>
                  {content}
                </div>
                
                {/* Actions */}
                <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${m.role === 'user' ? 'flex-row-reverse mr-1' : 'ml-1'}`}>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(content);
                      toast.success("已复制到剪贴板", { position: "top-center" });
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                    title="复制"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {isLastMessage && (
                    <button 
                      onClick={() => regenerate()}
                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors"
                      title="重新生成"
                    >
                      <ArrowsClockwise className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button 
                    onClick={() => setMessages(messages.filter(msg => msg.id !== m.id))}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title="删除消息"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )})}
            {isLoading && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-start">
                 <div className="px-4 py-3 bg-white/80 backdrop-blur-md border border-white text-slate-500 rounded-2xl rounded-bl-sm text-sm flex flex-col gap-2 shadow-sm min-w-[140px]">
                   <div className="flex gap-1.5 items-center">
                     <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                     <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                     <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                   </div>
                   {status === 'submitted' && (
                     <motion.div 
                       key={latencyPhase}
                       initial={{ opacity: 0, height: 0 }}
                       animate={{ opacity: 1, height: 'auto' }}
                       className="text-xs font-medium text-slate-400 whitespace-nowrap overflow-hidden"
                     >
                       {latencyPhase === 0 && "正在思考中..."}
                       {latencyPhase === 1 && "正在深度分析上下文..."}
                       {latencyPhase === 2 && "正在构建完美答复..."}
                     </motion.div>
                   )}
                 </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
            
            {/* Copilot Panel (Only shows when there is an AI question) */}
            <AnimatePresence>
              {!isFocusMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
                  className="overflow-hidden"
                >
                  <CopilotPanel 
                    latestAiMessage={latestAiMessage} 
                    messages={messages}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-4 bg-white/40 border-t border-white/40">
            <Button 
              variant="outline" 
              className="w-full rounded-full h-12 font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 border-white bg-white/50 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              onClick={handleEndCall}
              disabled={isEnding}
              aria-label="结束面试并生成报告"
            >
              {isEnding ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                  正在生成报告...
                </>
              ) : (
                <>
                  <PhoneDisconnect className="w-4 h-4 mr-2" />
                  结束面试
                </>
              )}
            </Button>
          </div>
        </div>
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
          visionData={visionData} 
          isRecording={isRecording} 
        />
      )}

      {/* Standby / Click to Start Overlay */}
      <AnimatePresence>
        {isStandby && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-10 rounded-[32px] shadow-2xl flex flex-col items-center text-center max-w-md border border-white/50"
            >
              <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mb-6 border border-sky-100 shadow-sm">
                 <Play className="w-10 h-10 text-sky-500 ml-1" weight="fill" />
              </div>
              <h2 className="text-3xl font-bold font-heading text-slate-800 mb-3">准备好开始了吗？</h2>
              <p className="text-slate-500 mb-8 leading-relaxed text-[15px]">
                您的硬件检测已完成。点击下方按钮正式进入面试状态。深呼吸，放松心情。
              </p>
              <div className="w-full flex flex-col gap-3">
                <Button 
                  onClick={() => {
                    if (!modelsReady && modelLoadError) {
                      setModelsReady(true);
                      setIsUsingNativeTTS(true);
                      toast.info("已切换至基础语音模式", { description: "由于加载超时，已为您切换到基础引擎" });
                    }
                    setIsStandby(false);
                    handleStartSpeaking();
                  }}
                  disabled={!modelsReady && !modelLoadError}
                  className="w-full h-14 text-lg rounded-full bg-slate-800 hover:bg-slate-700 text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {modelsReady ? "开始面试" : (modelLoadError ? "强制开始 (基础模式)" : "正在加载 AI 引擎...")}
                </Button>
                {(!modelsReady && modelLoadError) && (
                  <p className="text-xs text-amber-500 font-medium px-2">
                    AI 引擎加载时间过长，您可以强制开始，系统将自动切换为基础语音。
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End of Interview Overlay */}
      <AnimatePresence>
        {isEnding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xl"
          >
            <DynamicLoader 
              phrases={[
                "Compiling Hiring Committee Feedback...", 
                "Analyzing delivery metrics...", 
                "Structuring performance report...", 
                "Synthesizing AI evaluation..."
              ]}
            />
          </motion.div>
        )}
      </AnimatePresence>
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
