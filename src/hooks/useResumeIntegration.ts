"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { describeApiFailure, readApiJson } from "@/lib/api/read-response";

// Kept as a named type rather than `typeof alignmentReport` so the setup page can
// read the report without owning the state that produces it.
export interface AlignmentReport {
  matchScore: number;
  strengths: string[];
  gaps: string[];
  recommendedFocus: string;
  evidence?: string[];
  confidence?: "high" | "medium" | "low";
}

/**
 * The resume-integration cluster of Setup: PDF upload + extraction, and the
 * resume/JD alignment preflight that auto-runs once both halves exist. Moved
 * verbatim out of `src/app/setup/page.tsx` (Ring B was 1283 lines against a
 * 1300-line God-component ceiling) so the page stops owning resume parsing.
 *
 * Behaviour carried over unchanged, including the three things that are easy to
 * lose in a move like this:
 * - the store seed stays a *setter the rule can see*. `set-state-in-effect` cannot
 *   look through a returned setter, so lifting this state naively would have made
 *   `src/app/setup/page.tsx:165`'s suppression read as "no problem reported" while
 *   the effect kept doing exactly what it guards. Seeding here keeps it visible.
 * - `analyzeAlignment` writes `RECOMMENDED FOCUS:` back into the JD textarea, so
 *   the context a user sees is the context the session starts with. That is why
 *   `context`/`setContext` are arguments rather than local state.
 * - the auto-analyze effect fires at most once (`hasAutoAnalyzed`) and defers by
 *   100 ms; the original comment about letting React settle still applies.
 */
export function useResumeIntegration({
  context,
  setContext,
  storeResumeText,
}: {
  context: string;
  setContext: Dispatch<SetStateAction<string>>;
  storeResumeText: string | null;
}) {
  // Resume upload state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResumeText, setParsedResumeText] = useState("");

  // Alignment analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [alignmentReport, setAlignmentReport] = useState<AlignmentReport | null>(null);
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false);

  // Seed the parsed resume from the store. It has to stay an effect rather than a
  // lazy `useState` initializer: the store can receive the text after this page
  // mounts (the interview page hands a resume over when it navigates back), and a
  // first-render initializer would read `""` and never look again.
  useEffect(() => {
    if (storeResumeText && !parsedResumeText) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setParsedResumeText(storeResumeText);
    }
  }, [storeResumeText, parsedResumeText]);


  const analyzeAlignment = async () => {
    if (!parsedResumeText || !context) {
      toast.error("Missing Data", { description: "Please upload a resume and provide context (JD) first." });
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-alignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: parsedResumeText, jobDescription: context }),
      });
      // There was no `res.ok` check here at all: any error response fell into
      // the catch below and was reported as "Something went wrong", and a
      // platform-level rejection (this route declares no duration budget) is
      // not even JSON, so the parse itself threw.
      const result = await readApiJson<AlignmentReport>(res);
      if (!result.ok) {
        toast.error("Analysis Failed", { description: describeApiFailure(result.failure), duration: 8000 });
      } else if (result.data.matchScore !== undefined) {
        setAlignmentReport(result.data);
        // Automatically append to context if not already added
        if (!context.includes("RECOMMENDED FOCUS:")) {
           setContext(prev => prev + `\n\nRECOMMENDED FOCUS: ${result.data.recommendedFocus}`);
        }
        toast.success("Analysis Complete", { description: "Alignment report generated successfully." });
      } else {
        toast.error("Analysis Failed", { description: `服务返回了没有匹配分数的报告（HTTP ${res.status}）。` });
      }
    } catch (err) {
      console.error(err);
      toast.error("Analysis Error", { description: "分析请求未能完成，请重试。" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    // Auto-analyze if we have both parsedResumeText and context, but haven't analyzed yet
    if (parsedResumeText && context && !alignmentReport && !isAnalyzing && !hasAutoAnalyzed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasAutoAnalyzed(true);
      // Let React settle before calling analyzeAlignment
      setTimeout(() => analyzeAlignment(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedResumeText, context, alignmentReport, isAnalyzing, hasAutoAnalyzed]);

  // A cleared upload drops both the file and the text extracted from it, so the
  // alignment preflight cannot keep reporting against a resume that is gone.
  const clearFile = () => {
    setFile(null);
    setParsedResumeText("");
  };

  const handleFileUpload = async (uploadedFile: File) => {
    if (!uploadedFile || uploadedFile.type !== "application/pdf") {
      toast.error("Invalid file", {
        description: "Please upload a valid PDF file.",
      });
      return;
    }
    setFile(uploadedFile);
    setIsParsing(true);
    
    const formData = new FormData();
    formData.append("file", uploadedFile);
    
    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      const result = await readApiJson<{ text?: string }>(res);

      if (result.ok && result.data.text) {
        setParsedResumeText(result.data.text);
        return;
      }

      // Three different failures used to collapse into one blind "Parsing
      // Error": the server said no in JSON, the server said something that was
      // not JSON at all (a platform timeout or body-limit rejection looks
      // exactly like this), or the request never completed. The status is the
      // only clue a user can pass on, so it goes in the message.
      toast.error("Extraction failed", {
        description: result.ok
          ? `服务返回了空正文（HTTP ${res.status}）。`
          : describeApiFailure(result.failure),
        duration: 8000,
      });
      setFile(null);
    } catch (err) {
      console.error("Failed to parse resume:", err);
      toast.error("Upload failed", {
        description: "请求未能完成（网络中断或超时），请重试。",
      });
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  return {
    file,
    isDragging,
    setIsDragging,
    isParsing,
    parsedResumeText,
    alignmentReport,
    isAnalyzing,
    analyzeAlignment,
    handleFileUpload,
    clearFile,
  };
}
