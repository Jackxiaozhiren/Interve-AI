"use client";

/* eslint-disable react-hooks/immutability, react-hooks/refs --
   These hooks deliberately operate on refs owned by the caller: the room shares
   one MediaRecorder / Worker instance across slices, so the ref object is a
   handle, not immutable state. React's own ref contract allows writing
   `.current` outside render; the compiler rule assumes hook arguments are
   immutable, which is not true for refs by design. Every write below happens in
   an event handler or an effect, never during render. */

import type { RefObject } from "react";
import { useKeyboardShortcuts, createCtrlCmdShortcut } from "@/hooks/useKeyboardShortcuts";

/**
 * S4 slice 9: the room's keyboard map (Esc pause, F focus, Space push-to-talk,
 * Cmd/Ctrl+Enter send, Cmd/Ctrl+K focus composer, Cmd/Ctrl+M mic toggle). The
 * table moved verbatim from page.tsx; every handler is injected so this file
 * stays a key map and cannot drift into a second copy of the room's logic.
 */
export function useRoomShortcuts(opts: {
  togglePaused: () => void;
  toggleFocusMode: () => void;
  isRecording: boolean;
  isStandby: boolean;
  modelsReady: boolean;
  isLoading: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  inputText: string;
  handleTextSubmit: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const {
    togglePaused, toggleFocusMode, isRecording, isStandby, modelsReady, isLoading,
    startRecording, stopRecording, inputText, handleTextSubmit, inputRef,
  } = opts;

  useKeyboardShortcuts([
    {
      key: "Escape",
      allowInInput: true,
      handler: togglePaused,
    },
    {
      key: "f",
      allowInInput: false,
      handler: toggleFocusMode,
    },
    {
      key: " ",
      allowInInput: false,
      handler: () => {
        if (!isRecording && modelsReady && !isLoading && !isStandby) {
          startRecording();
        }
      },
      keyUpHandler: () => {
        if (isRecording && !isStandby) {
          stopRecording();
        }
      }
    },
    {
      key: "Enter",
      metaKey: true,
      allowInInput: true,
      handler: () => {
        if (!modelsReady || isLoading) return;
        if (inputText.trim()) {
          handleTextSubmit();
        }
      }
    },
    {
      key: "Enter",
      ctrlKey: true,
      allowInInput: true,
      handler: () => {
        if (!modelsReady || isLoading) return;
        if (inputText.trim()) {
          handleTextSubmit();
        }
      }
    },
    ...createCtrlCmdShortcut("k", () => {
      inputRef.current?.focus();
    }, { allowInInput: true }),
    ...createCtrlCmdShortcut("m", () => {
      if (!modelsReady || isLoading || isStandby) return;
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }, { allowInInput: true })
  ]);
}
