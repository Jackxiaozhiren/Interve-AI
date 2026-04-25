"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PushPin } from "@phosphor-icons/react";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";

interface PinnedQuestionProps {
  questionText: string;
  isVisible: boolean;
}

export const PinnedQuestion = ({ questionText, isVisible }: PinnedQuestionProps) => {
  const isDyslexiaMode = useAccessibilityStore((state) => state.isDyslexiaMode);

  // Chunk the question text into sentences or logical parts for easier reading
  let chunks: string[] = [];
  if (questionText) {
    // Split by common sentence endings, keeping the delimiter
    const parts = questionText.split(/(?<=[.!?。！？])\s+/);
    
    // If the question is very short, no need to chunk
    if (parts.length <= 1 && questionText.length < 50) {
      chunks = [questionText];
    } else {
      chunks = parts.filter(p => p.trim().length > 0);
    }
  }

  return (
    <AnimatePresence>
      {isVisible && questionText && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95, transition: { duration: 0.2 } }}
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4 pointer-events-none"
        >
          <div className="bg-white/80 backdrop-blur-2xl border border-sky-100/50 rounded-3xl p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <div className="w-6 h-6 rounded-full bg-sky-50 flex items-center justify-center border border-sky-100">
                <PushPin className="w-3.5 h-3.5 text-sky-500" weight="fill" />
              </div>
              <span className="text-[12px] font-semibold tracking-wide text-sky-500 uppercase">当前问题</span>
            </div>
            
            <div className="flex flex-col gap-2.5">
              {chunks.map((chunk, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05 }}
                  className="flex items-start gap-2.5"
                >
                  {chunks.length > 1 && (
                    <div className="mt-1 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-400 opacity-60" />
                    </div>
                  )}
                  <p className={`text-[15px] font-medium text-slate-700 ${isDyslexiaMode ? 'font-mono text-base tracking-[0.05em] leading-[1.8]' : 'leading-relaxed'}`}>
                    {chunk}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
