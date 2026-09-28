"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Play } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/**
 * The pre-room standby card. Presentational only — the decision it triggers
 * (including the "engine never finished loading, start in basic mode"
 * fallback) stays with the caller in `onStart`.
 *
 * Labels are load-bearing: tests/keyboard.spec.ts and the interview specs find
 * the CTA with /开始面试|强制开始/, so the three-state copy below is a
 * contract, not decoration.
 */
export function StandbyOverlay({
  open,
  modelsReady,
  loadError,
  onStart,
}: {
  open: boolean;
  modelsReady: boolean;
  loadError: boolean;
  onStart: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
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
                onClick={onStart}
                disabled={!modelsReady && !loadError}
                className="w-full h-14 text-lg rounded-full bg-slate-800 hover:bg-slate-700 text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                {modelsReady ? "开始面试" : loadError ? "强制开始 (基础模式)" : "正在加载 AI 引擎..."}
              </Button>
              {!modelsReady && loadError && (
                <p className="text-xs text-amber-500 font-medium px-2">
                  AI 引擎加载时间过长，您可以强制开始，系统将自动切换为基础语音。
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
