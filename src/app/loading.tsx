"use client";

import { motion } from "framer-motion";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-md z-50">
      <div className="relative flex flex-col items-center gap-6">
        {/* Animated Rings */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 border-2 border-slate-200 rounded-full"
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-2 border-2 border-sky-200 rounded-full"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
          {/* Core Orb */}
          <motion.div
            className="w-12 h-12 bg-gradient-to-tr from-sky-500 to-emerald-400 rounded-full shadow-[0_0_30px_rgba(14,165,233,0.4)]"
            animate={{ scale: [1, 0.9, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Glossy Sweep overlay */}
          <motion.div
            className="absolute inset-0 rounded-full overflow-hidden"
          >
            <motion.div
              className="w-[200%] h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-30deg]"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </div>

        {/* Text */}
        <div className="flex flex-col items-center">
          <motion.h3 
            className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-900 tracking-wide font-serif"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            Interve AI
          </motion.h3>
          <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1">
            Loading Experience
          </p>
        </div>
      </div>
    </div>
  );
}
