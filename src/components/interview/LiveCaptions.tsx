import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveCaptionsProps {
  isVisible: boolean;
  speaker: 'AI' | 'User' | null;
  text: string;
}

export function LiveCaptions({ isVisible, speaker, text }: LiveCaptionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  if (!isVisible || !speaker || !text) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 pointer-events-none z-30"
      >
        <div 
          className="bg-black/40 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/10"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${speaker === 'AI' ? 'bg-sky-500/20 text-sky-200' : 'bg-rose-500/20 text-rose-200'}`}>
              {speaker === 'AI' ? 'AI Interviewer' : 'You'}
            </span>
          </div>
          {/* Phase 9: keyboard-scrollable history. No live region here by
              design — screen-reader announcement is owned by the transcript
              panel (role=log); this visual caption avoids double-speaking. */}
          <div
            ref={containerRef}
            tabIndex={0}
            role="log"
            aria-label="实时字幕历史"
            aria-live="off"
            className="max-h-[60px] overflow-y-auto scrollbar-hide text-white/90 text-sm md:text-base font-medium leading-relaxed drop-shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
          >
            {text}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
