"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function GlobalBackground() {
  const [isMobile, setIsMobile] = useState(false);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Smooth out the mouse movement for the spotlight and parallax
  const smoothMouseX = useSpring(mouseX, { damping: 50, stiffness: 400 });
  const smoothMouseY = useSpring(mouseY, { damping: 50, stiffness: 400 });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const updateTimer = setTimeout(() => setIsMobile(isTouch), 0);

    if (isTouch) {
      // Center the spotlight on mobile and skip mouse event listeners
      if (containerRef.current) {
        containerRef.current.style.setProperty("--mouse-x", `50%`);
        containerRef.current.style.setProperty("--mouse-y", `50%`);
      }
      return () => clearTimeout(updateTimer);
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Get relative position from 0 to 1
      const { innerWidth, innerHeight } = window;
      const x = e.clientX / innerWidth;
      const y = e.clientY / innerHeight;
      
      mouseX.set(x);
      mouseY.set(y);

      // Also update CSS variables for the spotlight glow directly
      if (containerRef.current) {
        containerRef.current.style.setProperty("--mouse-x", `${e.clientX}px`);
        containerRef.current.style.setProperty("--mouse-y", `${e.clientY}px`);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      clearTimeout(updateTimer);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [mouseX, mouseY]);

  return (
    <div 
      ref={containerRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0 bg-[#FDFDFD]"
    >
      {/* 1. Thematic Tech Backdrop (Fading Dot Grid) */}
      <div 
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "radial-gradient(#111111 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(circle at center, black 10%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 10%, transparent 80%)",
        }}
      />

      {/* 2. Fluid Mesh Gradients (Liquid Morph & Parallax) */}
      <motion.div 
        className="absolute inset-0"
        style={{
          x: useSpring(useMotionValue(0), { stiffness: 100, damping: 30 }), // these will be overridden by the transform below
          y: useSpring(useMotionValue(0), { stiffness: 100, damping: 30 }),
        }}
      >
        {/* Parallax layer for the blobs */}
        <motion.div
          className={`absolute inset-0 animate-[color-breathe_30s_ease-in-out_infinite]`}
          style={{
            x: isMobile ? 0 : smoothMouseX.get() * -40,
            y: isMobile ? 0 : smoothMouseY.get() * -40,
          }}
        >
          {/* Pale Sky blob */}
          <div className="absolute top-[10%] left-[20%] w-[45vw] h-[45vw] bg-sky-100/40 blur-[100px] mix-blend-multiply animate-[liquid-morph_20s_ease-in-out_infinite]" />
          
          {/* Emerald blob */}
          <div className="absolute top-[40%] right-[10%] w-[40vw] h-[40vw] bg-emerald-100/40 blur-[120px] mix-blend-multiply animate-[liquid-morph_25s_ease-in-out_infinite_reverse]" />
          
          {/* Sky Blue blob */}
          <div className="absolute -bottom-[10%] left-[30%] w-[50vw] h-[50vw] bg-sky-100/40 blur-[130px] mix-blend-multiply animate-[liquid-morph_30s_ease-in-out_infinite]" />
        </motion.div>
      </motion.div>

      {/* 3. Global Reactive Ambient Glow (Cursor Spotlight) */}
      <div 
        className="absolute inset-0 opacity-60 mix-blend-soft-light transition-opacity duration-300"
        style={{
          background: `radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 1), transparent 40%)`
        }}
      />

      {/* 4. Tactile Noise Overlay (Subtle Grain) */}
      <div 
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px"
        }}
      />
    </div>
  );
}
