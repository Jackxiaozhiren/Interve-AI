"use client";

import React from "react";
import { motion } from "framer-motion";

export const AudioVisualizer = React.memo(function AudioVisualizer({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-12 w-24">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          className={`w-1.5 rounded-full ${
            isActive 
              ? "bg-gradient-to-t from-sky-400 to-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.6)]" 
              : "bg-slate-200/60"
          }`}
          animate={
            isActive
              ? {
                  height: ["20%", "85%", "35%", "100%", "20%"],
                  transition: {
                    duration: 1.2,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                    delay: i * 0.1,
                  },
                }
              : {
                  height: "20%",
                  transition: { duration: 0.4, type: "spring" },
                }
          }
          style={{ height: "20%" }}
        />
      ))}
    </div>
  );
});
