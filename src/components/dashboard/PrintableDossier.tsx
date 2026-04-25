import React from 'react';
import { type Interview } from '@/lib/db';

// This component is designed exclusively for A4 PDF export via html2canvas.
// It uses fixed dimensions and high-contrast styling appropriate for print.
// Do not use this for responsive web display.

export const PrintableDossier = React.forwardRef<HTMLDivElement, { session: Interview }>(({ session }, ref) => {
  if (!session) return null;

  return (
    <div 
      ref={ref}
      // 794px width is standard A4 at 96 DPI.
      className="bg-white text-slate-900 absolute top-[-9999px] left-[-9999px] flex flex-col p-12 overflow-hidden" 
      style={{ width: '794px', minHeight: '1123px', fontFamily: 'Arial, sans-serif' }}
    >
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-serif text-slate-900 mb-2">Interve AI Dossier</h1>
          <h2 className="text-2xl text-slate-600 font-light">{session.title}</h2>
        </div>
        <div className="text-right text-slate-500 font-mono text-sm">
          <div>ID: {String(session.id).padStart(6, '0')}</div>
          <div>DATE: {new Date(session.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Verdict & Delivery */}
      <div className="flex gap-6 mb-10">
        <div className="flex-1 bg-slate-50 border border-slate-200 p-6 rounded-2xl">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Final Verdict</div>
          <div className="text-3xl font-bold text-slate-800 mb-2 capitalize">
            {session.hireVerdict ? session.hireVerdict.replace(/_/g, ' ') : 'Pending'}
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{session.verdictRationale}</p>
        </div>
        
        {session.deliveryStats && (
          <div className="w-1/3 flex flex-col gap-4">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Words Per Minute</div>
              <div className="text-3xl font-light text-slate-800">{session.deliveryStats.wpm}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Filler Words</div>
              <div className="text-3xl font-light text-slate-800">{session.deliveryStats.fillerWords}</div>
            </div>
          </div>
        )}
      </div>

      {/* Council Debate */}
      {session.councilDebate && (
        <div className="mb-10 page-break-inside-avoid">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Hiring Council Evaluation</div>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-sky-50/30 border border-sky-100 p-5 rounded-2xl">
              <div className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">Technical</div>
              <div className="font-bold text-sm mb-2 capitalize text-sky-900">{session.councilDebate.technicalAdvisor.stance.replace(/_/g, ' ')}</div>
              <div className="text-xs text-slate-600">&quot;{session.councilDebate.technicalAdvisor.reasoning}&quot;</div>
            </div>
            <div className="bg-rose-50/30 border border-rose-100 p-5 rounded-2xl">
              <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">HR / Comms</div>
              <div className="font-bold text-sm mb-2 capitalize text-rose-900">{session.councilDebate.hrAdvisor.stance.replace(/_/g, ' ')}</div>
              <div className="text-xs text-slate-600">&quot;{session.councilDebate.hrAdvisor.reasoning}&quot;</div>
            </div>
            <div className="bg-emerald-50/30 border border-emerald-100 p-5 rounded-2xl">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Culture Fit</div>
              <div className="font-bold text-sm mb-2 capitalize text-emerald-900">{session.councilDebate.cultureFitAdvisor.stance.replace(/_/g, ' ')}</div>
              <div className="text-xs text-slate-600">&quot;{session.councilDebate.cultureFitAdvisor.reasoning}&quot;</div>
            </div>
          </div>
        </div>
      )}

      {/* Cultural Traits */}
      {session.culturalTraits && session.culturalTraits.length > 0 && (
        <div className="mb-10 page-break-inside-avoid">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Cultural & Behavioral Traits</div>
          <div className="grid grid-cols-2 gap-6">
            {session.culturalTraits.map((trait, idx: number) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-bold text-sm text-slate-900">{trait.trait}</div>
                  <div className="text-xs font-mono font-bold text-sky-600">{trait.score}/100</div>
                </div>
                <div className="text-xs text-slate-600 italic">&quot;{trait.evidence}&quot;</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Q&A Review */}
      <div className="mb-6">
        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">Detailed Q&A Review</div>
        {session.qaReview?.map((qa, idx: number) => (
          <div key={idx} className="mb-10 page-break-inside-avoid">
            <h3 className="text-lg font-serif text-slate-900 mb-4 font-bold">Q{idx + 1}: {qa.question}</h3>
            
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl mb-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your Delivery</div>
              <p className="text-sm text-slate-700 italic">&quot;{qa.userAnswer}&quot;</p>
              
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">Diagnostic Feedback</div>
                <p className="text-sm text-rose-900/80">{qa.flaws}</p>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl text-white">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Target Response Framework</div>
              <p className="text-sm text-slate-300 font-light leading-relaxed">{qa.perfectRewrite}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div className="mt-auto pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
        Generated securely by Interve AI • For personal review only
      </div>
    </div>
  );
});
PrintableDossier.displayName = 'PrintableDossier';
