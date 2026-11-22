"use client";

import { toast } from "sonner";
import { THINK_TIME_SECONDS } from "@/lib/interview/think-time";

/**
 * S4 slice 14: the room's control handlers — push-to-talk, the standby escape
 * hatch, pause and focus mode. Moved verbatim from page.tsx; every setter and
 * recorder call is injected so this file holds the decision and nothing else.
 */
export function useRoomControls(opts: {
  isRecording: boolean;
  isPaused: boolean;
  isFocusMode: boolean;
  isThinkTimeEnabled: boolean;
  thinkCountdown: number | null;
  modelsReady: boolean;
  modelLoadError: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  stopAiPlayback: () => void;
  setThinkCountdown: (n: number | null) => void;
  setIsPaused: (b: boolean) => void;
  setIsFocusMode: (b: boolean) => void;
  setIsStandby: (b: boolean) => void;
  setModelsReady: (b: boolean) => void;
  setIsUsingNativeTTS: (b: boolean) => void;
}) {
  const {
    isRecording, isPaused, isFocusMode, isThinkTimeEnabled, thinkCountdown,
    modelsReady, modelLoadError, startRecording, stopRecording, stopAiPlayback,
    setThinkCountdown, setIsPaused, setIsFocusMode, setIsStandby,
    setModelsReady, setIsUsingNativeTTS,
  } = opts;

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

  return { handleStartSpeaking, startFromStandby, togglePaused, toggleFocusMode };
}
