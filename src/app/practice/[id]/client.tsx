"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mic, Send, CheckCircle2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { InterviewQuestion } from "@/lib/question-bank";
import { DRILL_BANK } from "@/ai/drills/bank";

import { db } from "@/lib/db";

interface AttemptRow {
  score: number;
  createdAt: Date | string;
  // §9 persistence: per-attempt grounding (optional — old rows lack it).
  evidence?: string[];
  confidence?: "high" | "medium" | "low";
}

/** Client-side guard (no zod in client bundle): keep string quotes, cap at 5 (schema max), enum-falls-back-to-medium, never throws. */
export function normalizeAttemptGrounding(input: unknown): { evidence: string[]; confidence: "high" | "medium" | "low" } {
  if (typeof input !== "object" || input === null) return { evidence: [], confidence: "medium" };
  const o = input as Record<string, unknown>;
  const evidence = Array.isArray(o.evidence)
    ? (o.evidence as unknown[]).filter((q): q is string => typeof q === "string" && q.length > 0).slice(0, 5)
    : [];
  const confidence = o.confidence === "high" || o.confidence === "low" ? o.confidence : "medium";
  return { evidence, confidence };
}

/** Module-scope fetch so effects only subscribe, never setState synchronously. */
async function fetchAttempts(questionId: string): Promise<AttemptRow[]> {
  const rows = await db.practiceSessions.where('questionId').equals(questionId).toArray();
  return (rows as AttemptRow[]).slice(0, 5).map((r) => ({
    score: r.score,
    createdAt: r.createdAt,
    // Guarded passthrough: old rows without grounding stay score-only.
    ...(Array.isArray(r.evidence) && r.evidence.length > 0
      ? { evidence: r.evidence.filter((q): q is string => typeof q === "string" && q.length > 0).slice(0, 5) }
      : {}),
    ...(r.confidence === "high" || r.confidence === "low" || r.confidence === "medium"
      ? { confidence: r.confidence }
      : {}),
  }));
}

