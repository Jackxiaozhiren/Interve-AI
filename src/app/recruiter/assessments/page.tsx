"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FileText, MagicWand, FloppyDisk, CheckCircle, WarningCircle, Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { Badge } from "@/components/ui/badge";
import { db, Assessment } from "@/lib/db";
import { fadeUpVariant, staggerContainer } from "@/lib/motion";

export default function CreateAssessmentPage() {
  const [jobDescription, setJobDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<Assessment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      setError("Please paste a Job Description first.");
      return;
    }
    setError("");
    setIsGenerating(true);
    setSaveSuccess(false);
    setGeneratedData(null);
    try {
      const response = await fetch("/api/parse-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, questionCount: 5 }),
      });
      if (!response.ok) throw new Error("Failed to generate questions. Please check your connection.");
      const data = await response.json();
      setGeneratedData({
        title: data.title || "Custom Assessment",
        jobDescription,
        questions: data.questions || [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during generation");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedData) return;
    setIsSaving(true);
    try {
      await db.assessments.add({
        ...generatedData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      setSaveSuccess(true);
    } catch (err) {
      console.error(err);
      setError("Failed to save to local database.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-violet-100/40 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
      <div className="absolute bottom-0 left-0 w-[40%] h-[60%] bg-sky-100/30 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />

      <motion.div 
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="max-w-5xl mx-auto relative z-10 flex flex-col gap-8"
      >
        <motion.div variants={fadeUpVariant}>
          <h1 className="text-4xl md:text-5xl font-serif text-slate-900 tracking-tight flex items-center gap-3">
            <Sparkle weight="duotone" className="text-violet-500 w-10 h-10" />
            Smart Assessment Builder
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Paste a Job Description and let AI generate a custom interview question bank.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <motion.div variants={fadeUpVariant} className="flex flex-col h-full">
            <SpotlightCard className="p-8 border-slate-100 shadow-sm bg-white/70 backdrop-blur-xl flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-6 h-6 text-slate-400" />
                <h3 className="text-xl font-semibold text-slate-900">Job Description</h3>
              </div>
              <textarea 
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here... (e.g. Responsibilities, Requirements, Tech Stack)"
                className="flex-1 w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none min-h-[300px]"
              />
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
                  <WarningCircle className="w-5 h-5" /> {error}
                </div>
              )}
              <Button 
                onClick={handleGenerate}
                disabled={isGenerating || !jobDescription.trim()}
                className="mt-6 w-full bg-violet-600 text-white rounded-full h-12 shadow-md hover:bg-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <MagicWand className="w-5 h-5" />
                    </motion.div>
                    Analyzing JD & Generating...
                  </>
                ) : (
                  <>
                    <MagicWand className="w-5 h-5" />
                    Generate Questions
                  </>
                )}
              </Button>
            </SpotlightCard>
          </motion.div>

          {/* Results Section */}
          <motion.div variants={fadeUpVariant} className="flex flex-col h-full">
            <SpotlightCard className="p-8 border-slate-100 shadow-sm bg-white/70 backdrop-blur-xl flex flex-col flex-1">
              {!generatedData && !isGenerating && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 min-h-[300px]">
                  <MagicWand className="w-12 h-12 opacity-50" />
                  <p>Questions will appear here</p>
                </div>
              )}

              {isGenerating && (
                <div className="flex flex-col items-center justify-center h-full text-violet-500 gap-6 min-h-[300px]">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center"
                  >
                    <Sparkle weight="fill" className="w-8 h-8" />
                  </motion.div>
                  <p className="font-medium animate-pulse">Extracting key competencies...</p>
                </div>
              )}

              {generatedData && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col h-full"
                >
                  <h3 className="text-xl font-serif text-slate-900 mb-6 pb-4 border-b border-slate-100">
                    {generatedData.title}
                  </h3>
                  
                  <div className="flex-1 overflow-y-auto pr-2 space-y-6 max-h-[500px]">
                    {generatedData.questions.map((q, idx) => (
                      <div key={idx} className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <p className="font-medium text-slate-900 mb-2">Q{idx + 1}. {q.question}</p>
                        <p className="text-sm text-slate-500 mb-4">{q.rationale}</p>
                        <div className="flex flex-wrap gap-2">
                          {q.expectedSkills.map((skill, sIdx) => (
                            <Badge key={sIdx} variant="secondary" className="bg-violet-50 text-violet-700 border border-violet-100">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 mt-auto border-t border-slate-100">
                    <Button 
                      onClick={handleSave}
                      disabled={isSaving || saveSuccess}
                      className={`w-full text-white rounded-full h-12 shadow-md transition-all flex items-center justify-center gap-2 ${saveSuccess ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'}`}
                    >
                      {saveSuccess ? (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Saved to Question Bank
                        </>
                      ) : isSaving ? (
                        "Saving..."
                      ) : (
                        <>
                          <FloppyDisk className="w-5 h-5" />
                          Save Assessment
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </SpotlightCard>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
