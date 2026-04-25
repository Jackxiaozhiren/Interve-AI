"use client";

import { useEffect, useRef } from "react";

/* ═══════════════════════════════════════
   Interve AI — Keyboard Shortcuts System
   Supports Ctrl/Cmd cross-platform keys
   ═══════════════════════════════════════ */

export type ShortcutConfig = {
  /** Key to match (case-insensitive) */
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  /** Handler function */
  handler: (e: KeyboardEvent) => void;
  /** Key up handler function */
  keyUpHandler?: (e: KeyboardEvent) => void;
  /** If true, shortcut triggers even when an input/textarea is focused */
  allowInInput?: boolean;
  /** Defaults to true — prevents browser default for the key combo */
  preventDefault?: boolean;
  /** Human-readable description for help panel */
  description?: string;
};

/**
 * Matches Ctrl on Windows/Linux, Cmd on macOS.
 * Set `ctrlOrCmd: true` in the shortcut config helper.
 */
export function createCtrlCmdShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  opts?: Partial<Omit<ShortcutConfig, "key" | "handler">>
): ShortcutConfig[] {
  return [
    { key, ctrlKey: true, handler, ...opts },
    { key, metaKey: true, handler, ...opts },
  ];
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable;

      for (const shortcut of shortcutsRef.current) {
        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!shortcut.ctrlKey === event.ctrlKey &&
          !!shortcut.metaKey === event.metaKey &&
          !!shortcut.shiftKey === event.shiftKey &&
          !!shortcut.altKey === event.altKey
        ) {
          // Skip if input is focused and shortcut doesn't allow it
          if (isInputFocused && !shortcut.allowInInput) {
            continue;
          }

          if (shortcut.preventDefault !== false) {
            event.preventDefault();
            event.stopPropagation();
          }

          shortcut.handler(event);
          return; // Only trigger the first matched shortcut
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable;

      for (const shortcut of shortcutsRef.current) {
        if (!shortcut.keyUpHandler) continue;

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          !!shortcut.ctrlKey === event.ctrlKey &&
          !!shortcut.metaKey === event.metaKey &&
          !!shortcut.shiftKey === event.shiftKey &&
          !!shortcut.altKey === event.altKey
        ) {
          // Skip if input is focused and shortcut doesn't allow it
          if (isInputFocused && !shortcut.allowInInput) {
            continue;
          }

          if (shortcut.preventDefault !== false) {
            event.preventDefault();
            event.stopPropagation();
          }

          shortcut.keyUpHandler(event);
          return; // Only trigger the first matched shortcut
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, []);
}

/* ─── Shortcut Definitions ─── */
export const GLOBAL_SHORTCUT_LIST = [
  { keys: "Ctrl/⌘ + K", description: "聚焦搜索框" },
  { keys: "Ctrl/⌘ + N", description: "新建对话" },
  { keys: "Esc", description: "关闭当前弹窗" },
  { keys: "Enter", description: "发送消息" },
  { keys: "Shift + Enter", description: "输入框换行" },
  { keys: "Ctrl/⌘ + S", description: "保存设置" },
] as const;
