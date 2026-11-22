"use client";

import { useState } from "react";

/**
 * S4 slice 2/5: pure UI switches of the room — panel visibility and the
 * pause/focus modes. No effects, no cross-domain reads; states moved verbatim
 * from page.tsx so the orchestration layer stops owning them.
 */
export function useRoomPanels() {
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [isSystemDesignOpen, setIsSystemDesignOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  return {
    isScratchpadOpen,
    setIsScratchpadOpen,
    isSystemDesignOpen,
    setIsSystemDesignOpen,
    isFocusMode,
    setIsFocusMode,
    isPaused,
    setIsPaused,
  };
}
