import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiHigh, Warning, Checks } from '@phosphor-icons/react';

export function SystemHealthIndicator({ 
  isOnline = true, 
  wsLatency = 45,
  stressTest = false
}: { 
  isOnline?: boolean;
  wsLatency?: number;
  stressTest?: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  // Mock latency fluctuations
  const [currentLatency, setCurrentLatency] = useState(wsLatency);
  
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      setCurrentLatency(prev => Math.max(10, prev + (Math.random() * 20 - 10)));
    }, 5000);
    return () => clearInterval(interval);
  }, [isOnline]);

  // Determine status
  const status = !isOnline ? 'offline' : currentLatency > 200 ? 'warning' : stressTest ? 'stress' : 'healthy';

  const statusConfig = {
    healthy: {
      color: 'bg-emerald-400',
      icon: <Checks className="w-3.5 h-3.5 text-emerald-500" />,
      text: '系统运行良好',
      shadow: 'shadow-[0_0_8px_rgba(52,211,153,0.4)]'
    },
    stress: {
      color: 'bg-rose-500',
      icon: <Warning className="w-3.5 h-3.5 text-rose-500" />,
      text: '压力测试模式开启',
      shadow: 'shadow-[0_0_8px_rgba(244,63,94,0.6)]'
    },
    warning: {
      color: 'bg-amber-400',
      icon: <Warning className="w-3.5 h-3.5 text-amber-500" />,
      text: '网络延迟较高',
      shadow: 'shadow-[0_0_8px_rgba(251,191,36,0.4)]'
    },
    offline: {
      color: 'bg-slate-400',
      icon: <WifiHigh className="w-3.5 h-3.5 text-slate-500 opacity-50" />,
      text: '连接已断开',
      shadow: 'shadow-none'
    }
  };

  const config = statusConfig[status];

  return (
    <div 
      className="relative flex items-center cursor-help py-2 px-1"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`w-2 h-2 rounded-full ${config.color} ${config.shadow} ${status !== 'offline' ? 'animate-pulse' : ''}`} />
      
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 bg-white/90 backdrop-blur-md border border-slate-200/50 shadow-lg rounded-xl px-3 py-2 flex flex-col gap-1 min-w-[150px] z-50 pointer-events-none"
          >
            <div className="flex items-center gap-2">
              {config.icon}
              <span className="text-xs font-medium text-slate-700">{config.text}</span>
            </div>
            {isOnline && status !== 'stress' && (
              <div className="text-[10px] text-slate-400 font-mono ml-5">
                实时延迟: {Math.round(currentLatency)}ms
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
