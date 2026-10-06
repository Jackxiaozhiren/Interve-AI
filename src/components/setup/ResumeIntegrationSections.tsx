"use client";

import { motion } from "framer-motion";
import {
  ChartLineUp,
  CheckCircle,
  CircleNotch,
  FilePdf,
  Lightning,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { WizardSection } from "@/components/setup/WizardSection";
import { getInterviewType } from "@/ai/interview/types";
import { RUBRICS } from "@/ai/rubrics";
import { buildInterviewPlan, type InterviewPlan } from "@/ai/interview/plan";
import { type Difficulty } from "@/ai/interview/state";
import type { AlignmentReport } from "@/hooks/useResumeIntegration";

/**
 * The two Setup wizard sections that make up resume integration: the upload
 * dropzone (`05a`) and the alignment report (`05c`). They are one feature but stay
 * two components because the JD textarea (`05b`) sits between them — collapsing them
 * into one block would silently reorder the step.
 *
 * Markup is a verbatim move from `src/app/setup/page.tsx`; the state behind it lives
 * in `useResumeIntegration`.
 */

type UploadProps = {
  file: File | null;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
  isParsing: boolean;
  parsedResumeText: string;
  handleFileUpload: (uploadedFile: File) => void;
  clearFile: () => void;
};

export function ResumeUploadSection({
  file,
  isDragging,
  setIsDragging,
  isParsing,
  parsedResumeText,
  handleFileUpload,
  clearFile,
}: UploadProps) {
  // The picker input is `className="hidden"` — `display: none`, so it is not in the
  // tab order and cannot be reached by a keyboard. The dropzone was therefore a
  // `div onClick` with no keyboard path at all: mouse-only resume upload on step 5.
  // Sonar's reliability rule (S1082) caught it when this markup moved here; it existed
  // in the page before, un-flagged because the rule only reports on new code.
  const openPicker = () => document.getElementById("resume-upload")?.click();

  return (
    <WizardSection title="Resume Integration" index="05a">
              
      <div 
        className={`relative group rounded-[28px] overflow-hidden transition-all duration-500 border-2 border-dashed ${
          isDragging 
            ? "border-sky-400 bg-sky-50/50" 
            : file 
              ? "border-emerald-300/60 bg-emerald-50/30" 
              : "border-slate-200 hover:border-sky-300 hover:bg-slate-50/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
      >
        <div className="absolute inset-0 bg-white/40 backdrop-blur-md pointer-events-none z-0" />
                
        <div className="relative z-10 p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
          {isParsing ? (
            <div className="flex flex-col items-center gap-4">
              <CircleNotch className="w-10 h-10 text-sky-500 animate-spin" />
              <p className="text-sm font-medium text-slate-600">Extracting context from PDF...</p>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200 shadow-sm">
                <FilePdf className="w-8 h-8 text-emerald-600" weight="duotone" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">{file.name}</p>
                <p className="text-xs font-mono text-slate-500 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • {parsedResumeText.length} chars extracted
                </p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="mt-2 text-xs font-semibold text-rose-500 flex items-center gap-1 hover:text-rose-600 transition-colors bg-white/80 px-3 py-1.5 rounded-full shadow-sm border border-rose-100"
              >
                <Trash weight="bold" /> Remove
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-controls="resume-upload"
              className="flex flex-col items-center gap-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
              onClick={openPicker}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  // Space activates a button and must not scroll the page away.
                  e.preventDefault();
                  openPicker();
                }
              }}
            >
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm group-hover:scale-105 transition-transform duration-300">
                <UploadSimple className="w-8 h-8 text-slate-500 group-hover:text-sky-500 transition-colors" weight="duotone" />
              </div>
              <div>
                <p className="font-medium text-slate-700">Drag & drop your resume</p>
                <p className="text-sm text-slate-500 mt-1">PDF format up to 5MB</p>
              </div>
              <input 
                type="file" 
                id="resume-upload" 
                accept="application/pdf" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </WizardSection>
  );
}

type AlignmentProps = {
  context: string;
  parsedResumeText: string;
  alignmentReport: AlignmentReport | null;
  isAnalyzing: boolean;
  analyzeAlignment: () => void;
  selectedInterviewType: string;
  selectedDifficulty: Difficulty;
  selectedDurationSec: number;
};

export function ResumeAlignmentSection({
  context,
  parsedResumeText,
  alignmentReport,
  isAnalyzing,
  analyzeAlignment,
  selectedInterviewType,
  selectedDifficulty,
  selectedDurationSec,
}: AlignmentProps) {
  return (
    <WizardSection title="Resume Alignment" index="05c">
              
      {!alignmentReport ? (
        <div className="p-8 rounded-[28px] border border-slate-200/60 bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
            <ChartLineUp className="w-8 h-8 text-indigo-500" weight="duotone" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Analyze Fit Before Starting</h3>
            <p className="text-slate-500 text-sm max-w-sm mt-1 mx-auto">Upload a resume and provide a JD above to see how well you match, and let our AI interviewer automatically adjust its focus.</p>
          </div>
          <Button 
            onClick={analyzeAlignment}
            disabled={!parsedResumeText || !context || isAnalyzing}
            className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 shadow-sm transition-all"
          >
            {isAnalyzing ? (
              <><CircleNotch className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
            ) : (
              <><Lightning className="w-4 h-4 mr-2" weight="fill" /> Analyze Alignment</>
            )}
          </Button>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-[28px] border border-indigo-200/60 bg-indigo-50/30 backdrop-blur-sm space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Alignment Report</h3>
              <p className="text-sm text-slate-500">Based on your resume and JD</p>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={analyzeAlignment} disabled={isAnalyzing} variant="outline" size="sm" className="rounded-full h-8 text-xs font-semibold">
                {isAnalyzing ? "Re-analyzing..." : "Re-analyze"}
              </Button>
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-indigo-100"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`${alignmentReport.matchScore >= 80 ? 'text-emerald-500' : alignmentReport.matchScore >= 50 ? 'text-amber-500' : 'text-rose-500'}`}
                    strokeDasharray={`${alignmentReport.matchScore}, 100`}
                    strokeWidth="3"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-sm font-bold text-slate-800">{alignmentReport.matchScore}%</span>
              </div>
            </div>
          </div>
                  
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" weight="fill" /> Key Strengths
              </h4>
              <ul className="space-y-2">
                {alignmentReport.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-slate-700 bg-emerald-100/50 px-3 py-1.5 rounded-lg border border-emerald-200/50">{s}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                <ChartLineUp className="w-4 h-4" weight="fill" /> Potential Gaps
              </h4>
              <ul className="space-y-2">
                {alignmentReport.gaps.map((g, i) => (
                  <li key={i} className="text-sm text-slate-700 bg-rose-100/50 px-3 py-1.5 rounded-lg border border-rose-200/50">{g}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Phase 4: evidence grounding — document lines behind strengths/gaps. */}
          {alignmentReport.evidence && alignmentReport.evidence.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200/70 bg-white/60 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Basis in your documents{alignmentReport.confidence ? ` · Evaluator confidence: ${alignmentReport.confidence}` : ""}
              </h4>
              <ul className="space-y-1.5">
                {alignmentReport.evidence.map((q, i) => (
                  <li key={i} className="text-[13px] text-slate-600 border-l-2 border-indigo-300 pl-3 italic">“{q}”</li>
                ))}
              </ul>
            </div>
          )}

          {/* Interview Plan preview (Phase 7: deterministic from alignment + type) */}
          {(() => {
            const type = getInterviewType(selectedInterviewType);
            const rubric = RUBRICS[type.rubricId];
            const plan: InterviewPlan = buildInterviewPlan({
              interviewTypeId: type.id,
              rubricId: type.rubricId,
              rubricDimensions: rubric.dimensions.map((d) => ({ id: d.id, name: d.name })),
              difficulty: selectedDifficulty,
              timeBudgetSec: selectedDurationSec,
              strengths: alignmentReport.strengths,
              gaps: alignmentReport.gaps,
            });
            return (
              <div className="mt-6 p-5 rounded-[20px] border border-sky-200/50 bg-sky-50/40">
                <h4 className="text-sm font-bold text-sky-800 mb-3">
                  Your interview plan · {type.name} · {selectedDifficulty} · {Math.round(selectedDurationSec / 60)} min
                </h4>
                <p className="text-[13px] text-slate-600 mb-2 font-semibold">Focus areas (highest-value gaps first):</p>
                <ul className="space-y-1.5">
                  {plan.focusAreas.map((f, i) => (
                    <li key={i} className="text-[13px] text-slate-700 flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </motion.div>
      )}
    </WizardSection>
  );
}
