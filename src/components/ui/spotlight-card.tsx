"use client";

import React from "react";
import { motion, useMotionValue, useMotionTemplate, useSpring } from "framer-motion";
import { fadeUpVariant } from "@/lib/motion";

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: React.KeyboardEventHandler;
  spotlightColor?: string;
  hoverScale?: number;
  tapScale?: number;
  animateInView?: boolean;
}

export function SpotlightCard({ 
  children, 
  className = "", 
  onClick, 
  role, 
  tabIndex, 
  onKeyDown,
  spotlightColor = "rgba(14, 165, 233, 0.08)",
  hoverScale = 1.005,
  tapScale = 0.99,
  animateInView = true
}: SpotlightCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // For 3D tilt effect
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 300, mass: 0.5 };
  const smoothRotateX = useSpring(rotateX, springConfig);
  const smoothRotateY = useSpring(rotateY, springConfig);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = clientX - left;
    const y = clientY - top;
    
    mouseX.set(x);
    mouseY.set(y);

    // Calculate rotation (-1 to 1 multiplied by a max angle of 5 degrees)
    const centerX = width / 2;
    const centerY = height / 2;
    rotateX.set(((y - centerY) / centerY) * -5);
    rotateY.set(((x - centerX) / centerX) * 5);
  }

  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      variants={animateInView ? fadeUpVariant : undefined}
      initial={animateInView ? "hidden" : undefined}
      whileInView={animateInView ? "visible" : undefined}
      viewport={animateInView ? { once: true, margin: "-50px" } : undefined}
      whileHover={{ y: -6, scale: hoverScale }}
      whileTap={{ scale: tapScale }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        rotateX: smoothRotateX,
        rotateY: smoothRotateY,
        transformPerspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      role={role || (onClick ? "button" : undefined)}
      tabIndex={tabIndex ?? (onClick ? 0 : undefined)}
      onKeyDown={onKeyDown ?? (onClick ? (e) => { if(e.key==='Enter'||e.key===' ') { e.preventDefault(); onClick(); } } : undefined)}
      aria-label={role === "button" || onClick ? "Spotlight Card Button" : undefined}
      className={`glass-card relative overflow-hidden group rounded-[24px] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_30px_rgba(0,0,0,0.04)] ${className} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 opacity-0 transition duration-700 group-hover:opacity-100 rounded-[24px]"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              800px circle at ${mouseX}px ${mouseY}px,
              ${spotlightColor},
              transparent 60%
            )
          `
        }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition duration-700 group-hover:opacity-100 rounded-[24px]"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              400px circle at ${mouseX}px ${mouseY}px,
              rgba(255, 255, 255, 0.9),
              transparent 50%
            )
          `
        }}
      />
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </motion.div>
  );
}
