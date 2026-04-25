import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const defaultPhrases = [
  "Initializing components...",
  "Warming up AI models...",
  "Establishing secure connection...",
  "Synthesizing telemetry data..."
];

export function DynamicLoader({ 
  phrases = defaultPhrases,
  interval = 2500,
  className = ""
}: { 
  phrases?: string[],
  interval?: number,
  className?: string
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, interval);
    return () => clearInterval(timer);
  }, [phrases.length, interval]);

  return (
    <div className={`flex flex-col items-center justify-center space-y-5 ${className}`}>
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 bg-sky-200/50 blur-xl rounded-full" />
        <div className="w-12 h-12 border-[3px] border-slate-100 border-t-sky-500 rounded-full animate-spin relative z-10" />
      </div>
      <div className="h-6 relative overflow-hidden w-full min-w-[250px] flex justify-center">
        <AnimatePresence mode="popLayout">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="text-[14px] font-medium text-slate-500 absolute whitespace-nowrap"
          >
            {phrases[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
