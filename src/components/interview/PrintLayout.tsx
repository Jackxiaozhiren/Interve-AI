import React from "react";
import { Interview } from "@/lib/db";

export function PrintLayout({ interview }: { interview: Interview }) {
  if (!interview) return null;

  const dateStr = new Date(interview.createdAt).toLocaleString();

  return (
    <div className="hidden print:block w-full text-black font-sans bg-white p-8">
      {/* Header */}
      <div className="border-b border-gray-300 pb-4 mb-6">
        <h1 className="text-3xl font-serif font-bold mb-2">{interview.title}</h1>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Date: {dateStr}</span>
          <span>Title: {interview.title || "General Interview"}</span>
          {interview.matchData?.overallScore !== undefined && (
            <span className="font-bold text-black">Overall Score: {interview.matchData.overallScore}/100</span>
          )}
        </div>
      </div>

      {/* Cultural Traits */}
      {interview.culturalTraits && interview.culturalTraits.length > 0 && (
        <div className="mb-8 break-inside-avoid">
          <h2 className="text-xl font-bold mb-4 uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-2">Cultural & Behavioral Traits</h2>
          <div className="space-y-4">
            {interview.culturalTraits.map((trait, idx) => (
              <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-gray-800">{trait.trait}</h3>
                  <span className="font-mono text-sm bg-gray-200 px-2 py-1 rounded">{trait.score}/100</span>
                </div>
                <p className="text-sm text-gray-700 italic">&quot;{trait.evidence}&quot;</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Council Debate */}
      {interview.councilDebate && (
        <div className="mb-8 break-inside-avoid">
          <h2 className="text-xl font-bold mb-4 uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-2">Council Debate & Synthesis</h2>
          
          {interview.verdictRationale && (
            <div className="mb-4 p-4 bg-gray-100 rounded-lg border border-gray-300">
              <h3 className="font-bold mb-2">Verdict Synthesis</h3>
              <p className="text-sm text-gray-800">{interview.verdictRationale}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Technical Advisor", data: interview.councilDebate.technicalAdvisor },
              { title: "HR Advisor", data: interview.councilDebate.hrAdvisor },
              { title: "Culture Fit Advisor", data: interview.councilDebate.cultureFitAdvisor },
            ].map((advisor, idx) => advisor.data && (
              <div key={idx} className="border border-gray-200 p-4 rounded-lg break-inside-avoid">
                <div className="font-bold mb-2 flex justify-between items-center">
                  <span className="text-sm">{advisor.title}</span>
                  <span className="text-[10px] uppercase bg-gray-200 px-2 py-0.5 rounded-full">{advisor.data.stance.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-xs text-gray-700">{advisor.data.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostic Review */}
      {interview.qaReview && interview.qaReview.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-2">Diagnostic Review</h2>
          <div className="space-y-6">
            {interview.qaReview.map((qa, idx) => (
              <div key={idx} className="border border-gray-300 p-4 rounded-lg break-inside-avoid">
                <h3 className="font-bold text-sm text-gray-500 mb-2 uppercase">QA Pair {idx + 1}</h3>
                <div className="mb-3">
                  <span className="font-bold text-sm block mb-1">Question:</span>
                  <p className="text-sm italic text-gray-800">{qa.question}</p>
                </div>
                <div className="mb-3">
                  <span className="font-bold text-sm block mb-1">Your Answer:</span>
                  <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded">{qa.userAnswer}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-red-50 p-3 rounded border border-red-100">
                    <span className="font-bold text-xs text-red-800 uppercase block mb-1">Delivery Flaws</span>
                    <p className="text-xs text-red-900">{qa.flaws}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded border border-green-100">
                    <span className="font-bold text-xs text-green-800 uppercase block mb-1">Target Response</span>
                    <p className="text-xs text-green-900">{qa.perfectRewrite}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Transcript */}
      {interview.transcript && interview.transcript.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 uppercase tracking-widest text-gray-800 border-b border-gray-200 pb-2">Full Transcript</h2>
          <div className="space-y-4 text-sm">
            {interview.transcript.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} break-inside-avoid`}>
                  <span className="font-bold text-xs text-gray-500 mb-1">{isUser ? 'Candidate' : 'Interve AI'}</span>
                  <div className={`p-3 rounded-lg max-w-[85%] ${isUser ? 'bg-gray-100 border border-gray-200' : 'bg-blue-50 border border-blue-100'}`}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
