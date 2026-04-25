"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function AmbientBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-[#FBFBFA]">
      
      {/* 1. Fluid Liquid Mesh Orbs */}
      <motion.div 
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, 90, 0],
          borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 50%", "60% 40% 30% 70% / 60% 30% 70% 40%", "40% 60% 70% 30% / 40% 50% 60% 50%"]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] bg-gradient-to-br from-[#E1F3FE]/60 to-[#EDF3EC]/40 blur-[100px] opacity-70" 
      />
      
      <motion.div 
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, -90, 0],
          borderRadius: ["60% 40% 30% 70% / 60% 30% 70% 40%", "30% 70% 70% 30% / 30% 30% 70% 70%", "60% 40% 30% 70% / 60% 30% 70% 40%"]
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] bg-gradient-to-tl from-[#EDF3EC]/50 to-[#E1F3FE]/30 blur-[120px] opacity-60" 
      />

      {/* 2. Abstract Geometric Dot Matrix */}
      <div 
        className="absolute inset-0 opacity-[0.25]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23111111' fill-opacity='0.15' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
          maskImage: 'radial-gradient(ellipse at center, transparent 20%, black 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 20%, black 80%)'
        }}
      />

      {/* 3. Tactical Noise Texture Overlay for Premium Tactile Feel */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* 4. Soft Vignette to focus center */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(251,251,250,0.6)_100%)]" />
    </div>
  );
}
