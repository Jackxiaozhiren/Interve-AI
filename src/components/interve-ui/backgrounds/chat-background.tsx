"use client";

import React from "react";

/**
 * ChatBackground
 * 
 * Luminous Light Design System: Pure CSS radial gradient with subtle breathing animation.
 * Zero JavaScript execution overhead for the chat interface.
 * Colors: #FFFFFF, #FAFAFC, #E6F0FF (10% opacity)
 */
export function ChatBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#FAFAFC]" aria-hidden="true">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes interve-breathe {
            0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.5; }
            33% { transform: scale(1.05) translate(2%, 2%); opacity: 0.6; }
            66% { transform: scale(0.95) translate(-2%, -1%); opacity: 0.4; }
          }
          @keyframes interve-breathe-alt {
            0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.4; }
            50% { transform: scale(1.1) translate(-3%, 2%); opacity: 0.7; }
          }
          @media (prefers-reduced-motion: reduce) {
            .bg-orb { animation: none !important; }
          }
        `
      }} />
      
      {/* Top Left Orb */}
      <div 
        className="bg-orb absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full blur-[100px]"
        style={{
          background: "radial-gradient(circle, rgba(230, 240, 255, 0.4) 0%, rgba(250, 250, 252, 0) 70%)",
          animation: "interve-breathe 20s ease-in-out infinite",
        }}
      />
      
      {/* Bottom Right Orb */}
      <div 
        className="bg-orb absolute bottom-[-30%] right-[-10%] w-[80vw] h-[80vw] rounded-full blur-[120px]"
        style={{
          background: "radial-gradient(circle, rgba(245, 247, 255, 0.6) 0%, rgba(250, 250, 252, 0) 70%)",
          animation: "interve-breathe-alt 25s ease-in-out infinite",
        }}
      />

      {/* Grid subtle overlay */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(22, 93, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(22, 93, 255, 0.02) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}
