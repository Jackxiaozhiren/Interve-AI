"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Microphone, WarningCircle, CheckCircle, ArrowRight, ArrowClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { LiveWaveform } from "@/components/interview/LiveWaveform";
import { micConstraints, getPreferredMicDevice, setPreferredMicDevice } from "@/lib/audio/vad";

interface GreenRoomProps {
  onComplete: () => void;
  onBypass: () => void;
}

export function GreenRoom({ onComplete, onBypass }: GreenRoomProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(() => getPreferredMicDevice());
  const [attempt, setAttempt] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  // Mirror of `stream` for the effect cleanup: reading `stream` state
  // directly would capture the initial null (stale closure).
  const streamRef = useRef<MediaStream | null>(null);

  // Phase 8: permission recovery (retry) + input device selection.
  useEffect(() => {
    let active = true;

    async function setupMic() {
      try {
        setError(null);
        const str = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(deviceId) });
        if (!active) {
          str.getTracks().forEach(t => t.stop());
          return;
        }
        setStream(str);
        streamRef.current = str;

        // Refresh the device list now that permission labels are visible.
        try {
          const all = await navigator.mediaDevices.enumerateDevices();
          setDevices(all.filter((d) => d.kind === "audioinput"));
        } catch {
          // labels stay hidden without permission — non-fatal
        }

        const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(str);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkVolume = () => {
          if (!active) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setVolume(average);
          animationFrameRef.current = requestAnimationFrame(checkVolume);
        };
        checkVolume();

      } catch (err) {
        if (!active) return;
        console.error("Mic access denied or error", err);
        setError("无法访问麦克风。请在浏览器设置中允许麦克风权限，或重试。");
      }
    }

    setupMic();

    return () => {
      active = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      // Use the ref mirror: `stream` state here would be the initial null.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
    // Re-run on retry or device switch (old stream is released above first).
  }, [attempt, deviceId]);

  const handleComplete = () => {
    // Release the stream before moving to the actual interview room 
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    streamRef.current = null;
    onComplete();
  };

  const handleBypass = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    streamRef.current = null;
    onBypass();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#f8fafc] p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white/70 backdrop-blur-xl rounded-[32px] p-10 shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-white flex flex-col items-center text-center"
      >
        <div 
          className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-sky-100"
          role="img" 
          aria-label="麦克风测试图标"
        >
          <Microphone className="w-10 h-10 text-sky-500" weight="fill" aria-hidden="true" />
        </div>
        
        <h1 className="text-2xl font-bold font-heading text-slate-800 mb-2">
          设备自检室
        </h1>
        <p className="text-slate-500 mb-8 max-w-sm text-sm">
          为了保证最佳的面试体验，我们需要确认您的麦克风工作正常。
        </p>

        {error ? (
          <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 flex flex-col gap-3 mb-8 text-left shadow-inner">
            <div className="flex items-start gap-3">
              <WarningCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" weight="fill" />
              <p className="text-sm text-rose-700 font-medium leading-relaxed">{error}</p>
            </div>
            {/* Phase 8: permission recovery — re-request access. */}
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="inline-flex items-center gap-2 self-start text-sm font-bold text-rose-600 hover:text-rose-500 underline underline-offset-4"
            >
              <ArrowClockwise className="w-4 h-4" weight="bold" aria-hidden="true" />
              重新请求麦克风权限
            </button>
          </div>
        ) : (
          <div className="w-full mb-8 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" weight="fill" />
              麦克风已连接
            </div>

            {/* Phase 8: input device selection (persisted). */}
            {devices.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-slate-500">
                输入设备
                <select
                  value={deviceId ?? ""}
                  onChange={(e) => {
                    setDeviceId(e.target.value || null);
                    setPreferredMicDevice(e.target.value);
                  }}
                  aria-label="选择麦克风设备"
                  className="max-w-[220px] text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:border-sky-300"
                >
                  {devices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `麦克风 ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            
            {/* Volume indicator */}
            <div className="w-full max-w-[280px] mt-2 mb-2 relative">
              <LiveWaveform stream={stream} isRecording={true} />
            </div>
            <p className="text-xs text-slate-400 mt-2">请尝试说几句话测试音量</p>
          </div>
        )}

        <div className="flex flex-col w-full gap-3 mt-4">
          <Button 
            onClick={handleComplete}
            disabled={!!error || volume === 0}
            className="w-full h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-medium shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
            aria-label="进入面试"
          >
            进入面试 <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Button>
          
          <button 
            onClick={handleBypass}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 underline-offset-4 hover:underline transition-all mt-2"
            aria-label="跳过语音测试，以纯文本模式继续"
          >
            跳过语音测试，以纯文本模式继续
          </button>
        </div>
      </motion.div>
    </div>
  );
}
