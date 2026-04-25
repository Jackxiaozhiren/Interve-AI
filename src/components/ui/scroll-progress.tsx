"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * A thin, gradient-colored scroll progress indicator fixed at the very top of the viewport.
 * Uses hardware-accelerated scaleX transform for smooth 60fps performance.
 */
export function ScrollProgress({ containerRef }: { containerRef?: React.RefObject<HTMLElement | null> }) {
  const { scrollYProgress } = useScroll(containerRef ? { container: containerRef } : undefined);
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 50,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[3px] z-[100] origin-left"
      style={{
        scaleX,
        background: "linear-gradient(90deg, #38bdf8 0%, #34d399 50%, #818cf8 100%)",
        boxShadow: "0 0 8px rgba(56, 189, 248, 0.4), 0 0 20px rgba(52, 211, 153, 0.2)",
      }}
    />
  );
}
