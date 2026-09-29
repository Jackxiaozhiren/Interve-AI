"use client";

import React, { useState, useEffect } from "react";
import { KnowledgeMatchGraph } from "./KnowledgeMatchGraph";
import { Shimmer } from "@/components/ui/shimmer";
import { db, Interview } from "@/lib/db";
import { Target } from "@phosphor-icons/react";
import { describeApiFailure, readApiJson } from "@/lib/api/read-response";

export function KnowledgeMatchLoader({ session }: { session: Interview }) {
  const [matchData, setMatchData] = useState(session.matchData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!session.matchData && session.jobDescription);

  useEffect(() => {
    let isMounted = true;
    if (!session.matchData && session.jobDescription && session.id) {
      const fetchMatch = async () => {
        try {
          const res = await fetch('/api/analyze-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resumeText: session.resumeText || '',
              jobDescription: session.jobDescription,
            })
          });
          // No `res.ok` check used to live here either, and the catch only
          // console.error'd — so a failed analysis made this whole section
          // vanish, which reads as "there is nothing to show" rather than
          // "the request failed".
          const result = await readApiJson<{ matchData?: NonNullable<Interview["matchData"]> }>(res);
          if (!isMounted) return;
          if (!result.ok) {
            setError(describeApiFailure(result.failure));
          } else if (result.data.matchData) {
            setMatchData(result.data.matchData);
            await db.interviews.update(session.id!, { matchData: result.data.matchData });
          } else {
            setError(`服务返回了空的匹配结果（HTTP ${res.status}）。`);
          }
        } catch (e) {
          console.error(e);
          if (isMounted) setError("匹配分析请求未能完成。");
        } finally {
          if (isMounted) setLoading(false);
        }
      };
      fetchMatch();
    }
    return () => { isMounted = false; };
  }, [session.id, session.jobDescription, session.resumeText, session.matchData]);

  if (!session.jobDescription) return null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-3xl border border-slate-100 mb-12 mt-8">
        <Target size={32} className="text-slate-300 animate-bounce mb-4" weight="duotone" />
        <p className="text-sm text-slate-500 font-medium tracking-wide">Analyzing Resume to Job Description Match...</p>
        <div className="w-full max-w-lg mt-6">
          <Shimmer className="w-full h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 mb-12 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4">
        <h4 className="text-[1.05rem] font-serif text-[#111111] mb-1">匹配分析未完成</h4>
        <p className="text-sm text-amber-900/80 leading-relaxed">{error}</p>
      </div>
    );
  }

  if (matchData) {
    return (
      <div className="mt-8 mb-12">
        <h4 className="text-[1.5rem] font-serif text-[#111111] mb-6">Alignment Analysis</h4>
        <KnowledgeMatchGraph matchData={matchData} />
      </div>
    );
  }

  return null;
}
