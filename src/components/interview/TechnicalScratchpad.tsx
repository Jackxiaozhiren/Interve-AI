"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Code, TextAlignLeft, Copy, Check, FileCode, Sun, Moon, ShieldWarning, Play, Stop, TerminalWindow } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useCodeExecutor } from "@/hooks/useCodeExecutor";
import { useInterveStore } from "@/store/useInterveStore";
import { toast } from "sonner";
import { OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-slate-400">
      <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2" />
      Loading Editor...
    </div>
  ),
});

interface TechnicalScratchpadProps {
  isOpen: boolean;
  onClose: () => void;
  problemStatement?: string | null;
}

export const TechnicalScratchpad = React.memo(function TechnicalScratchpad({ isOpen, onClose, problemStatement }: TechnicalScratchpadProps) {
  const [mode, setMode] = useState<"code" | "notes">("code");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState("javascript");
  const [editorTheme, setEditorTheme] = useState<"light" | "vs-dark">("light");
  
  // AI Analysis State
  const [analysis, setAnalysis] = useState<{
    timeComplexity: string;
    spaceComplexity: string;
    hints: string[];
    isOptimal: boolean;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suspiciousPasteCount, setSuspiciousPasteCount] = useState(0);

  // Live Code Execution State
  const { logs, isRunning, executeCode, stopExecution, clearLogs } = useCodeExecutor();
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);

  // Cognitive Load Tracking
  const setCognitiveLoad = useInterveStore(state => state.setCognitiveLoad);
  const lastKeyTime = React.useRef<number>(Date.now());
  const keystrokeCount = React.useRef<number>(0);
  const backspaceCount = React.useRef<number>(0);
  const pauseCount = React.useRef<number>(0);

  const handleEditorDidMount: OnMount = useCallback((editorInstance) => {
    interface PasteEvent {
      range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number };
    }
    editorInstance.onDidPaste((e: unknown) => {
      const pasteEvent = e as PasteEvent;
      try {
        const pastedText = editorInstance.getModel()?.getValueInRange(pasteEvent.range) || "";
        if (pastedText.length > 200) {
          setSuspiciousPasteCount(prev => prev + 1);
          toast.warning("检测到大量代码粘贴", {
            description: "我们注意到您粘贴了大段代码。请准备好在面试中解释这些逻辑。",
            duration: 6000
          });
        }
      } catch (err) {
        console.warn("Error tracking paste event", err);
      }
    });

    editorInstance.onKeyDown((e: { keyCode: number }) => {
      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;
      
      // Pause > 3 seconds
      if (timeDiff > 3000) pauseCount.current += 1;
      
      // keyCode 2 is Backspace in Monaco IKeyboardEvent
      if (e.keyCode === 2) {
        backspaceCount.current += 1;
      } else {
        keystrokeCount.current += 1;
      }
      lastKeyTime.current = now;
    });
  }, []);

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const savedContent = localStorage.getItem("interve_scratchpad_content");
      const savedMode = localStorage.getItem("interve_scratchpad_mode");
      setTimeout(() => {
        if (savedContent) setContent(savedContent);
        if (savedMode === "code" || savedMode === "notes") setMode(savedMode);
      }, 0);
    } catch {
      console.warn("localStorage access restricted");
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem("interve_scratchpad_content", content);
    } catch {
      // Ignore write errors
    }
  }, [content]);

  // Periodic Cognitive Load Evaluation
  useEffect(() => {
    const interval = setInterval(() => {
      const totalKeys = keystrokeCount.current;
      const backspaces = backspaceCount.current;
      const pauses = pauseCount.current;
      
      let load = 0;
      if (totalKeys > 0) {
        const errorRate = backspaces / totalKeys;
        load += errorRate * 150; // High backspace ratio increases load
      }
      
      load += pauses * 20; // 20 load per 3-second pause
      
      if (totalKeys === 0 && pauses === 0) {
        // If completely idle, gradually decay load
        setCognitiveLoad(prev => Math.max(0, prev - 5));
      } else {
        setCognitiveLoad(prev => {
          const newLoad = Math.min(100, Math.max(0, (prev * 0.6) + (load * 0.4)));
          return newLoad;
        });
      }
      
      // Reset counters for next window
      keystrokeCount.current = 0;
      backspaceCount.current = 0;
      pauseCount.current = 0;
    }, 5000); // evaluate every 5 seconds
    
    return () => clearInterval(interval);
  }, [setCognitiveLoad]);

  useEffect(() => {
    try {
      if (logs.length > 0) {
        localStorage.setItem("interve_scratchpad_logs", JSON.stringify(logs));
      } else {
        localStorage.removeItem("interve_scratchpad_logs");
      }
    } catch {
      // Ignore write errors
    }
  }, [logs]);

  // Debounced AI Analysis
  useEffect(() => {
    if (mode !== "code" || content.trim().length < 10) {
      const resetTimer = setTimeout(() => setAnalysis(null), 0);
      return () => clearTimeout(resetTimer);
    }

    const timer = setTimeout(async () => {
      setIsAnalyzing(true);
      try {
        const res = await fetch("/api/analyze-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: content, language, problemStatement }),
        });
        if (res.ok) {
          const data = await res.json();
          setAnalysis(data);
        }
      } catch (err) {
        console.error("Analysis failed", err);
      } finally {
        setIsAnalyzing(false);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [content, mode, language, problemStatement]);

  useEffect(() => {
    try {
      localStorage.setItem("interve_scratchpad_mode", mode);
    } catch {
      // Ignore write errors
    }
  }, [mode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 200 }}
          drag
          dragConstraints={{ left: -1000, right: 0, top: 0, bottom: 1000 }}
          dragElastic={0.1}
          dragMomentum={false}
          className="fixed top-6 right-6 bottom-6 w-[600px] md:w-[800px] max-w-[90vw] bg-white/60 backdrop-blur-3xl border border-white/60 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)] rounded-[2rem] flex flex-col z-50 overflow-hidden resize-x min-w-[400px]"
        >
          <style>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 8px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background-color: rgba(203, 213, 225, 0.6);
              border-radius: 20px;
            }
            .custom-scrollbar:hover::-webkit-scrollbar-thumb {
              background-color: rgba(125, 211, 252, 0.8);
            }
          `}</style>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/80 bg-white/40 cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-3 text-slate-800 pointer-events-none">
              <div className="p-2 bg-gradient-to-br from-sky-50 to-white border border-sky-100 rounded-xl shadow-sm">
                {mode === "code" ? <FileCode className="w-5 h-5 text-sky-500" /> : <TextAlignLeft className="w-5 h-5 text-sky-500" />}
              </div>
              <h3 className="font-serif text-[1.1rem] tracking-tight font-semibold">Technical Sandbox</h3>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close Scratchpad"
              className="rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Mode Switcher & Language */}
          <div className="p-5 bg-gradient-to-b from-white/30 to-transparent flex flex-col gap-4">
            {problemStatement && (
              <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-2xl text-sm text-slate-700 leading-relaxed shadow-sm">
                <span className="font-bold text-sky-700 mr-2 uppercase tracking-wider text-[11px]">Problem:</span>
                {problemStatement}
              </div>
            )}
            <div className="flex gap-4">
              <div className="flex flex-1 p-1.5 bg-slate-100/50 backdrop-blur-md rounded-[14px] border border-white/80 shadow-sm">
                <Button
                  variant="ghost"
                  onClick={() => setMode("code")}
                  aria-pressed={mode === "code"}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 h-auto text-[13px] font-bold tracking-wide rounded-[10px] focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    mode === "code"
                      ? "bg-white text-sky-600 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:bg-white hover:text-sky-600"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
                  }`}
                >
                  <Code className="w-4 h-4" />
                  Code
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setMode("notes")}
                  aria-pressed={mode === "notes"}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 h-auto text-[13px] font-bold tracking-wide rounded-[10px] focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    mode === "notes"
                      ? "bg-white text-sky-600 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:bg-white hover:text-sky-600"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/40"
                  }`}
                >
                  <TextAlignLeft className="w-4 h-4" />
                  Notes
                </Button>
              </div>
              
              {mode === "code" && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="glass"
                    size="icon"
                    onClick={() => setEditorTheme(prev => prev === "light" ? "vs-dark" : "light")}
                    aria-label={editorTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                    className="rounded-[14px] text-slate-500 hover:text-sky-500 hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    title="Toggle Theme"
                  >
                    {editorTheme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </Button>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    aria-label="Select programming language"
                    className="bg-slate-100/50 backdrop-blur-md border border-white/80 text-slate-600 text-sm rounded-[14px] px-4 h-10 font-medium outline-none focus:ring-2 focus:ring-sky-500 transition-all shadow-sm"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                  <div className="h-6 w-px bg-slate-300 mx-1"></div>
                  {isRunning ? (
                    <Button
                      onClick={stopExecution}
                      className="bg-rose-500 hover:bg-rose-600 text-white rounded-[14px] h-10 px-4 font-bold tracking-wide shadow-sm flex items-center gap-2"
                    >
                      <Stop className="w-4 h-4 weight-fill" /> Stop
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        clearLogs();
                        setIsTerminalOpen(true);
                        executeCode(content, language);
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-[14px] h-10 px-4 font-bold tracking-wide shadow-sm flex items-center gap-2"
                    >
                      <Play className="w-4 h-4 weight-fill" /> Run Code
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 p-6 relative group pt-2 overflow-hidden flex flex-col">
            {mode === "code" ? (
              <div className={`w-full flex-1 flex flex-col rounded-[16px] overflow-hidden border border-slate-200/60 shadow-inner ${editorTheme === 'vs-dark' ? 'bg-[#1e1e1e]' : 'bg-[#fffffe]'}`}>
                <div className="flex-1 min-h-[50%]">
                  <Editor
                    height="100%"
                    language={language}
                    theme={editorTheme}
                    value={content}
                    onChange={(val) => setContent(val || "")}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      fontFamily: "var(--font-mono), monospace",
                      lineHeight: 24,
                      padding: { top: 16, bottom: 16 },
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      cursorSmoothCaretAnimation: "on",
                      formatOnPaste: true,
                      wordWrap: "on",
                      scrollbar: {
                        verticalScrollbarSize: 8,
                        horizontalScrollbarSize: 8,
                      }
                    }}
                    loading={
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2" />
                        Loading Editor...
                      </div>
                    }
                  />
                </div>
                
                {/* Terminal Pane */}
                <AnimatePresence>
                  {isTerminalOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "30%", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-200 bg-[#0d1117] text-slate-300 font-mono text-[13px] flex flex-col overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#161b22]">
                        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-widest font-bold">
                          <TerminalWindow className="w-4 h-4" />
                          Output Terminal
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={clearLogs} className="h-6 text-xs text-slate-400 hover:text-white px-2">Clear</Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setIsTerminalOpen(false)} className="text-slate-400 hover:text-white rounded-full">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                        {logs.length === 0 ? (
                          <div className="text-slate-600 italic">No output yet. Run your code to see results.</div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {logs.map((log, i) => (
                              <div key={i} className={"font-mono " + (
                                log.type === 'error' ? 'text-rose-400' :
                                log.type === 'warn' ? 'text-amber-400' :
                                log.type === 'system' ? 'text-sky-400 italic' :
                                'text-emerald-400'
                              )}>
                                <span className="opacity-40 mr-3 text-[11px]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                {log.message}
                              </div>
                            ))}
                            {isRunning && (
                              <div className="flex items-center text-slate-500 mt-2">
                                <span className="w-2 h-4 bg-slate-500 animate-pulse mr-2" /> Executing...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Jot down your thoughts or architecture notes..."
                aria-label="Scratchpad notes"
                className="custom-scrollbar w-full flex-1 resize-none bg-transparent border-none focus:ring-0 text-[15px] leading-relaxed text-slate-700 placeholder:text-slate-300 outline-none font-sans pr-2"
                spellCheck={false}
              />
            )}
            
            {/* Copy Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: content.length > 0 ? 1 : 0 }}
              className="absolute bottom-6 right-6 z-10"
            >
              <Button
                variant="glass"
                size="icon"
                onClick={handleCopy}
                disabled={content.length === 0}
                aria-label="Copy contents"
                className="bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-slate-100 text-slate-500 hover:text-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors disabled:opacity-0"
              >
                {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
              </Button>
            </motion.div>
          </div>

          {/* Footer Info & Complexity Analysis */}
          <div className="px-6 py-4 border-t border-white/60 bg-white/40 text-[11px] text-slate-400 font-bold uppercase tracking-widest flex justify-between items-center relative overflow-hidden">
            {mode === "code" && analysis && (
              <div className="flex items-center gap-4 text-xs normal-case tracking-normal">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="text-slate-400">Time:</span> 
                  <span className={analysis.timeComplexity.includes("n^2") || analysis.timeComplexity.includes("2^n") ? "text-rose-500 font-bold" : "text-emerald-600 font-bold"}>{analysis.timeComplexity}</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="text-slate-400">Space:</span> 
                  <span className="text-sky-600 font-bold">{analysis.spaceComplexity}</span>
                </span>
                {analysis.hints.length > 0 && (
                  <span className="text-amber-600 truncate max-w-[200px] lg:max-w-[300px]" title={analysis.hints[0]}>
                    💡 {analysis.hints[0]}
                  </span>
                )}
              </div>
            )}
            
            {mode === "code" && isAnalyzing && (
              <div className="flex items-center gap-2 text-sky-500 normal-case tracking-normal text-xs animate-pulse">
                Analyzing complexity...
              </div>
            )}

            <div className="flex items-center gap-4 ml-auto">
              {suspiciousPasteCount > 0 && (
                <span className="flex items-center gap-1.5 text-rose-500 font-bold bg-rose-50/80 px-2 py-0.5 rounded-md border border-rose-100">
                  <ShieldWarning className="w-3.5 h-3.5" />
                  Integrity Event ({suspiciousPasteCount})
                </span>
              )}
              <span className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isAnalyzing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                Local Draft
              </span>
              <span>{content.length} chars</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
