"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Graph, Sun, Moon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tldraw, useEditor } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { extractSystemDesignText } from "@/lib/tldraw-extractor";

interface SystemDesignBoardProps {
  isOpen: boolean;
  onClose: () => void;
}

import { toast } from "sonner";
import { Editor } from "@tldraw/tldraw";

// Component to listen to Tldraw state changes
const TldrawListener = ({ onTextUpdate, onEditorMount }: { onTextUpdate: (text: string) => void, onEditorMount: (editor: Editor) => void }) => {
  const editor = useEditor();

  useEffect(() => {
    onEditorMount(editor);
  }, [editor, onEditorMount]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          const shapes = Array.from(editor.getCurrentPageShapes());
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const extractedText = extractSystemDesignText(shapes as any);
          onTextUpdate(extractedText);
        } catch (err) {
          console.error("Error extracting tldraw text:", err);
        }
      }, 500); // Debounce to avoid performance issues during active drawing
    };

    // Listen to changes in the document
    const unsubscribe = editor.store.listen(handleChange, { scope: 'document' });
    
    // Initial extraction
    handleChange();
    
    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [editor, onTextUpdate]);

  return null;
};

export const SystemDesignBoard = React.memo(function SystemDesignBoard({ isOpen, onClose }: SystemDesignBoardProps) {
  const [editorTheme, setEditorTheme] = useState<"light" | "dark">("light");
  const [extractedContext, setExtractedContext] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleTextUpdate = useCallback((text: string) => {
    setExtractedContext(text);
    // Save to local storage for the AI context loop
    try {
      localStorage.setItem("interve_system_design_content", text);
    } catch {
      // Ignore write errors
    }
  }, []);

  const handleAnalyzeSnapshot = async () => {
    if (!editor) return;
    
    try {
      setIsAnalyzing(true);
      toast.info("Analyzing Architecture...", { description: "Sending snapshot to Vision Model for evaluation" });
      
      const shapeIds = Array.from(editor.getCurrentPageShapeIds());
      if (shapeIds.length === 0) {
        toast.error("Empty Board", { description: "Please draw your architecture before analyzing." });
        setIsAnalyzing(false);
        return;
      }
      
      const { blob } = await editor.toImage(shapeIds, {
        format: 'png',
        background: true,
        padding: 16
      });
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result;
        
        // Call vision API
        const res = await fetch('/api/analyze-vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            imageBase64: base64data,
            problemContext: "Evaluate the scalability, single points of failure, and missing components."
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          toast.success("Architecture Feedback", {
            description: data.feedback,
            duration: 15000,
            position: "top-center"
          });
        } else {
          toast.error("Analysis Failed", { description: "Could not evaluate architecture." });
        }
        setIsAnalyzing(false);
      };
    } catch (err) {
      console.error("Failed to analyze snapshot", err);
      toast.error("Snapshot Error", { description: "Failed to generate image from board." });
      setIsAnalyzing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 200 }}
          className="fixed inset-6 z-[60] bg-white/95 backdrop-blur-3xl border border-slate-200/60 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.1)] rounded-[2rem] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200/50 bg-white/40 z-10">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="p-2 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl shadow-sm">
                <Graph className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h3 className="font-serif text-[1.2rem] tracking-tight font-semibold">System Design Architecture</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Interactive Whiteboard (Tldraw)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant="default"
                size="sm"
                onClick={handleAnalyzeSnapshot}
                disabled={isAnalyzing || !editor}
                className="rounded-xl shadow-sm bg-indigo-500 hover:bg-indigo-600 text-white font-medium px-4"
              >
                {isAnalyzing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  "Snapshot & Analyze"
                )}
              </Button>
            
              <Button
                variant="glass"
                size="icon"
                onClick={() => setEditorTheme(prev => prev === "light" ? "dark" : "light")}
                aria-label={editorTheme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                className="rounded-[14px] text-slate-500 hover:text-indigo-500 hover:bg-white"
                title="Toggle Theme"
              >
                {editorTheme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close System Design Board"
                className="rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Main Whiteboard Content */}
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
              <Tldraw persistenceKey="interve-system-design" autoFocus>
                <TldrawListener onTextUpdate={handleTextUpdate} onEditorMount={setEditor} />
              </Tldraw>
            </div>
          </div>
          
          {/* Footer Info */}
          <div className="px-6 py-3 border-t border-slate-200/50 bg-white/40 text-[11px] text-slate-400 font-bold uppercase tracking-widest flex justify-between items-center z-10">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              AI Analysis Active
            </span>
            <span>{extractedContext.length > 0 ? "Diagram Captured" : "Draw to analyze"}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

