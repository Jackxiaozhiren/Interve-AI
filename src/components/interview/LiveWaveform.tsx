"use client";

import { useEffect, useRef } from "react";

interface LiveWaveformProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

export function LiveWaveform({ stream, isRecording }: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!isRecording || !stream) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Use a clone to not interfere with the main stream
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2.5; // Scale height

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, "rgba(56, 189, 248, 0.4)"); // sky-400
        gradient.addColorStop(1, "rgba(52, 211, 153, 0.9)"); // emerald-400

        ctx.fillStyle = gradient;
        
        // Add subtle glow
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(52, 211, 153, 0.4)";

        // Draw bars growing from bottom
        const barY = canvas.height - barHeight;
        
        // Rounded top using path
        ctx.beginPath();
        const radius = Math.min(barWidth / 2, barHeight / 2);
        ctx.moveTo(x, canvas.height);
        ctx.lineTo(x, barY + radius);
        ctx.arcTo(x, barY, x + barWidth, barY, radius);
        ctx.arcTo(x + barWidth, barY, x + barWidth, canvas.height, radius);
        ctx.lineTo(x + barWidth, canvas.height);
        ctx.closePath();
        ctx.fill();

        x += barWidth + 3; // Gap
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [isRecording, stream]);

  return (
    <div className="relative w-full h-12 bg-white/40 backdrop-blur-md rounded-[16px] overflow-hidden flex items-end border border-white/60 shadow-[inset_0_1px_3px_rgba(255,255,255,0.6),0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300">
      <canvas
        ref={canvasRef}
        width={300}
        height={48}
        className="w-full h-full opacity-90"
      />
      {!isRecording && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="px-3 py-1 rounded-full bg-slate-800/5 backdrop-blur-sm border border-slate-200/50">
            <span className="text-xs text-slate-500 font-medium tracking-wide">Microphone inactive</span>
          </div>
        </div>
      )}
    </div>
  );
}
