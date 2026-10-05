"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Graph, Lightbulb, Microphone, PaperPlaneRight, PencilSimple, WarningCircle } from "@phosphor-icons/react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { LiveCaptions } from "@/components/interview/LiveCaptions";
import { MultiAgentVisualizer, type AIExpert } from "@/components/interview/MultiAgentVisualizer";
import { PinnedQuestion } from "@/components/interview/PinnedQuestion";
import { StarTracker } from "@/components/interview/StarTracker";
import { LiveWaveform } from "@/components/interview/LiveWaveform";
import { useAccessibilityStore } from "@/store/useAccessibilityStore";

/**
 * The room's centre stage: the AI avatar and its ambient glows, the focus-lost
 * overlay, the pinned question, live captions, the waveform, and the record /
 * type / hint dock beneath them.
 *
 * 220 lines moved verbatim out of src/app/interview/page.tsx (from its line
 * 1053) so the page stops being the repo's largest file. The page
 * decides what a turn means; this file is what the candidate looks at.
 *
 * The contract is flat and explicit — every prop typed — because a stage handed
 * a stale flag would misreport the room to the candidate, and a wrong prop name
 * is a type error while a context default is not. Calm mode is read from the
 * accessibility store, the way RoomHeader reads its toggles, so it cannot be
 * passed stale.
 */
