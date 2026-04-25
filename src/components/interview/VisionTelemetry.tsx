"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Eye, UserFocus } from "@phosphor-icons/react";

interface VisionTelemetryProps {
  onVisionDataUpdate: (data: { eyeContact: number; posture: number; expression: number }) => void;
}

export const VisionTelemetry = React.memo(({ onVisionDataUpdate }: VisionTelemetryProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Initial values
  const [eyeContact, setEyeContact] = useState(92);
  const [posture, setPosture] = useState(88);
  const [expression, setExpression] = useState(85);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
      } catch (err) {
        console.warn("Camera access denied or unavailable", err);
        setHasPermission(false);
      }
    }
    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Simulate vision analysis locally
  useEffect(() => {
    if (!hasPermission) return;
    const interval = setInterval(() => {
      setEyeContact(prev => {
        const val = Math.max(70, Math.min(100, prev + (Math.random() * 8 - 4)));
        return val;
      });
      setPosture(prev => {
        const val = Math.max(70, Math.min(100, prev + (Math.random() * 6 - 3)));
        return val;
      });
      setExpression(prev => {
        const val = Math.max(60, Math.min(100, prev + (Math.random() * 10 - 5)));
        return val;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [hasPermission]);

  // Report up when values change
  useEffect(() => {
    if (!hasPermission) return;
    onVisionDataUpdate({ eyeContact, posture, expression });
  }, [eyeContact, posture, expression, hasPermission, onVisionDataUpdate]);

  if (hasPermission === false) {
    return null; // Silently hide if camera is denied/unavailable
  }

  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Camera weight="bold" className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-bold tracking-widest uppercase font-sans text-slate-600">Vision</span>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.1 }}
        role="region"
        aria-label="Vision Telemetry Video Stream"
        className="glass-card rounded-2xl flex-1 relative overflow-hidden group min-h-[140px]"
      >
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay pointer-events-none transition-opacity duration-700 group-hover:opacity-80"
        />
        
        {/* Scanning effect */}
        <div className="absolute inset-x-0 h-[100%] bg-gradient-to-b from-sky-500/0 via-sky-400/20 to-sky-500/0 animate-scan pointer-events-none" />
        
        {/* Trackers */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1.5 z-10">
          <div className="flex items-center justify-between px-2 py-1 bg-black/30 backdrop-blur-md rounded-lg border border-white/20 shadow-sm">
             <div className="flex items-center gap-1.5">
               <Eye className="w-3.5 h-3.5 text-sky-300" />
               <span className="text-[9px] font-medium text-white/90 uppercase tracking-wide">Eye Contact</span>
             </div>
             <span className="text-[11px] font-bold text-sky-200 font-mono">{Math.round(eyeContact)}%</span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-black/30 backdrop-blur-md rounded-lg border border-white/20 shadow-sm">
             <div className="flex items-center gap-1.5">
               <UserFocus className="w-3.5 h-3.5 text-emerald-300" />
               <span className="text-[9px] font-medium text-white/90 uppercase tracking-wide">Posture</span>
             </div>
             <span className="text-[11px] font-bold text-emerald-200 font-mono">{Math.round(posture)}%</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

VisionTelemetry.displayName = 'VisionTelemetry';
