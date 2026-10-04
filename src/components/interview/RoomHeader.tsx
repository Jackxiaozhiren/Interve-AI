"use client";

import { Brain, Clock, CornersIn, CornersOut, Pause, Play } from "@phosphor-icons/react";
import { HeaderToggle } from "@/components/interview/HeaderToggle";
import { SoftPacingBar } from "@/components/interview/SoftPacingBar";
import { SystemHealthIndicator } from "@/components/interview/SystemHealthIndicator";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * The room's top bar, moved verbatim out of src/app/interview/page.tsx so the
 * page could come down under its size ceiling.
 *
 * Four of the seven toggles read the accessibility store directly instead of
 * taking props: they are store-owned state, and threading them through the page
 * would only make the page a carrier for values it never uses.
 */
export function RoomHeader({
  stressTest,
  isRecording,
  recordingStartTime,
  isPaused,
  onTogglePaused,
  isThinkTimeEnabled,
  onToggleThinkTime,
  isFocusMode,
  onToggleFocusMode,
}: {
  stressTest: boolean;
  isRecording: boolean;
  recordingStartTime: number | null;
  isPaused: boolean;
  onTogglePaused: () => void;
  isThinkTimeEnabled: boolean;
  onToggleThinkTime: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}) {
  const {
    isCalmMode,
    toggleCalmMode: setIsCalmMode,
    isLiveCaptionsEnabled,
    toggleLiveCaptions,
    isDyslexiaMode,
    toggleDyslexiaMode,
    showLiveInsights,
    toggleLiveInsights,
  } = useAccessibilityStore();
  const { t } = useLanguage();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-full z-10 shrink-0 shadow-[0_8px_32px_rgba(0,0,0,0.02)] mx-2 mt-2">
      <div className="flex items-center gap-3">
        <SystemHealthIndicator isOnline={true} stressTest={stressTest} />
        <h1 className="text-[15px] font-heading font-semibold tracking-tight text-slate-700">
          {stressTest ? "AI 面试间 (压力测试模式)" : "AI 面试间"}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <SoftPacingBar isRecording={isRecording} recordingStartTime={recordingStartTime} />
        <HeaderToggle
          active={isPaused}
          activeClass="bg-rose-500 text-white shadow-md hover:bg-rose-600"
          onClick={onTogglePaused}
          title={isPaused ? "恢复面试 (Esc)" : "暂停思考 (Esc)"}
          label={isPaused ? "恢复面试" : "暂停思考"}
        >
          {isPaused ? <Play className="w-4 h-4" weight="fill" /> : <Pause className="w-4 h-4" weight="fill" />}
        </HeaderToggle>
        <HeaderToggle
          active={isThinkTimeEnabled}
          activeClass="bg-amber-500 text-white shadow-md hover:bg-amber-600"
          onClick={onToggleThinkTime}
          title={isThinkTimeEnabled ? "关闭思考时间" : "开启思考时间 (答题前 10 秒缓冲)"}
          label={isThinkTimeEnabled ? "关闭思考时间" : "开启思考时间"}
        >
          <Clock className="w-4 h-4" />
        </HeaderToggle>
        <HeaderToggle
          active={isCalmMode}
          activeClass="bg-teal-500 text-white shadow-md hover:bg-teal-600"
          onClick={() => setIsCalmMode()}
          title={isCalmMode ? "退出宁静模式" : "开启宁静模式 (防过度视觉刺激)"}
          label={isCalmMode ? "退出宁静模式" : "开启宁静模式"}
        >
          <Brain className="w-4 h-4" />
        </HeaderToggle>
        <HeaderToggle
          active={isFocusMode}
          activeClass="bg-sky-500 text-white shadow-md hover:bg-sky-600"
          onClick={onToggleFocusMode}
          title={isFocusMode ? "退出专注模式 (F)" : "开启专注模式 (F)"}
          label={isFocusMode ? "退出专注模式" : "开启专注模式"}
        >
          {isFocusMode ? <CornersIn className="w-4 h-4" /> : <CornersOut className="w-4 h-4" />}
        </HeaderToggle>
        {/* Phase 9: live AI estimates hidden by default (score distraction). */}
        <HeaderToggle
          active={showLiveInsights}
          activeClass="bg-violet-500 text-white shadow-md hover:bg-violet-600"
          onClick={() => toggleLiveInsights()}
          extraClassName="font-bold text-[10px]"
          title={showLiveInsights ? t.interview.hideAiEstimatesTitle : t.interview.showAiEstimatesTitle}
          label={showLiveInsights ? t.interview.hideAiEstimates : t.interview.showAiEstimates}
        >
          AI
        </HeaderToggle>
        <HeaderToggle
          active={isLiveCaptionsEnabled}
          activeClass="bg-sky-500 text-white shadow-md hover:bg-sky-600"
          onClick={() => toggleLiveCaptions()}
          extraClassName="font-bold text-[10px]"
          title={isLiveCaptionsEnabled ? "关闭字幕" : "开启实时字幕"}
          label={isLiveCaptionsEnabled ? "关闭字幕" : "开启实时字幕"}
        >
          CC
        </HeaderToggle>
        <HeaderToggle
          active={isDyslexiaMode}
          activeClass="bg-amber-500 text-white shadow-md hover:bg-amber-600"
          onClick={() => toggleDyslexiaMode()}
          extraClassName="font-bold text-[12px]"
          title={isDyslexiaMode ? "关闭阅读障碍辅助" : "开启阅读障碍辅助"}
          label={isDyslexiaMode ? "关闭阅读障碍辅助" : "开启阅读障碍辅助"}
        >
          A
        </HeaderToggle>
      </div>
    </header>
  );
}