export interface RoomStageProps {
  framework: string;
  stressTest: boolean;
  isFocusMode: boolean;
  isPageVisible: boolean;
  isLoading: boolean;
  isRecording: boolean;
  isAiSpeaking: boolean;
  modelsReady: boolean;
  isRequestingHint: boolean;
  latestAiMessage: string;
  modelStatus: string;
  activeUserTranscript: string;
  inputText: string;
  loopMeta: string | null;
  wpm: number;
  activeExpert: AIExpert;
  activeStream: MediaStream | null;
  setInputText: (value: string) => void;
  setIsScratchpadOpen: (open: boolean) => void;
  setIsSystemDesignOpen: (open: boolean) => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  handleStartSpeaking: () => void;
  requestHint: () => Promise<void>;
  handleTextSubmit: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function RoomStage({ framework, stressTest, isFocusMode, isPageVisible, isLoading, isRecording, isAiSpeaking, modelsReady, isRequestingHint, latestAiMessage, modelStatus, activeUserTranscript, inputText, loopMeta, wpm, activeExpert, activeStream, setInputText, setIsScratchpadOpen, setIsSystemDesignOpen, startRecording, stopRecording, handleStartSpeaking, requestHint, handleTextSubmit, inputRef }: RoomStageProps) {
  const { isCalmMode, isLiveCaptionsEnabled } = useAccessibilityStore();

  return (
<div className={`flex-1 flex flex-col items-center justify-center relative glass rounded-[32px] overflow-hidden transition-colors duration-1000 ${stressTest ? 'border-2 border-rose-300/50 shadow-[inset_0_0_40px_rgba(244,63,94,0.1)]' : ''}`}>
               {/* StarTracker (Absolute) */}
               <AnimatePresence>
                 {!isFocusMode && framework === 'star' && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                      className="absolute inset-0 pointer-events-none [&>*]:pointer-events-auto z-10"
                    >
                      <StarTracker />
                    </motion.div>
                 )}
               </AnimatePresence>

               {/* Tab Abandonment / Focus Lost Overlay */}
               <AnimatePresence>
                 {!isPageVisible && (
                   <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-xl"
                   >
                     <div className="bg-white/80 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-md border border-white/50">
                       <WarningCircle className="w-16 h-16 text-rose-400 mb-4" />
                       <h2 className="text-2xl font-bold text-slate-800 mb-2">Focus Lost</h2>
                       <p className="text-slate-600 mb-6">You have switched tabs. For the integrity of the interview, please keep this tab active.</p>
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Live Captions */}
               <LiveCaptions 
                 isVisible={isLiveCaptionsEnabled} 
                 speaker={isAiSpeaking ? 'AI' : (isRecording ? 'User' : null)}
                 text={isAiSpeaking ? latestAiMessage : activeUserTranscript}
               />

               {/* Pinned Question */}
               <PinnedQuestion questionText={latestAiMessage} isVisible={isRecording && !isFocusMode} loopMeta={loopMeta} />

               {/* Ambient Background Glows - Liquid Fluid Animation */}
               {!isCalmMode && (
                 <>
                   <motion.div 
                     animate={{
                       scale: [1, 1.1, 1],
                       x: ["-50%", "-48%", "-50%"],
                       y: ["-50%", "-52%", "-50%"],
                       opacity: [0.5, 0.7, 0.5]
                     }}
                     transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                     className={`absolute top-1/2 left-1/2 w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] ${stressTest ? 'bg-rose-200/40' : 'bg-sky-200/50'} blur-[100px] rounded-full pointer-events-none`} 
                   />
                   <motion.div 
                     animate={{
                       scale: [1, 1.2, 1],
                       x: ["-30%", "-40%", "-30%"],
                       y: ["-60%", "-70%", "-60%"],
                       borderRadius: ["40% 60% 70% 30%/50% 60% 30% 60%", "60% 40% 30% 70%/60% 30% 70% 40%", "40% 60% 70% 30%/50% 60% 30% 60%"]
                     }}
                     transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                     className={`absolute top-1/2 left-1/2 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] ${stressTest ? 'bg-orange-200/30' : 'bg-emerald-200/40'} blur-[100px] pointer-events-none mix-blend-multiply`} 
                   />
                   <motion.div 
                     animate={{
                       scale: [1, 1.1, 1],
                       x: ["-70%", "-60%", "-70%"],
                       y: ["-30%", "-40%", "-30%"],
                       borderRadius: ["60% 40% 30% 70%/60% 30% 70% 40%", "40% 60% 70% 30%/50% 60% 30% 60%", "60% 40% 30% 70%/60% 30% 70% 40%"]
                     }}
                     transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                     className={`absolute top-1/2 left-1/2 w-[45vw] h-[45vw] max-w-[550px] max-h-[550px] ${stressTest ? 'bg-red-200/20' : 'bg-teal-200/30'} blur-[110px] pointer-events-none mix-blend-multiply`} 
                   />
                 </>
               )}
               
               {isCalmMode && (
                 <div className={`absolute inset-0 rounded-[32px] ${stressTest ? 'bg-rose-50/50' : 'bg-sky-50/50'} backdrop-blur-3xl`} />
               )}
               
               {!modelsReady && (
                 <div 
                   role="status" 
                   aria-live="polite" 
                   className="absolute top-6 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md text-slate-500 rounded-full text-xs font-medium border border-white shadow-sm z-20"
                 >
                   <WarningCircle className="w-4 h-4 text-sky-400" aria-hidden="true" /> 正在初始化AI模型组件...
                 </div>
               )}
              
               <MultiAgentVisualizer isSpeaking={isAiSpeaking} isLoading={isLoading || !modelsReady} statusText={modelStatus} stressTest={stressTest} wpm={wpm} isCalmMode={isCalmMode} activeExpert={activeExpert} />

               {/* Add LiveWaveform here if recording */}
               <AnimatePresence>
                 {isRecording && activeStream && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     className="absolute bottom-28 w-[300px] z-10"
                   >
                     <LiveWaveform stream={activeStream} isRecording={isRecording} />
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Liquid Glass Controls Dock */}
               <div className="absolute bottom-8 z-20 flex items-center justify-center w-full px-6">
                  <div className="bg-white/30 backdrop-blur-[24px] rounded-[32px] p-2.5 flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-white/40">
                    <motion.button 
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      // Phase 9: keyboard users activate via click (Enter/Space).
                      // Mouse/touch use press-and-hold above; real clicks from
                      // pointing devices have event.detail > 0 and are ignored
                      // here to avoid double-toggling.
                      onClick={(e) => { if (e.detail === 0) handleStartSpeaking(); }}
                      disabled={!modelsReady || isLoading}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className={`group relative w-12 h-12 rounded-full flex items-center justify-center outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                        isRecording 
                          ? 'bg-rose-400 text-white shadow-[0_0_20px_rgba(251,113,133,0.3)] border border-rose-300' 
                          : 'bg-white text-slate-600 hover:text-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-white/80'
                      }`}
                      aria-label={isRecording ? "停止录音" : "开始录音"}
                      aria-pressed={isRecording}
                    >
                      <Microphone className="w-5 h-5" />
                      {isRecording ? (
                         <span className="absolute -top-10 text-[11px] font-medium text-rose-500 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full whitespace-nowrap shadow-sm border border-rose-100">
                           正在录音...
                         </span>
                      ) : (
                         <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-slate-500 bg-white/90 backdrop-blur-md px-2 py-1 rounded-md whitespace-nowrap shadow-sm border border-slate-200/50 flex items-center gap-1 pointer-events-none">
                           按 <kbd className="font-sans px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 shadow-sm leading-none">空格</kbd> 说话
                         </div>
                      )}
                    </motion.button>

                    <div className="w-px h-6 bg-slate-200/60" />

                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => setIsScratchpadOpen(true)}
                      title="Open Scratchpad"
                      aria-label="打开白板 (Scratchpad)"
                    >
                      <PencilSimple className="w-5 h-5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={() => setIsSystemDesignOpen(true)}
                      title="Open System Design Board"
                      aria-label="打开系统设计 (System Design)"
                    >
                      <Graph className="w-5 h-5 text-indigo-500" />
                    </Button>

                    <div className="w-px h-6 bg-slate-200/60" />

                    <Button
                      variant="ghost"
                      size="icon-lg"
                      onClick={requestHint}
                      disabled={isRequestingHint}
                      title="Request Hint"
                      aria-label="请求代码提示 (Hint)"
                    >
                      {isRequestingHint ? (
                         <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                         <Lightbulb className="w-5 h-5 text-amber-500" />
                      )}
                    </Button>

                    <div className="w-px h-6 bg-slate-200/60" />

                    <div className="relative flex items-center w-full md:w-[280px]">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && inputText.trim()) {
                            handleTextSubmit();
                          }
                        }}
                        disabled={!modelsReady || isLoading}
                        placeholder="输入文本..."
                        aria-label="输入您的回答或向AI提问"
                        className="w-full bg-transparent border-none focus:ring-0 h-10 pl-3 pr-12 text-[14px] text-slate-700 font-medium placeholder:text-slate-400 outline-none transition-all focus-visible:ring-2 focus-visible:ring-sky-500 rounded-full"
                      />
                      <Button 
                        size="icon"
                        onClick={handleTextSubmit}
                        disabled={!inputText.trim() || !modelsReady || isLoading}
                        className="group absolute right-1 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                        aria-label="发送消息"
                      >
                        <PaperPlaneRight className="w-3.5 h-3.5 ml-0.5" />
                        <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-slate-500 bg-white/90 backdrop-blur-md px-2 py-1 rounded-md whitespace-nowrap shadow-sm border border-slate-200/50 flex items-center gap-1 pointer-events-none">
                           <kbd className="font-sans px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 shadow-sm leading-none">⌘</kbd>
                           <kbd className="font-sans px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 shadow-sm leading-none">↵</kbd>
                         </div>
                      </Button>
                    </div>
                  </div>
               </div>
            </div>
  );
}
