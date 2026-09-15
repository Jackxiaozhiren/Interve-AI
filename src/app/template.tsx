"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  // Phase 14: transform-only entrance. A previous opacity fade washed out
  // every page's computed colors mid-animation (axe color-contrast flakes,
  // later LCP) with zero information value; motion intent is preserved.
  return (
    <motion.div
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      transition={{
        duration: 0.3,
        ease: 'easeOut'
      }}
      className="flex flex-col flex-1 origin-top"
    >
      {children}
    </motion.div>
  );
}
