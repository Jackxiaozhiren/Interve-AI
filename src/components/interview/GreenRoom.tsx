"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Microphone, WarningCircle, CheckCircle, ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { LiveWaveform } from "@/components/interview/LiveWaveform";

interface GreenRoomProps {
  onComplete: () => void;
  onBypass: () => void;
}

export function GreenRoom({ onComplete, onBypass }: GreenRoomProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    let active = true;

    async function setupMic() {
      try {
        const str = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active) {
          str.getTracks().forEach(t => t.stop());
          return;
        }
        setStream(str);
        
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
        setError("无法访问麦克风。请在浏览器设置中允许麦克风权限。");
      }
    }

    setupMic();

    return () => {
      active = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleComplete = () => {
    // Release the stream before moving to the actual interview room 
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
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
          <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3 mb-8 text-left shadow-inner">
            <WarningCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" weight="fill" />
            <p className="text-sm text-rose-700 font-medium leading-relaxed">{error}</p>
          </div>
        ) : (
          <div className="w-full mb-8 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" weight="fill" />
              麦克风已连接
            </div>
            
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
            className="text-xs font-medium text-slate-400 hover:text-slate-600 underline-offset-4 hover:underline transition-all mt-2"
            aria-label="跳过语音测试，以纯文本模式继续"
          >
            跳过语音测试，以纯文本模式继续
          </button>
        </div>
      </motion.div>
    </div>
  );
}
