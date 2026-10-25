"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DynamicLoader } from "@/components/ui/DynamicLoader";
import { thinkTimeBarWidth } from "@/lib/interview/think-time";

/**
 * The three layers the interview room can lay over itself. Each stays exactly
 * where the page put it — the z-index ladder (100 > 90 > 50) and the DOM order
 * are what decide which one wins when two are up at once.
 */

export function PauseOverlay({ isPaused }: { isPaused: boolean }) {
  return (
    <AnimatePresence>
      {isPaused && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)", pointerEvents: "none" }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/30 text-slate-800"
        >
          <WarningCircle weight="duotone" className="w-16 h-16 text-rose-500 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold font-heading mb-2">面试已暂停</h2>
          <p className="text-slate-600 font-medium">麦克风已静音，倒计时已暂停。按 <kbd className="px-2 py-1 bg-white shadow-sm rounded-md border border-slate-200 text-slate-800 mx-1">Esc</kbd> 恢复面试。</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ThinkTimeOverlay({
  seconds,
  isCalmMode,
  onCancel,
  onStart,
}: {
  seconds: number | null;
  isCalmMode: boolean;
  onCancel: () => void;
  onStart: () => void;
}) {
  return (
    <AnimatePresence>
      {seconds !== null && seconds > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, pointerEvents: "none" }}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-white/20 backdrop-blur-sm"
        >
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[32px] shadow-2xl border border-white/60 flex flex-col items-center min-w-[300px]">
            {isCalmMode ? (
              <div className="w-full min-w-[200px] mb-6 mt-4">
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full bg-amber-400 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: thinkTimeBarWidth(seconds) }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-6xl font-mono text-amber-500 mb-2 font-bold tracking-tighter">{seconds}</div>
            )}
            <h3 className="text-lg font-medium text-slate-700 mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              {isCalmMode ? "正在为您预留思考时间..." : "思考时间"}
            </h3>
            <div className="flex gap-3 w-full">
              <Button variant="outline" onClick={onCancel} className="flex-1 rounded-full border-slate-200">取消录音</Button>
              <Button onClick={onStart} className="flex-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-sm border-none">直接开始</Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EndingOverlay({ isEnding }: { isEnding: boolean }) {
  return (
    <AnimatePresence>
      {isEnding && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: "none" }}
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
  );
}
