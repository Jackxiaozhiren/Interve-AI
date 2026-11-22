"use client";

import { useEffect, useState } from "react";

/**
 * S4 slice 5/5: model runtime status — what the room header shows while the
 * whisper/kokoro workers load, whether native TTS is in use, and the load
 * watchdog. The states moved verbatim from page.tsx; worker construction and
 * dispatch wiring stay in the page because they interleave with the transport
 * and the delivery pipeline. The 15-second watchdog (Phase 13) moves with the
 * state it guards.
 */
export function useModelRuntime() {
  const [modelStatus, setModelStatus] = useState<string>("正在初始化模型...");
  const [modelsReady, setModelsReady] = useState(false);
  const [isUsingNativeTTS, setIsUsingNativeTTS] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!modelsReady) {
      timer = setTimeout(() => {
        setModelLoadError(true);
      }, 15000); // 15 seconds timeout
    }
    return () => clearTimeout(timer);
  }, [modelsReady]);

  return {
    modelStatus,
    setModelStatus,
    modelsReady,
    setModelsReady,
    isUsingNativeTTS,
    setIsUsingNativeTTS,
    modelLoadError,
  };
}
