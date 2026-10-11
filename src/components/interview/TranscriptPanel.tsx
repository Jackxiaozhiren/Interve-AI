"use client";

import type { RefObject } from "react";
import { PhoneDisconnect } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { InterviewTranscript, type TranscriptMessage } from "@/components/interview/InterviewTranscript";

/**
 * The right-hand column of the interview room: the transcript, its header, and
 * the one control that ends the session. The page keeps deciding what "end" and
 * "delete a turn" mean; this only lays them out.
 */
export function TranscriptPanel({
  messages,
  isLoading,
  status,
  latencyPhase,
  isDyslexiaMode,
  isFocusMode,
  latestAiMessage,
  endRef,
  onRegenerate,
  onDeleteMessage,
  onEndCall,
  isEnding,
}: {
  messages: TranscriptMessage[];
  isLoading: boolean;
  status: string;
  latencyPhase: number;
  isDyslexiaMode: boolean;
  isFocusMode: boolean;
  latestAiMessage: string;
  endRef: RefObject<HTMLDivElement | null>;
  onRegenerate: () => void;
  onDeleteMessage: (id: TranscriptMessage["id"]) => void;
  onEndCall: () => void;
  isEnding: boolean;
}) {
  return (
    <div className="w-full lg:w-[400px] flex flex-col glass rounded-[32px] overflow-hidden shrink-0 h-[50vh] lg:h-auto mb-2 mr-2">
      <div className="px-6 py-5 border-b border-white/40 flex justify-between items-center z-10 relative">
        <h2 className="font-heading font-medium text-slate-800 text-[15px]">实时对话</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-500">AI Copilot</span>
        </div>
      </div>

      <InterviewTranscript
        messages={messages}
        isLoading={isLoading}
        status={status}
        latencyPhase={latencyPhase}
        isDyslexiaMode={isDyslexiaMode}
        isFocusMode={isFocusMode}
        latestAiMessage={latestAiMessage}
        endRef={endRef}
        onRegenerate={onRegenerate}
        onDeleteMessage={onDeleteMessage}
      />

      <div className="p-4 bg-white/40 border-t border-white/40">
        <Button
          variant="outline"
          className="w-full rounded-full h-12 font-medium text-rose-700 hover:text-rose-800 hover:bg-rose-50/50 border-white bg-white/50 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          onClick={onEndCall}
          disabled={isEnding}
          aria-label="结束面试并生成报告"
        >
          {isEnding ? (
            <>
              <div className="w-4 h-4 mr-2 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
              正在生成报告...
            </>
          ) : (
            <>
              <PhoneDisconnect className="w-4 h-4 mr-2" />
              结束面试
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
