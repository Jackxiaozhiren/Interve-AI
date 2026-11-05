"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Brain, Clock, CornersIn, CornersOut, DotsThree, Pause, Play } from "@phosphor-icons/react";
import { HeaderToggle } from "@/components/interview/HeaderToggle";
import { SoftPacingBar } from "@/components/interview/SoftPacingBar";
import { SystemHealthIndicator } from "@/components/interview/SystemHealthIndicator";
import { QuotaBadge } from "@/components/interview/QuotaBadge";
import { THINK_TIME_SECONDS } from "@/lib/interview/think-time";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * The room's top bar, moved verbatim out of src/app/interview/page.tsx so the
 * page could come down under its size ceiling.
 *
 * Four of the seven toggles read the accessibility store directly instead of
 * taking props: they are store-owned state, and threading them through the page
 * would only make the page a carrier for values it never uses.
 *
 * Below md the seven toggles collapse into one menu. In a single non-wrapping
 * row they needed 436 px, which is wider than the 390 px phone they were being
 * shown on: Chrome widened the layout viewport to 528 and scaled the page to
 * 0.74, so the room rendered as a shrunken desktop. The menu is built from the
 * same descriptors as the desktop row, so a toggle cannot exist in one and be
 * missing from the other.
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The menu is portalled to the body and positioned from the trigger's rect. It
  // started inside the header, where `z-10` on a `relative` bar did not put it
  // above the stage: elementFromPoint resolved to the stage's own row, and the
  // menu was there, visible and unclickable. A fixed layer at the top of the tree
  // has no such argument to lose.
  const toggleMenu = () => {
    if (moreOpen) {
      setMoreOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setMenuPosition({ top: Math.round(rect.bottom + 8), right: Math.round(window.innerWidth - rect.right) });
    setMoreOpen(true);
  };

  // Escape is the way out of any overlay; a menu that traps focus on a phone is
  // worse than no menu, because the toggle it covers is the one you want.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [moreOpen]);

  const toggles = [
    {
      key: "pause",
      active: isPaused,
      activeClass: "bg-rose-500 text-white shadow-md hover:bg-rose-600",
      onClick: onTogglePaused,
      title: isPaused ? "恢复面试 (Esc)" : "暂停思考 (Esc)",
      label: isPaused ? "恢复面试" : "暂停思考",
      icon: isPaused ? <Play className="w-4 h-4" weight="fill" /> : <Pause className="w-4 h-4" weight="fill" />,
    },
    {
      key: "think-time",
      active: isThinkTimeEnabled,
      activeClass: "bg-amber-500 text-white shadow-md hover:bg-amber-600",
      onClick: onToggleThinkTime,
      title: isThinkTimeEnabled ? "关闭思考时间" : `开启思考时间 (答题前 ${THINK_TIME_SECONDS} 秒缓冲)`,
      label: isThinkTimeEnabled ? "关闭思考时间" : "开启思考时间",
      icon: <Clock className="w-4 h-4" />,
    },
    {
      key: "calm",
      active: isCalmMode,
      activeClass: "bg-teal-500 text-white shadow-md hover:bg-teal-600",
      onClick: () => setIsCalmMode(),
      title: isCalmMode ? "退出宁静模式" : "开启宁静模式 (防过度视觉刺激)",
      label: isCalmMode ? "退出宁静模式" : "开启宁静模式",
      icon: <Brain className="w-4 h-4" />,
    },
    {
      key: "focus",
      active: isFocusMode,
      activeClass: "bg-sky-500 text-white shadow-md hover:bg-sky-600",
      onClick: onToggleFocusMode,
      title: isFocusMode ? "退出专注模式 (F)" : "开启专注模式 (F)",
      label: isFocusMode ? "退出专注模式" : "开启专注模式",
      icon: isFocusMode ? <CornersIn className="w-4 h-4" /> : <CornersOut className="w-4 h-4" />,
    },
    {
      key: "insights",
      active: showLiveInsights,
      activeClass: "bg-violet-500 text-white shadow-md hover:bg-violet-600",
      onClick: () => toggleLiveInsights(),
      title: showLiveInsights ? t.interview.hideAiEstimatesTitle : t.interview.showAiEstimatesTitle,
      label: showLiveInsights ? t.interview.hideAiEstimates : t.interview.showAiEstimates,
      icon: <span className="text-[10px] font-bold leading-none">AI</span>,
    },
    {
      key: "captions",
      active: isLiveCaptionsEnabled,
      activeClass: "bg-sky-500 text-white shadow-md hover:bg-sky-600",
      onClick: () => toggleLiveCaptions(),
      title: isLiveCaptionsEnabled ? "关闭字幕" : "开启实时字幕",
      label: isLiveCaptionsEnabled ? "关闭字幕" : "开启实时字幕",
      icon: <span className="text-[10px] font-bold leading-none">CC</span>,
    },
    {
      key: "dyslexia",
      active: isDyslexiaMode,
      activeClass: "bg-amber-500 text-white shadow-md hover:bg-amber-600",
      onClick: () => toggleDyslexiaMode(),
      title: isDyslexiaMode ? "关闭阅读障碍辅助" : "开启阅读障碍辅助",
      label: isDyslexiaMode ? "关闭阅读障碍辅助" : "开启阅读障碍辅助",
      icon: <span className="text-[12px] font-bold leading-none">A</span>,
    },
  ];

  return (
    <header className="relative flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-4 bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] sm:rounded-full z-10 shrink-0 shadow-[0_8px_32px_rgba(0,0,0,0.02)] mx-2 mt-2">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SystemHealthIndicator stressTest={stressTest} />
        <QuotaBadge />
        <h1 className="truncate text-[15px] font-heading font-semibold tracking-tight text-slate-700">
          {stressTest ? "AI 面试间 (压力测试模式)" : "AI 面试间"}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <SoftPacingBar isRecording={isRecording} recordingStartTime={recordingStartTime} />

        <div className="hidden md:flex items-center gap-2 lg:gap-3">
          {toggles.map(({ key, icon, ...toggle }) => (
            <HeaderToggle key={key} {...toggle}>
              {icon}
            </HeaderToggle>
          ))}
        </div>

        <button
          ref={triggerRef}
          type="button"
          onClick={toggleMenu}
          aria-label="更多设置"
          aria-haspopup="true"
          aria-expanded={moreOpen}
          aria-controls="room-more-toggles"
          title="更多设置"
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-full border border-white bg-white/80 text-slate-700 shadow-sm transition-colors hover:bg-white hover:text-slate-800"
        >
          <DotsThree className="w-5 h-5" weight="bold" aria-hidden="true" />
        </button>
      </div>

      {moreOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            id="room-more-toggles"
            style={{ top: menuPosition.top, right: menuPosition.right }}
            className="md:hidden fixed z-[60] flex w-60 flex-col gap-1 rounded-[24px] border border-white/60 bg-white/95 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.18)] backdrop-blur-xl"
          >
            {toggles.map(({ key, icon, ...toggle }) => (
              <HeaderToggle key={key} {...toggle} withLabel>
                {icon}
              </HeaderToggle>
            ))}
          </div>,
          document.body,
        )}
    </header>
  );
}