export default function PracticeSessionClient({ question }: { question: InterviewQuestion }) {
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<null | { score: number, strengths: string[], improvements: string[], evidence?: string[], confidence?: "high" | "medium" | "low", drillIds?: string[] }>(null);
  // Phase 7: attempt history for Retry → Compare.
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchAttempts(question.id)
      .then((rows) => { if (!cancelled) setAttempts(rows); })
      .catch(() => { /* history is best-effort; practice itself must work */ });
    return () => { cancelled = true; };
  }, [question.id]);

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/analyze-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze answer');
      }

      const data = await response.json();
      setFeedback(data);

      // §9: persist grounding with the attempt (guarded — old API responses
      // without an envelope store score-only, exactly as before).
      const grounding = normalizeAttemptGrounding(data);
      await db.practiceSessions.add({
        questionId: question.id,
        questionTitle: question.title,
        category: question.category,
        answer,
        score: data.score,
        strengths: data.strengths,
        improvements: data.improvements,
        ...(grounding.evidence.length > 0 ? { evidence: grounding.evidence, confidence: grounding.confidence } : {}),
        createdAt: new Date(),
      });
      try {
        setAttempts(await fetchAttempts(question.id));
      } catch {
        // best-effort history refresh
      }
      
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-[-10%] w-[40%] h-[40%] bg-emerald-100/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-[-10%] w-[50%] h-[50%] bg-sky-100/40 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-3xl relative z-10 flex flex-col gap-6">
        {/* Navigation */}
        <Link href="/practice" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" />
          Back to Practice Hub
        </Link>

        {/* Question Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="border-none shadow-sm bg-white/70 backdrop-blur-xl">
            <CardContent className="p-8 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                  {question.category}
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">{question.title}</h1>
              <p className="text-slate-600 text-lg leading-relaxed">{question.description}</p>
              
              <div className="flex gap-2 mt-2">
                {question.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded-md">#{tag}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Answer Area */}
        {!feedback ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Card className="border-none shadow-sm bg-white/70 backdrop-blur-xl">
              <CardContent className="p-8 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-slate-900">Your Answer</h2>
                  <Button variant="outline" size="sm" className="gap-2 rounded-full h-8 px-3">
                    <Mic className="w-3.5 h-3.5" />
                    Record Audio
                  </Button>
                </div>
                <Textarea 
                  placeholder="Type your answer here or use the microphone to dictate..." 
                  className="min-h-[200px] resize-none bg-white/50 border-slate-200 focus-visible:ring-emerald-500 text-base"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={handleSubmit} 
                    disabled={!answer.trim() || isSubmitting}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
                  >
                    {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit for Feedback
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <Card className="border-emerald-100 shadow-sm bg-emerald-50/50 backdrop-blur-xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <CardContent className="p-8 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Analysis Complete</h2>
                    <p className="text-sm text-slate-500">
                      Based on standard interview rubrics
                      {feedback.confidence ? ` · Evaluator confidence: ${feedback.confidence} (evidence sufficiency)` : ""}
                    </p>
                  </div>
                  <div className="ml-auto text-3xl font-bold text-emerald-600">
                    {feedback.score}<span className="text-base text-slate-400 font-normal">/100</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  <div className="bg-white/60 p-4 rounded-xl border border-emerald-100/50">
                    <h3 className="font-medium text-emerald-800 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      Strengths
                    </h3>
                    <ul className="space-y-2">
                      {feedback.strengths.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white/60 p-4 rounded-xl border border-amber-100/50">
                    <h3 className="font-medium text-amber-800 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      Areas for Improvement
                    </h3>
                    <ul className="space-y-2">
                      {feedback.improvements.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <Button variant="outline" className="rounded-full px-6" onClick={() => { setFeedback(null); setAnswer(""); }}>
                    Try Again
                  </Button>
                </div>

                {/* Phase 4: evidence grounding — verbatim quotes behind the score. */}
                {feedback.evidence && feedback.evidence.length > 0 && (
                  <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/60 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      What earned this score
                    </h3>
                    <ul className="space-y-1.5">
                      {feedback.evidence.map((q: string, i: number) => (
                        <li key={i} className="text-sm text-slate-600 border-l-2 border-emerald-300 pl-3 italic">
                          “{q}”
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Phase 5: drill loop — bank tasks for the weak areas, back to the hub. */}
                {feedback.drillIds && feedback.drillIds.length > 0 && (
                  <div className="mt-2 rounded-xl border border-indigo-200/60 bg-indigo-50/40 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-2">
                      Recommended drills
                    </h3>
                    <ul className="space-y-2">
                      {feedback.drillIds.map((id: string) => {
                        const drill = DRILL_BANK.find((d) => d.id === id);
                        if (!drill) return null;
                        return (
                          <li key={id} className="text-sm text-slate-700">
                            <Link
                              href={`/practice?q=${encodeURIComponent(drill.title)}`}
                              className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline"
                            >
                              {drill.title}
                            </Link>
                            <span className="text-slate-500"> · {drill.titleZh}</span>
                            <p className="text-[13px] text-slate-600 mt-0.5">{drill.task}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Phase 7: attempt history (Retry → Compare) */}
                {attempts.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-emerald-100">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <History className="w-4 h-4 text-slate-400" />
                      Your attempts on this question
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {attempts.map((a, i) => {
                        const prev = attempts[i + 1]?.score;
                        const delta = prev !== undefined ? a.score - prev : null;
                        // §9: grounding rides in the tooltip — pills render
                        // exactly as before for old rows without evidence.
                        const title = new Date(a.createdAt).toLocaleString()
                          + (a.evidence && a.evidence.length > 0
                            ? ` · Basis: “${a.evidence[0]}”${a.evidence.length > 1 ? ` (+${a.evidence.length - 1} more)` : ""} · Evaluator confidence: ${a.confidence ?? "medium"}`
                            : "");
                        return (
                          <span
                            key={i}
                            title={title}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600"
                          >
                            {a.score}
                            {delta !== null && delta !== 0 && (
                              <span className={delta > 0 ? "text-emerald-600" : "text-rose-500"}>
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
