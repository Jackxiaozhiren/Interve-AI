"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

interface TextSelectionMenuProps {
  onEnhance?: (text: string) => void;
  onSummarize?: (text: string) => void;
}

export function TextSelectionMenu({ onEnhance }: TextSelectionMenuProps) {
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      const activeSelection = window.getSelection();
      if (!activeSelection || activeSelection.isCollapsed) {
        setSelection(null);
        return;
      }

      const text = activeSelection.toString().trim();
      if (!text) {
        setSelection(null);
        return;
      }

      const range = activeSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelection({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
    };

    document.addEventListener("mouseup", handleMouseUp);
    // Hide when clicking elsewhere
    const handleMouseDown = (e: MouseEvent) => {
      // Allow clicking on the menu itself
      if ((e.target as Element).closest("#text-selection-menu")) return;
      
      const activeSelection = window.getSelection();
      if (activeSelection && !activeSelection.isCollapsed) {
          // If clicking while text is selected, let mouseup handle it
          return;
      }
      setSelection(null);
    };
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  const handleCopy = () => {
    if (selection) {
      navigator.clipboard.writeText(selection.text);
      toast.success("Copied to clipboard");
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleEnhance = () => {
    if (selection && onEnhance) {
      onEnhance(selection.text);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          id="text-selection-menu"
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed z-50 flex items-center gap-1 p-1 bg-slate-900 rounded-xl shadow-xl shadow-slate-900/20 border border-slate-800"
          style={{ 
            left: selection.x, 
            top: selection.y,
            transform: 'translate(-50%, -100%)' // Center above selection
          }}
        >
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Copy weight="bold" />
            Copy
          </button>
          
          <div className="w-px h-4 bg-slate-700" />
          
          <button 
            onClick={handleEnhance}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-sky-400 hover:text-sky-300 hover:bg-slate-800 transition-colors"
          >
            <Sparkle weight="bold" />
            Enhance
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
