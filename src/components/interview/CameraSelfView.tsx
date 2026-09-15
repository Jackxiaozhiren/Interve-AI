"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, CameraSlash } from "@phosphor-icons/react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Phase 3 (Truthfulness Reset): this component REPLACES VisionTelemetry,
// which fabricated eye-contact/posture/expression percentages from unseeded
// randomness. There is deliberately NO scoring here: the camera
// is an optional local self-view only. Frames never leave this device,
// are never stored, and never influence any score. See TRUTHFULNESS_REPORT.

type Permission = "requesting" | "granted" | "denied";

export const CameraSelfView = React.memo(() => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [permission, setPermission] = useState<Permission>("requesting");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setPermission("granted");
      } catch (err) {
        if (cancelled) return;
        console.warn("Camera access denied or unavailable", err);
        setPermission("denied");
      }
    }
    setupCamera();

    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 w-full h-full">
      <div className="flex items-center justify-between px-2">
        {/* Phase 14: slate-700 for 4.5:1 on tinted glass (was slate-600). */}
        <div className="flex items-center gap-1.5 text-slate-700">
          <Camera weight="bold" className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-bold tracking-widest uppercase font-sans text-slate-700">Self-view</span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-100/70 text-slate-500">
          {t.interview.localOnly}
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.1 }}
        role="region"
        aria-label="Camera self view, no analysis performed"
        className="glass-card rounded-2xl flex-1 relative overflow-hidden group min-h-[140px]"
      >
        {permission === "granted" ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <CameraSlash className="w-8 h-8 text-slate-300" weight="duotone" aria-hidden="true" />
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
              {permission === "requesting"
                ? t.interview.cameraRequesting
                : t.interview.cameraOff}
            </p>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 z-10">
          <div className="px-2 py-1 bg-black/30 backdrop-blur-md rounded-lg border border-white/20 shadow-sm">
            <p className="text-[9px] font-medium text-white/90 leading-relaxed">
              {t.interview.noVisualAnalysis}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

CameraSelfView.displayName = 'CameraSelfView';
