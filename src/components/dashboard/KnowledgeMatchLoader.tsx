import React, { useState, useEffect } from "react";
import { KnowledgeMatchGraph } from "./KnowledgeMatchGraph";
import { Shimmer } from "@/components/ui/shimmer";
import { db, Interview } from "@/lib/db";
import { Target } from "@phosphor-icons/react";

export function KnowledgeMatchLoader({ session }: { session: Interview }) {
  const [matchData, setMatchData] = useState(session.matchData);
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
          const data = await res.json();
          if (data.matchData && isMounted) {
            setMatchData(data.matchData);
            await db.interviews.update(session.id!, { matchData: data.matchData });
          }
        } catch (e) {
          console.error(e);
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
