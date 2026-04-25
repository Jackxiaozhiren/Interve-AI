"use client";

import React from "react";
import { TimelineEvent } from "@/lib/db";
import { motion } from "framer-motion";
import { ChatCircleDots, Lightbulb, Warning, CheckCircle, Question } from "@phosphor-icons/react";

interface InterviewTimelineProps {
  events?: TimelineEvent[];
}

export const InterviewTimeline = React.memo(({ events }: InterviewTimelineProps) => {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-slate-500 font-medium">No timeline events recorded for this session.</p>
      </div>
    );
  }

  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="relative pl-10 border-l-2 border-slate-100 py-6 space-y-10">
      {sortedEvents.map((event, index) => {
        let Icon = ChatCircleDots;
        let colorClass = "bg-slate-50 text-slate-500 border-slate-200";
        
        switch (event.type) {
          case 'question':
            Icon = Question;
            colorClass = "bg-sky-50 text-sky-500 border-sky-200";
            break;
          case 'answer':
            Icon = ChatCircleDots;
            colorClass = "bg-emerald-50 text-emerald-500 border-emerald-200";
            break;
          case 'feedback':
            Icon = Lightbulb;
            colorClass = "bg-amber-50 text-amber-500 border-amber-200";
            break;
          case 'milestone':
            Icon = CheckCircle;
            colorClass = "bg-teal-50 text-teal-500 border-teal-200";
            break;
          case 'warning':
            Icon = Warning;
            colorClass = "bg-rose-50 text-rose-500 border-rose-200";
            break;
        }

        const minutes = Math.floor(event.timestamp / 60000);
        const seconds = Math.floor((event.timestamp % 60000) / 1000);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        return (
          <motion.div 
            key={event.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.1, 1), type: "spring", stiffness: 300, damping: 25 }}
            className="relative"
          >
            {/* Timeline Dot */}
            <div className={`absolute -left-[3.7rem] top-0 w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${colorClass}`}>
              <Icon weight="duotone" className="w-6 h-6" />
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 group hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all">
              <div className="flex items-start gap-4 mb-3">
                <span className="font-mono text-sm font-bold text-slate-400 bg-slate-100/50 px-3 py-1 rounded-lg">{timeStr}</span>
                <h4 className="font-serif text-xl tracking-tight text-[#111111] leading-tight pt-0.5">{event.title}</h4>
              </div>
              {event.description && (
                <p className="text-slate-500 text-[1.05rem] leading-relaxed font-medium pl-[4.5rem]">{event.description}</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
});

InterviewTimeline.displayName = "InterviewTimeline";
