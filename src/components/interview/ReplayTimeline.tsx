"use client";

import React from "react";
import { TimelineEvent } from "@/lib/db";
import { motion } from "framer-motion";
import { ChatCircleDots, Lightbulb, Warning, CheckCircle, Question } from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReplayTimelineProps {
  events?: TimelineEvent[];
  currentTime?: number;
  duration?: number;
  onSeek?: (timestamp: number) => void;
}

export const ReplayTimeline = React.memo(({ events, currentTime = 0, duration = 600000, onSeek }: ReplayTimelineProps) => {
  if (!events || events.length === 0) {
    return null;
  }

  // Calculate progress percentage
  const progressPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  return (
    <div className="w-full bg-white border-t border-slate-200 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-20">
      <div className="max-w-5xl mx-auto relative h-16 flex items-center">
        {/* Base line */}
        <div className="absolute left-0 right-0 h-1.5 bg-slate-100 rounded-full overflow-hidden transform-gpu">
          {/* Progress fill */}
          <motion.div 
            className="h-full bg-sky-500 rounded-full will-change-auto"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Events */}
        <TooltipProvider delay={100}>
          {events.map((event, i) => {
            // Position based on timestamp relative to total duration
            const leftPercent = Math.min(100, Math.max(0, (event.timestamp / duration) * 100));
            
            let Icon = ChatCircleDots;
            let colorClass = "bg-slate-50 text-slate-500 border-slate-200";
            
            switch (event.type) {
              case 'question':
                Icon = Question;
                colorClass = "bg-sky-50 text-sky-500 border-sky-200 hover:bg-sky-100 hover:text-sky-600";
                break;
              case 'answer':
                Icon = ChatCircleDots;
                colorClass = "bg-emerald-50 text-emerald-500 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-600";
                break;
              case 'feedback':
                Icon = Lightbulb;
                colorClass = "bg-amber-50 text-amber-500 border-amber-200 hover:bg-amber-100 hover:text-amber-600";
                break;
              case 'milestone':
                Icon = CheckCircle;
                colorClass = "bg-teal-50 text-teal-500 border-teal-200 hover:bg-teal-100 hover:text-teal-600";
                break;
              case 'warning':
                Icon = Warning;
                colorClass = "bg-rose-50 text-rose-500 border-rose-200 hover:bg-rose-100 hover:text-rose-600";
                break;
            }

            const isPast = event.timestamp <= currentTime;

            return (
              <Tooltip key={event.id || i}>
                <TooltipTrigger 
                  onClick={() => onSeek && onSeek(event.timestamp)}
                  className={`absolute w-8 h-8 -ml-4 rounded-full flex items-center justify-center border shadow-sm transition-all transform hover:scale-110 hover:-translate-y-1 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    isPast ? colorClass : 'bg-white text-slate-300 border-slate-200 hover:bg-slate-50'
                  }`}
                  style={{ left: `${leftPercent}%` }}
                  aria-label={`跳转到 ${event.title}`}
                >
                  <Icon weight={isPast ? "duotone" : "regular"} className="w-4 h-4" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-slate-800 text-slate-100 border-none px-3 py-2">
                  <div className="text-xs font-bold mb-1">{event.title}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {Math.floor(event.timestamp / 60000)}:{(Math.floor(event.timestamp % 60000) / 1000).toString().padStart(2, '0')}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
});

ReplayTimeline.displayName = "ReplayTimeline";
