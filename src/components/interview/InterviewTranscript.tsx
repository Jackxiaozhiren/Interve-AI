"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowsClockwise, Copy, Microphone, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { RefObject } from "react";
import { getMessageText } from "@/lib/message-text";
import { copyTextToClipboard } from "@/lib/clipboard";
import { CopilotPanel } from "@/components/interview/CopilotPanel";

interface TranscriptMessage {
  id?: string | number;
  role?: string;
  parts?: unknown;
  content?: unknown;
  text?: unknown;
}

/**
 * The conversation column of the interview room — transcript, typing indicator,
 * the live-anchored end marker and the copilot panel — moved out of
 * `src/app/interview/page.tsx` so that file could come down off its size
 * ceiling. Behaviour-verbatim: same markup, same `role="log"` + `aria-live`
 * contract, same hover-and-keyboard-focus action bar.
 *
 * What the page still owns is the *meaning* of an action (regenerate, delete) and
 * the derived `latestAiMessage`; copy-to-clipboard is a presentation concern of a
 * transcript, so it lives here with the same top-centre toast.
 */
export function InterviewTranscript({
  messages,
  isLoading,
  status,
  latencyPhase,
  isDyslexiaMode,
  isFocusMode,
  latestAiMessage,
  endRef,
  onRegenerate,
  onDeleteMessage,
}: {
  messages: TranscriptMessage[];
  isLoading: boolean;
  status: string;
  latencyPhase: number;
  isDyslexiaMode: boolean;
  isFocusMode: boolean;
  latestAiMessage: string;
  endRef: RefObject<HTMLDivElement | null>;
  onRegenerate: () => void;
  onDeleteMessage: (id: TranscriptMessage["id"]) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth" role="log" aria-live="polite" aria-atomic="false">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-white/50 border border-white flex items-center justify-center shadow-sm">
            <Microphone className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-slate-500 text-[13px] font-medium max-w-[200px]">
            长按麦克风或输入文本以开始面试
          </p>
        </div>
      )}

      {messages.map((m, idx) => {
        // Phase 14: v6 parts-first text (legacy fallback inside helper).
        const content = getMessageText(m as { parts?: unknown; content?: unknown; text?: unknown });
        const isLastMessage = idx === messages.length - 1;
        return (
          <motion.div
            layout="position"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            key={m.id}
            className={`flex flex-col group ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5 px-1">
              {m.role === "user" ? "我" : "Interve AI"}
            </div>
            <div className={`px-5 py-3.5 max-w-[85%] text-[14.5px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${
              m.role === "user"
                ? "bg-slate-800 text-white rounded-[20px] rounded-br-sm border border-slate-700/50 leading-relaxed"
                : `bg-white/60 backdrop-blur-3xl border border-white/60 text-[#111111] rounded-[20px] rounded-bl-sm font-medium shadow-[0_8px_32px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.8)] ${isDyslexiaMode ? "font-mono text-[15px] tracking-[0.05em] leading-[1.8]" : "leading-relaxed"}`
            }`}>
              {content}
            </div>

            {/* Actions (visible on hover AND keyboard focus) */}
            <div className={`flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity ${m.role === "user" ? "flex-row-reverse mr-1" : "ml-1"}`}>
              <button
                onClick={async () => {
                  const copied = await copyTextToClipboard(content);
                  if (copied) toast.success("已复制到剪贴板", { position: "top-center" });
                  else toast.error("复制失败", { description: "浏览器拒绝了剪贴板访问", position: "top-center" });
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                title="复制"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {isLastMessage && (
                <button
                  onClick={onRegenerate}
                  className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors"
                  title="重新生成"
                >
                  <ArrowsClockwise className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onDeleteMessage(m.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                title="删除消息"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        );
      })}
      {isLoading && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-start">
          <div className="px-4 py-3 bg-white/80 backdrop-blur-md border border-white text-slate-500 rounded-2xl rounded-bl-sm text-sm flex flex-col gap-2 shadow-sm min-w-[140px]">
            <div className="flex gap-1.5 items-center">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
            </div>
            {status === "submitted" && (
              <motion.div
                key={latencyPhase}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
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
      <div ref={endRef} />

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
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
