"use client";

import { useEffect, useRef, useState } from "react";
import type { AIExpert } from "@/lib/interview/experts";

/**
 * S4 slice 1/5: the interview room's working context — what the candidate is
 * typing, which surfaces carry context, and the resume/problem statements the
 * transport needs. States moved verbatim from page.tsx; the two refs that
 * mirror code/design context for the whisper dispatch come along with their
 * sync effects, so readers keep seeing fresh values without re-subscribing.
 */
export function useRoomWorkState() {
  const [inputText, setInputText] = useState("");
  const [activeContext, setActiveContext] = useState("");
  const [activeCodeContext, setActiveCodeContext] = useState("");
  const [activeSystemDesignContext, setActiveSystemDesignContext] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [isRequestingHint, setIsRequestingHint] = useState(false);
  const [activeExpert, setActiveExpert] = useState<AIExpert>("system");

  const activeCodeContextRef = useRef(activeCodeContext);
  const activeSystemDesignContextRef = useRef(activeSystemDesignContext);

  useEffect(() => {
    activeCodeContextRef.current = activeCodeContext;
  }, [activeCodeContext]);

  useEffect(() => {
    activeSystemDesignContextRef.current = activeSystemDesignContext;
  }, [activeSystemDesignContext]);

  return {
    inputText,
    setInputText,
    activeContext,
    setActiveContext,
    activeCodeContext,
    setActiveCodeContext,
    activeSystemDesignContext,
    setActiveSystemDesignContext,
    resumeText,
    setResumeText,
    problemStatement,
    setProblemStatement,
    isRequestingHint,
    setIsRequestingHint,
    activeExpert,
    setActiveExpert,
    activeCodeContextRef,
    activeSystemDesignContextRef,
  };
}
