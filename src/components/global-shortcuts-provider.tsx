"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useKeyboardShortcuts,
  createCtrlCmdShortcut,
} from "@/hooks/useKeyboardShortcuts";

/* ═══════════════════════════════════════
   Global Keyboard Shortcuts Provider
   Mount once in root layout / providers
   ═══════════════════════════════════════ */

export function GlobalShortcutsProvider() {
  const router = useRouter();

  // Ctrl/Cmd + K → Focus search input
  const handleSearch = useCallback((e: KeyboardEvent) => {
    const searchInput = document.querySelector<HTMLInputElement>(
      '[data-shortcut="search"], input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"]'
    );
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }, []);

  // Ctrl/Cmd + N → New conversation
  const handleNewChat = useCallback(
    (e: KeyboardEvent) => {
      router.push("/chat");
    },
    [router]
  );

  // Esc → Close modals/drawers
  const handleEscape = useCallback((e: KeyboardEvent) => {
    // Let Radix/headless UI handle Esc for their portals first
    // Only intercept if no portal overlay is open
    const overlay = document.querySelector(
      '[data-radix-portal], [role="dialog"], [data-state="open"]'
    );
    if (overlay) return; // Let the UI lib handle it

    // Blur currently focused element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  // Ctrl/Cmd + S → Save (prevent browser save, trigger form submit)
  const handleSave = useCallback((e: KeyboardEvent) => {
    const saveButton = document.querySelector<HTMLButtonElement>(
      'button[type="submit"], button[data-shortcut="save"]'
    );
    if (saveButton) {
      saveButton.click();
    }
  }, []);

  useKeyboardShortcuts([
    ...createCtrlCmdShortcut("k", handleSearch, {
      description: "聚焦搜索框",
    }),
    ...createCtrlCmdShortcut("n", handleNewChat, {
      description: "新建对话",
    }),
    {
      key: "Escape",
      handler: handleEscape,
      allowInInput: true,
      preventDefault: false,
      description: "关闭弹窗",
    },
    ...createCtrlCmdShortcut("s", handleSave, {
      allowInInput: true,
      description: "保存设置",
    }),
  ]);

  return null; // This is a headless provider
}
