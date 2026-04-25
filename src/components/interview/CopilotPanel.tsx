"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, MagicWand } from "@phosphor-icons/react";

import { StarTracker } from "./StarTracker";

interface CopilotPanelProps {
  latestAiMessage: string;
  messages: Array<{ role: string; content?: string; text?: string }>;
}

export const CopilotPanel = React.memo(({ latestAiMessage, messages }: CopilotPanelProps) => {
  const [hints, setHints] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isBehavioral, setIsBehavioral] = useState(false);
  
  // Cache for Copilot hints to reduce API calls during the same session
  const hintsCache = React.useRef<Record<string, string[]>>({});

  useEffect(() => {
    if (!latestAiMessage || latestAiMessage.length < 10) return;

    // Detect if it's likely a behavioral question (very basic heuristic)
    const _isBehavioral = /describe|tell me about|how did you|example of|situation|experience|challenge|conflict/i.test(latestAiMessage);
    setIsBehavioral(_isBehavioral);

    const fetchHints = async () => {
      if (hintsCache.current[latestAiMessage]) {
        setHints(hintsCache.current[latestAiMessage]);
        return;
      }

      setIsSearching(true);
      try {
        const { queryKnowledgeHub } = await import('@/lib/orama-client');
        // Search the resume for content related to the AI's question
        const results = await queryKnowledgeHub(latestAiMessage, 3);
        
        if (results && results.length > 0) {
          const res = await fetch('/api/copilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: latestAiMessage,
              resumeSnippets: results
            })
          });

          if (res.ok) {
            const data = await res.json();
            const newHints = data.hints || [];
            hintsCache.current[latestAiMessage] = newHints;
            setHints(newHints);
          } else {
            // Fallback to simple truncation
            const cleanHints = results.map(r => {
              const text = r.replace(/^.+?:/, '').trim();
              return text.length > 80 ? text.substring(0, 80) + "..." : text;
            });
            const fallbackHints = cleanHints.filter(h => h.length > 0);
            hintsCache.current[latestAiMessage] = fallbackHints;
            setHints(fallbackHints);
          }
        } else {
          setHints([]);
        }
      } catch (error) {
        console.warn("Failed to fetch copilot hints:", error);
      } finally {
        setIsSearching(false);
      }
    };

    fetchHints();
  }, [latestAiMessage]);

  if (!latestAiMessage) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={latestAiMessage}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex flex-col gap-3 mt-4"
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-md shadow-sm border border-emerald-100/50">
            <MagicWand className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Copilot Hints</h3>
        </div>

        {/* STAR Framework Guide */}
        {isBehavioral && (
          <StarTracker />
        )}

        {/* Resume Content Matches */}
        <div className="bg-white/40 backdrop-blur-3xl border border-white/60 rounded-[24px] p-4 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] relative overflow-hidden group">
           {/* Shimmer Effect */}
           <motion.div 
             animate={{ x: ["-150%", "250%"] }} 
             transition={{ duration: 4, repeat: Infinity, ease: "linear" }} 
             className="absolute top-0 bottom-0 left-0 w-2/3 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-[-20deg] z-0" 
           />
           <div className="relative z-10">
             <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
               <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
               Relevant Experience
             </h4>
           
           {isSearching ? (
             <div className="animate-pulse space-y-2 mt-2">
               <div className="h-2 bg-slate-200 rounded w-3/4"></div>
               <div className="h-2 bg-slate-200 rounded w-5/6"></div>
             </div>
           ) : hints.length > 0 ? (
             <motion.ul 
               initial="hidden"
               animate="show"
               variants={{
                 hidden: { opacity: 0 },
                 show: {
                   opacity: 1,
                   transition: { staggerChildren: 0.1 }
                 }
               }}
               className="space-y-2 mt-3"
             >
               {hints.map((hint, i) => (
                 <motion.li 
                   variants={{
                     hidden: { opacity: 0, y: 10, scale: 0.95 },
                     show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
                   }}
                   key={i} 
                   className="text-[12px] text-slate-600 leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-sky-400 before:rounded-full"
                 >
                   {hint}
                 </motion.li>
               ))}
             </motion.ul>
           ) : (
             <p className="text-[12px] text-slate-400 italic mt-2">
               No specific experiences found. Focus on highlighting your soft skills.
             </p>
           )}
           </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

CopilotPanel.displayName = 'CopilotPanel';
