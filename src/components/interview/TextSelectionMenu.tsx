"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Brain, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function TextSelectionMenu() {
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const isMouseDown = useRef(false);

  useEffect(() => {
    const handleMouseUp = () => {
      isMouseDown.current = false;
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim() !== "") {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelectedText(selection.toString().trim());
          setSelectionRect(rect);
        } else {
          setSelectionRect(null);
          setSelectedText("");
        }
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Don't close if clicking on the menu itself
      const target = e.target as HTMLElement;
      if (target.closest('.text-selection-menu')) return;
      
      isMouseDown.current = true;
      setSelectionRect(null);
    };

    const handleSelectionChange = () => {
      if (isMouseDown.current) return;
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === "") {
        setSelectionRect(null);
        setSelectedText("");
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    toast.success("已复制", { description: "内容已复制到剪贴板" });
    setSelectionRect(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleAskAI = () => {
    window.dispatchEvent(new CustomEvent("ask-ai", { detail: selectedText }));
    setSelectionRect(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleSendToScratchpad = () => {
    const existing = localStorage.getItem("interve_scratchpad_content") || "";
    const newContent = existing ? existing + "\n\n" + selectedText : selectedText;
    localStorage.setItem("interve_scratchpad_content", newContent);
    toast.success("已发送至白板", { description: "可在技术白板中查看" });
    setSelectionRect(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <AnimatePresence>
      {selectionRect && selectedText && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            position: "fixed",
            top: Math.max(10, selectionRect.top - 50),
            left: selectionRect.left + selectionRect.width / 2,
            transform: "translateX(-50%)",
            zIndex: 9999,
          }}
          className="text-selection-menu flex items-center gap-1 bg-slate-800 text-white px-2 py-1.5 rounded-lg shadow-xl border border-slate-700 pointer-events-auto"
          role="menu"
          aria-label="文本操作菜单"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-white hover:bg-slate-700 hover:text-white h-8 px-2"
            role="menuitem"
            aria-label="复制选中文本"
          >
            <Copy className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-medium">复制</span>
          </Button>
          <div className="w-px h-4 bg-slate-600" aria-hidden="true" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAskAI}
            className="text-white hover:bg-slate-700 hover:text-white h-8 px-2"
            role="menuitem"
            aria-label="将选中文本发送给AI"
          >
            <Brain className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-medium">问AI</span>
          </Button>
          <div className="w-px h-4 bg-slate-600" aria-hidden="true" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendToScratchpad}
            className="text-white hover:bg-slate-700 hover:text-white h-8 px-2"
            role="menuitem"
            aria-label="发送到代码白板"
          >
            <PencilSimple className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-medium">至白板</span>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
